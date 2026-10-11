import { getPosts, getSeries } from "../../lib/content.mjs";
import { siteUrl } from "../../data/site.js";
export function GET() {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const entries = [
    ...["", "/blog", "/series", "/works", "/about"].map(
      (route) => ({ url: `${siteUrl}${route}`, date: null }),
    ),
    ...getPosts().map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      date: post.updated || post.date,
    })),
    ...getSeries().map((item) => ({
      url: `${siteUrl}/series/${item.slug}`,
      date: null,
    })),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((item) => `<url><loc>${escape(item.url)}</loc>${item.date ? `<lastmod>${item.date}</lastmod>` : ""}</url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
