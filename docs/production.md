# 生产发布

当前站点使用 GitHub Actions 自动发布到原服务器与 Cloudflare Pages，两处分别提供静态文件。

- 仓库：`ashyh123/zero-to-tech`，发布分支：`main`。
- 原域名地址：`http://ashyh666.me`（备案拦截尚未解除）。
- Pages 免费地址：[https://evan-huang-blog.pages.dev](https://evan-huang-blog.pages.dev)，项目 `evan-huang-blog`。
- 服务器：`101.200.231.184`，发布用户：`blogdeploy`。
- 发布目录：`/var/www/agent-journey/releases/`，当前版本链接：`/var/www/agent-journey/current`。
- Nginx 配置：`/etc/nginx/sites-available/default`。改动前的配置备份：`/etc/nginx/sites-available/default.before-astro-20261011`。
- 旧网站文件保留在 `/root/zero-to-tech/out`，不再作为当前网站目录。

## 发布内容

文章放在 `content/posts/`，配图放在 `public/images/`。正文确认后设置 `draft: false`，运行 `npm test` 和 `npm run build`，提交并推送 `main`。GitHub Actions 全部成功后核对线上页面、图片和站内链接。作品目前维护在 `src/pages/works.astro`。

草稿不会生成公开页面。首页文章与系列区域会在出现公开内容后自动显示。RSS 在正式发布构建中启用，本地预览默认关闭。

## Cloudflare Pages 自动发布

现有项目采用 Direct Upload，通过 `.github/workflows/publish.yml` 的 `pages` job 和 Wrangler 自动上传，不需要重新创建项目或更改 DNS。GitHub 仓库 Secrets 已配置 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；Token 仅授予当前账户 Pages 编辑权限，没有到期日，凭据不写入源码。

推送 `main` 后，先运行测试；通过后服务器和 Pages 分别发布。Pages 单独以 `SITE_URL=https://evan-huang-blog.pages.dev`、`RSS_ENABLED=true` 构建，避免沿用原域名的 canonical、RSS 与 sitemap。查看 GitHub Actions 三个 job 的结果，并核对 Pages 的最新 Production 部署；一个目标失败时需单独检查该 job，另一个成功目标可能已更新。

未来推送博客内容即可同时更新两处。Pages 不绑定当前域名，原服务器与域名配置保留。

## 回退

构建或上传失败不会切换当前版本。需要回退时，先确认历史版本目录完整，再通过部署账户执行以下命令，将 `已确认的版本目录` 换成实际目录：

```bash
cd /var/www/agent-journey
ln -s releases/已确认的版本目录 .rollback
mv -Tf .rollback current
```

之后核对页面，再修正源码；下一次成功发布会再次更新 `current`。

## 域名与 HTTPS

服务器本地页面可用不代表域名公网访问已恢复。域名访问曾返回 403，标题为 `Non-compliance ICP Filing`；需在云服务商控制台核对域名备案与接入状态。

HTTPS 配置完成后，将 GitHub 仓库变量 `SITE_URL` 改为 `https://ashyh666.me` 并重新发布，以更新文章规范链接、RSS 和网站地图。证书安装与续期不由当前发布脚本管理。
