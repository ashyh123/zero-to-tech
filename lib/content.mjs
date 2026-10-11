import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";

const defaultRoot = path.join(process.cwd(), "content");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}
function text(value, file, key) {
  if (typeof value !== "string" || !value.trim())
    fail(file, `${key} 必须是非空字符串`);
  return value.trim();
}
function date(value, file, key) {
  const result = text(value, file, key);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    fail(file, `${key} 必须是有效的 YYYY-MM-DD 日期，请在 YAML 中加引号`);
  return result;
}
function slug(value, file) {
  const result = text(value, file, "slug");
  if (!slugPattern.test(result) || result === "preparing")
    fail(
      file,
      "slug 只能包含小写英文字母、数字和单连字符，不能使用保留值 preparing",
    );
  return result;
}

// Pages depend on this adapter, not Markdown paths. A future CMS can replace the adapter.
export function getPosts(root = defaultRoot) {
  const directory = path.join(root, "posts");
  if (!fs.existsSync(directory)) return [];
  const seen = new Set();
  const posts = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs
        .readFileSync(path.join(directory, file), "utf8")
        .replace(/^\uFEFF/, "");
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(
        source,
      );
      if (!match) fail(file, "缺少 YAML front matter");
      const data = parseYaml(match[1]);
      const content = match[2];
      if (!data || typeof data !== "object" || Array.isArray(data))
        fail(file, "front matter 必须是键值对象");
      const id = slug(data.slug, file);
      if (seen.has(id)) fail(file, `重复的 slug: ${id}`);
      seen.add(id);
      const title = text(data.title, file, "title");
      const summary = text(data.summary, file, "summary");
      const published = date(data.date, file, "date");
      if (typeof data.draft !== "boolean")
        fail(file, "draft 必须明确填写 true 或 false");
      if (
        !Array.isArray(data.tags) ||
        data.tags.some((tag) => typeof tag !== "string" || !tag.trim())
      )
        fail(file, "tags 必须是字符串数组");
      const updated = data.updated ? date(data.updated, file, "updated") : null;
      if (updated && updated < published) fail(file, "updated 不能早于 date");
      const series = data.series ? slug(data.series, file) : null;
      const order = series ? data.order : null;
      if (series && (!Number.isInteger(order) || order < 1))
        fail(file, "系列文章需要正整数 order");
      text(content, file, "正文");
      const chinese = (content.match(/[\u3400-\u9fff]/g) || []).length;
      const words = (content.match(/[a-zA-Z0-9]+/g) || []).length;
      return {
        slug: id,
        title,
        summary,
        date: published,
        updated,
        tags: [...new Set(data.tags.map((tag) => tag.trim()))],
        series,
        order,
        draft: data.draft,
        body: content,
        readingMinutes: Math.max(1, Math.ceil((chinese + words) / 350)),
      };
    });
  return posts
    .filter((post) => !post.draft)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
    );
}
export function getPost(id, root = defaultRoot) {
  return getPosts(root).find((post) => post.slug === id);
}
export function getSeries(root = defaultRoot) {
  const definitions = JSON.parse(
    fs.readFileSync(path.join(root, "series.json"), "utf8"),
  );
  if (!Array.isArray(definitions)) fail("series.json", "必须是数组");
  const posts = getPosts(root);
  const seen = new Set();
  const items = definitions.map((item) => {
    const id = slug(item.slug, "series.json");
    if (seen.has(id)) fail("series.json", `重复的系列 slug: ${id}`);
    seen.add(id);
    const members = posts
      .filter((post) => post.series === id)
      .sort((a, b) => a.order - b.order);
    if (new Set(members.map((post) => post.order)).size !== members.length)
      fail("series.json", `${id} 存在重复的文章顺序`);
    return {
      slug: id,
      title: text(item.title, "series.json", "title"),
      description: text(item.description, "series.json", "description"),
      posts: members,
    };
  });
  for (const post of posts)
    if (post.series && !seen.has(post.series))
      fail(post.slug, `未定义的系列 ${post.series}`);
  return items.filter((item) => item.posts.length);
}
function nodeText(node) {
  return node.value || node.alt || (node.children || []).map(nodeText).join("");
}
export async function renderMarkdown(body) {
  const ast = unified().use(remarkParse).use(remarkGfm).parse(body);
  const slugger = new GithubSlugger();
  const headings = [];
  function visit(node) {
    if (node.type === "heading") {
      const title = nodeText(node);
      const id = slugger.slug(title);
      if (node.depth === 2 || node.depth === 3)
        headings.push({ id, title, depth: node.depth });
    }
    for (const child of node.children || []) visit(child);
  }
  visit(ast);
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: false })
    .use(rehypeStringify)
    .process(body);
  return { html: String(result), headings };
}
export function escapeXml(value) {
  return String(value).replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
}
export function createFeed(posts, name, description, baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(name)}</title><link>${escapeXml(base)}</link><description>${escapeXml(description)}</description><language>zh-CN</language><atom:link href="${escapeXml(base)}/rss.xml" rel="self" type="application/rss+xml"/>${posts.map((post) => `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(base)}/blog/${post.slug}</link><guid isPermaLink="true">${escapeXml(base)}/blog/${post.slug}</guid><description>${escapeXml(post.summary)}</description><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("")}</item>`).join("")}</channel></rss>`;
}
