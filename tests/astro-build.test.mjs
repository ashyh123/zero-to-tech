import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Isolated content exercises routes absent from the empty production blog.
test(
  "Astro exports public articles, series, SEO and feeds without draft leakage",
  { timeout: 30000 },
  async () => {
    const project = process.cwd();
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "journey-astro-test-"),
    );
    try {
      for (const name of [
        "src",
        "css",
        "lib",
        "data",
        "astro.config.mjs",
        "tsconfig.json",
        "package.json",
      ])
        await fs.cp(path.join(project, name), path.join(root, name), {
          recursive: true,
        });
      await fs.mkdir(path.join(root, "node_modules"));
      for (const name of await fs.readdir(path.join(project, "node_modules"))) {
        if (name === "@starwind-ui" || name === "astro") {
          // Astro virtual modules need the component package inside the fixture root.
          await fs.cp(
            path.join(project, "node_modules", name),
            path.join(root, "node_modules", name),
            { recursive: true },
          );
        } else {
          await fs.symlink(
            path.join(project, "node_modules", name),
            path.join(root, "node_modules", name),
            "junction",
          );
        }
      }
      await fs.mkdir(path.join(root, "content/posts"), { recursive: true });
      await fs.writeFile(
        path.join(root, "content/series.json"),
        JSON.stringify([
          { slug: "test-series", title: "测试系列", description: "迁移验证" },
        ]),
      );
      for (const [slug, order, draft, tag] of [
        ["test-first", 1, false, "Agent"],
        ["test-second", 2, false, "工程"],
        ["private-draft", 3, true, "秘密标签"],
      ]) {
        await fs.writeFile(
          path.join(root, `content/posts/${slug}.md`),
          `---\nslug: ${slug}\ntitle: "${slug}"\nsummary: "测试摘要 & 内容"\ndate: "2026-10-10"\ntags: [${tag}]\ndraft: ${draft}\nseries: test-series\norder: ${order}\n---\n## 开始实践\n\n正文。\n\n\`\`\`js\nconst answer = 42;\n\`\`\`\n\n<script>alert('unsafe')</script>\n`,
        );
      }
      await promisify(execFile)(
        process.execPath,
        [path.join(root, "node_modules/astro/bin/astro.mjs"), "build"],
        {
          cwd: root,
          env: {
            ...process.env,
            SITE_URL: "https://blog.example.com",
            RSS_ENABLED: "true",
            ASTRO_TELEMETRY_DISABLED: "1",
          },
          maxBuffer: 2e6,
        },
      );
      const read = (file) => fs.readFile(path.join(root, "out", file), "utf8");
      const article = await read("blog/test-first.html");
      assert.match(article, /<h1>test-first<\/h1>/);
      assert.match(article, /<h2 id="开始实践">/);
      assert.match(article, /href="#开始实践"/);
      assert.match(article, /language-js/);
      assert.match(article, /href="\/blog\/test-second"/);
      assert.match(
        article,
        /href="https:\/\/blog.example.com\/blog\/test-first"/,
      );
      assert.match(article, /property="og:type" content="article"/);
      assert.doesNotMatch(article, /alert\('unsafe'\)/);
      assert.doesNotMatch(article, /_next\/|__NEXT_DATA__|astro-island/);
      const series = await read("series/test-series.html");
      assert.match(series, /test-first/);
      assert.match(series, /test-second/);
      assert.doesNotMatch(series, /private-draft/);
      for (const file of [
        "index.html",
        "blog.html",
        "rss.xml",
        "sitemap.xml",
      ]) {
        const output = await read(file);
        assert.match(output, /test-first/);
        assert.doesNotMatch(output, /private-draft|秘密标签/);
      }
      assert.match(
        await read("rss.xml"),
        /https:\/\/blog.example.com\/blog\/test-first/,
      );
      assert.match(
        await read("robots.txt"),
        /Sitemap: https:\/\/blog.example.com\/sitemap.xml/,
      );
      await assert.rejects(
        fs.access(path.join(root, "out/blog/private-draft.html")),
      );
      assert.match(await read("404.html"), /name="robots" content="noindex"/);

      // Turning the feature off must remove both discoverable links and the file,
      // even when the previous build in the same output directory had it enabled.
      await promisify(execFile)(
        process.execPath,
        [path.join(root, "node_modules/astro/bin/astro.mjs"), "build"],
        {
          cwd: root,
          env: {
            ...process.env,
            SITE_URL: "https://blog.example.com",
            RSS_ENABLED: "false",
            ASTRO_TELEMETRY_DISABLED: "1",
          },
          maxBuffer: 2e6,
        },
      );
      await assert.rejects(fs.access(path.join(root, "out/rss.xml")));
      for (const file of [
        "index.html",
        "blog.html",
        "about.html",
        "series.html",
        "blog/test-first.html",
        "404.html",
      ]) {
        assert.doesNotMatch(await read(file), /rss\.xml|RSS 订阅|通过 RSS/);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
