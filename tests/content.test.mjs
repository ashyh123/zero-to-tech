import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getPosts,
  getPost,
  getSeries,
  renderMarkdown,
  createFeed,
} from "../lib/content.mjs";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-test-"));
  fs.mkdirSync(path.join(root, "posts"));
  fs.writeFileSync(path.join(root, "series.json"), "[]");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, slug, overrides = {}) {
  const fields = {
    slug,
    title: "实践记录",
    summary: "问题与结果",
    date: "2026-10-11",
    tags: ["Agent"],
    draft: false,
    ...overrides,
  };
  const yaml = Object.entries(fields)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  fs.writeFileSync(
    path.join(root, "posts", `${slug}.md`),
    `---\n${yaml}\n---\n\n## 实践\n\n记录。`,
  );
}
test("drafts stay out of public lookup, feed, and series", (t) => {
  const root = fixture(t);
  write(root, "public-post");
  write(root, "private-draft", {
    draft: true,
    title: "秘密草稿",
    series: "private-series",
    order: 1,
  });
  assert.equal(getPosts(root).length, 1);
  assert.equal(getPost("private-draft", root), undefined);
  assert.deepEqual(getSeries(root), []);
  assert.ok(
    !createFeed(getPosts(root), "博客", "描述", "https://example.com").includes(
      "秘密",
    ),
  );
});
test("invalid dates, missing draft state, unsafe slugs and duplicate slugs fail builds", (t) => {
  const root = fixture(t);
  write(root, "bad", { date: "2026-02-30" });
  assert.throws(() => getPosts(root), /有效/);
  write(root, "bad", { draft: "false" });
  assert.throws(() => getPosts(root), /draft/);
  write(root, "bad", { slug: "../private" });
  assert.throws(() => getPosts(root), /slug/);
  write(root, "bad", { slug: "same" });
  write(root, "second", { slug: "same" });
  assert.throws(() => getPosts(root), /重复/);
});
test("series uses explicit order and rejects ambiguous or undefined membership", (t) => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, "series.json"),
    JSON.stringify([
      { slug: "agent-path", title: "Agent 入门", description: "实践路径" },
    ]),
  );
  write(root, "second", { series: "agent-path", order: 2 });
  write(root, "first", { series: "agent-path", order: 1 });
  assert.deepEqual(
    getSeries(root)[0].posts.map((p) => p.slug),
    ["first", "second"],
  );
  write(root, "second", { series: "agent-path", order: 1 });
  assert.throws(() => getSeries(root), /重复/);
  write(root, "second", { series: "unknown", order: 2 });
  assert.throws(() => getSeries(root), /未定义/);
});
test("Markdown renders GFM and highlighted code, strips scripts, and matches duplicate heading anchors", async () => {
  const { html, headings } = await renderMarkdown(
    '## 实践\n\n## 实践\n\n| 输入 | 输出 |\n| --- | --- |\n| A | B |\n\n```python\nprint("hello")\n```\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))',
  );
  assert.ok(html.includes("<table>"));
  assert.ok(html.includes("hljs"));
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes('href="javascript:'));
  assert.deepEqual(
    headings.map((h) => h.id),
    ["实践", "实践-1"],
  );
  for (const heading of headings)
    assert.ok(html.includes(`id="${heading.id}"`));
});
test("RSS escapes metadata and uses canonical article URLs", () => {
  const xml = createFeed(
    [
      {
        slug: "example",
        title: "A & B",
        summary: "<说明>",
        date: "2026-10-11",
        tags: ["Agent & 工程"],
      },
    ],
    "博客",
    "学习",
    "https://example.com/",
  );
  assert.ok(xml.includes("A &amp; B"));
  assert.ok(xml.includes("&lt;说明&gt;"));
  assert.ok(xml.includes("https://example.com/blog/example"));
  assert.ok(xml.includes("Sun, 11 Oct 2026"));
  assert.ok(!xml.includes("localhost"));
});
