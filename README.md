# Zero to Tech · 模块 4.6 静态导出

个人主页与文字实验室使用 Next.js App Router。按照模块 4.6 的方式 B，构建时生成完整的静态网站 `out/`，部署时由 Nginx 提供文件。

## 本地开发

```bash
cd ~/zero-to-tech
npm ci
npm run dev
```

打开 http://localhost:3000 。页面内容集中在 `data/site.js`。

## 构建和预览静态网站

`next.config.mjs` 已启用 `output: "export"`，同时保留本项目的 `outputFileTracingRoot` 配置。

```bash
npm run build
npm run preview
```

预览地址是 http://127.0.0.1:3000 。先停止正在使用 3000 端口的开发服务。

`npm run preview` 与 `npm start` 都使用本地静态文件服务器读取 `out/`。静态导出模式不再使用 `next start`。

构建后应包含：

```text
out/
  index.html
  text-lab.html
  404.html
  _next/static/
```

验证首页与 `/text-lab` 直接访问、刷新、导航、前进后退和输入字数统计。不存在的路径应返回 404。

`.gitignore` 已忽略 `out/`、`.next/` 和 `node_modules/`。提交的是源码与配置；静态资源通过构建生成。

## 提交源码

```bash
git add -A
git commit -m "Enable module 4.6 static export"
git push origin main
```

## 云服务器步骤（本次仅准备，未执行）

下面按课程的 Ubuntu 用户 `ubuntu`、项目路径 `/home/ubuntu/zero-to-tech` 举例。部署时替换服务器 IP，并确认实际项目路径和现有 Nginx 配置。

```bash
ssh ubuntu@你的服务器IP
node -v
cd ~/zero-to-tech
git status --short --branch
git pull --ff-only origin main
npm ci
npm run build
```

如果拉取被拒绝或服务器有未提交改动，先处理服务器仓库的状态，再继续构建。

把 `deploy/nginx.conf` 中的 `server` 配置合并到服务器实际使用的站点配置中：

```bash
sudo vim /etc/nginx/sites-enabled/default
```

核心配置为：

```nginx
root /home/ubuntu/zero-to-tech/out;
index index.html;

location / {
    try_files $uri $uri.html $uri/ =404;
}
```

`/text-lab` 会匹配到 `out/text-lab.html`；未知地址返回 404。

保存后在服务器上执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

只在 `nginx -t` 通过后重载。最后访问 `http://你的服务器IP/` 和 `http://你的服务器IP/text-lab`，检查刷新与交互，并查看页面源代码确认有标题和内容。

服务器仅需在更新时安装依赖并构建；正式提供页面的是 Nginx。`serve` 是本地预览工具，无需在云服务器常驻运行。

## 参考

- [模块 4.6 课程](https://xn--ygr25xpohxwz.com/zero-to-fullstack/lessons/module-4-6/)
- [Next.js 15 静态导出](https://nextjs.org/docs/15/app/guides/static-exports)
- [Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)
- [Vercel serve 静态预览工具](https://github.com/vercel/serve)
