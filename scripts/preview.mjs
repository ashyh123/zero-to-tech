import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream";
const root = path.resolve("out");
if (!fs.existsSync(path.join(root, "index.html")))
  throw new Error("请先执行 npm run build");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root + path.sep) && target !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = [
      target,
      target + ".html",
      path.join(target, "index.html"),
    ].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
    const output = file || path.join(root, "404.html");
    res.writeHead(file ? 200 : 404, {
      "Content-Type": types[path.extname(output)] || "application/octet-stream",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    pipeline(fs.createReadStream(output), res, () => {});
  })
  .listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
    console.log(
      `静态预览：http://127.0.0.1:${Number(process.env.PORT) || 3000}`,
    ),
  );
