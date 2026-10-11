# 使用 Pages CMS 写博客

后台入口：https://app.pagescms.org 。它是独立的编辑后台，不改变博客页面样式，也不需要在博客服务器运行新的服务。

## 首次连接

使用拥有 `ashyh123/zero-to-tech` 的 GitHub 账号登录。安装 Pages CMS GitHub App 时选择 **Only select repositories**，仅选择 `zero-to-tech`。核对 GitHub 显示的权限后授权。然后打开仓库，选择 `main` 分支；后台会读取根目录的 `.pages.yml`。

当前仓库已经完成首次登录与 GitHub App 授权。其他账号尚未授权时，后台不能读写内容。GitHub App 具有仓库级权限；表单字段范围不是 GitHub 的访问控制边界。不要将服务器 SSH 密钥或部署 Token 填进 CMS，已有 GitHub Actions Secrets 无需提供给后台。

## 写文章与学习记录

1. 进入“文章与学习记录”，新建内容。
2. 填写标题、文章链接标识、摘要和日期。链接标识使用 `my-first-agent` 这样的英文标识，发布后保持不变。
3. 点击标签旁的 **Add an item** 添加标签。学习笔记可以用“学习记录”，两类内容统一保存在 `content/posts/`，使用现有文章列表和标签筛选。
4. 在正文编辑器写作；可以切换 Source 编辑 Markdown。代码使用带语言名称的代码块，图片通过编辑器的图片按钮上传或选取。
5. 保持“草稿”开启并保存：保存会提交到 GitHub、触发构建，但不会生成公开文章，也不会进入 RSS、网站地图或首页。
6. 确认内容后关闭“草稿”，再次保存。等待 GitHub Actions 的 build、deploy、Deploy to Cloudflare Pages 全部成功，再检查线上页面。

草稿只是不在网站发布：本仓库是公开仓库，草稿文件及历史仍可在 GitHub 阅读，请勿存放私密笔记。更新日期可留空；填写时不能早于发布日期。日期用于排序，不会定时发布。系列字段先留空，除非已在 `content/series.json` 定义对应系列。

## 图片

“图片”媒体库保存至 `public/images/`，正文链接使用 `/images/文件名`。允许 JPG、JPEG、PNG、WebP、GIF、AVIF，上传时随机命名，减少重名覆盖。图片本身属于公开网站资源，草稿状态不会隐藏已经上传的图片。暂时不用的图片也可先上传，之后在正文选取。

## 发布与维护

CMS 保存到 `main` 的提交会触发现有 `.github/workflows/publish.yml`，原服务器与 Cloudflare Pages 分别构建和自动发布。没有新增部署密钥、修改域名或改变访客界面。后台编辑器预览不等于博客最终排版，以发布后页面为准。

保存后若更新没有上线，查看 GitHub Actions 的失败信息；常见原因是重复文章链接标识、无效日期、正文为空，或系列配置不完整。原有测试与内容校验仍会阻止错误构建发布。后台修改后，本地继续写作前先 `git pull --ff-only`，避免与 CMS 的提交冲突。

参考：[Pages CMS 快速开始](https://pagescms.org/docs/quick-start/)、[内容字段](https://pagescms.org/docs/configuration/content/fields/)、[图片配置](https://pagescms.org/docs/configuration/media/)。

## 接入验证记录

2026-10-11 已通过后台实际保存草稿、上传 PNG 图片、关闭草稿发布的验证。草稿在两处站点均返回 404；发布后文章、首页列表、RSS、网站地图与图片在原服务器和 Pages 均可访问，图片文件一致，浏览器图片与代码高亮正常。测试文章和配图随后清理，不作为正式内容。

可选系列标识允许留空；更新日期留空时不会写入无效日期。标签在点击 Add an item 后填写。
