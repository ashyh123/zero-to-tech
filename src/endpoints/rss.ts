import { getPosts, createFeed } from "../../lib/content.mjs";
import { site, siteUrl } from "../../data/site.js";
export function GET() {
  return new Response(
    createFeed(getPosts(), site.name, site.description, siteUrl),
    { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } },
  );
}
