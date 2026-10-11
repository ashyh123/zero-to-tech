import { getPosts, getSeries, renderMarkdown } from "../lib/content.mjs";
const posts = getPosts();
const series = getSeries();
await Promise.all(posts.map((post) => renderMarkdown(post.body)));
console.log(
  `内容检查通过：${posts.length} 篇公开文章，${series.length} 个公开系列。`,
);
