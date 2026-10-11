# 一个零基础agent学生的旅程

面向同路学习者的个人博客：Agent 为主线，前后端与部署作为配套实践。Astro 构建为静态网站，不需要在线后端。旧版源码保留在 `backend/`。

## 开发与预览

使用 Node.js 22：

```bash
npm ci
npm run dev
```

访问 http://localhost:3000 。生产预览：

```bash
npm test
npm run build
npm run preview
```

构建生成 `out/`。预览服务器只监听本机 3000；端口被占用时可用 `PORT=3002 npm run preview`。未知路径返回 404，文章可以直接访问和刷新。

## 网站地址

在 `.env.local` 设置完整公开地址；HTTPS 未就绪时可以先使用 HTTP：

```dotenv
SITE_URL=http://你的域名
```

不要填写路径或末尾斜杠。HTTPS 开通后改为 `https://你的域名` 并重新构建。这个值用于 canonical、RSS、sitemap 和分享链接；未设置时使用本地地址，不适合直接发布。

服务器 CI 使用仓库变量 `SITE_URL`；Pages 构建使用工作流中独立配置的免费地址，不读取本机 `.env.local`。源码提交后推送到仓库不会自动复制本机环境变量。

## RSS 发布开关

RSS 默认关闭：页面不显示订阅入口，构建产物不包含 `rss.xml`，直接访问 `/rss.xml` 返回 404。提交代码本身不会开放 RSS。

GitHub 自动发布在 `DEPLOY_ENABLED=true` 时为构建开启 RSS。手动发布可使用 `RSS_ENABLED=true npm run build`，或在 `.env.local` 设置 `RSS_ENABLED=true`；本地预览继续保持 `false`。开关修改后需要重新构建（开发服务器需重启）。已经发布的旧版本需要重新部署关闭 RSS 的构建，才会移除旧链接。

## 写文章

复制 `templates/post.md` 到 `content/posts/你的文件名.md`，修改 front matter 与正文：

```yaml
---
slug: my-first-agent
title: "我的第一个 Agent"
summary: "描述这次实践的具体问题与结果。"
date: "2026-10-11"
tags: [Agent, 实践]
draft: true
---
```

- `slug` 是稳定的链接标识，仅允许小写字母、数字和单连字符。发布后尽量不改。`preparing` 是空状态保留值。
- 日期使用带引号的 `YYYY-MM-DD`；可选 `updated` 不能早于发布日期。
- `draft` 必须明确为布尔值；`true` 不生成文章页面，也不会进入首页、标签、系列、RSS 或 sitemap。日期不会自动定时发布。
- 本地写作时将文章临时设为 `draft: false` 并运行开发服务器，即可预览 `/blog/slug`；提交前改回 `true`。准备发布时改为 `false`。
- 新增文章路径后，如果开发服务器未识别，重启 `npm run dev`；生产构建会生成全部公开路径。
- 支持标准 Markdown、GFM 表格、引用、列表、图片和代码高亮；不支持 MDX 或正文 HTML。
- 图片放在 `public/images/`，正文使用 `![说明](/images/文件名.png)`。

没有公开文章时，文章与系列显示“准备中”，不会生成虚构内容或占位详情页。Astro 只为公开内容生成动态路径。

## 系列

在 `content/series.json` 添加定义：

```json
[
  {
    "slug": "agent-from-scratch",
    "title": "从零构建 Agent",
    "description": "用连续的实践记录搭建过程。"
  }
]
```

对应文章增加：

```yaml
series: agent-from-scratch
order: 1
```

公开文章按照 `order` 排序，详情页提供上一篇和下一篇。空系列不展示。重复 slug、重复系列顺序、未定义的系列和无效字段都会令构建失败，避免发布错误内容。

## 内容边界

`lib/content.mjs` 是统一内容适配层，页面只依赖其返回的数据。以后接入 CMS 时，替换文章读取与发布流程，继续复用文章、系列、标签页面。草稿过滤保留在内容适配层，正文生成 HTML 前进行清理。

`data/site.js` 管理站名、简介、GitHub、邮箱与网站地址。站点采用统一单栏布局：顶部显示 Evan Huang 和横向导航、居中的内容主栏，手机端顶部展开菜单；下滑时收起导航，上滑时重新出现；首页只展示简介、文章与系列入口。`src/pages/` 管理 Astro 页面与 RSS、sitemap、robots 静态端点，`src/layouts/` 管理公共页面结构，`src/components/` 管理站点外壳、列表、空状态和交互组件，`src/scripts/` 管理主题与加载动效。`css/blog.css` 保留全局基础样式和尚未迁移的内页样式。

### 组件与交互

Starwind UI 的 Astro 原生按钮由 `src/components/starwind/Button.astro` 统一封装，用于主题切换、手机导航和标签筛选。保留本网站的 Tailwind 样式，不套用组件库默认视觉主题。内容页面不加载 React 运行时，Motion 只负责加载层动效。站内跳转使用 Astro ClientRouter，只更新页面内容；流星背景通过 `transition:persist` 保留节点和动画进度。主题、导航和标签筛选按页面切换重新绑定，旧监听通过 AbortController 释放。入场动画仅在直接访问或刷新时播放。

### 样式逐步迁移

Tailwind 4 通过 `astro.config.mjs` 中的 Vite 插件接入，入口为 `css/tailwind.css`。工具类使用 `tw:` 前缀，扫描范围限定为 `src/`；暂不启用 Preflight，现有重置归入 `base` 层，使组件工具类可以覆盖基础规则。`compact`、`single`、`mobile` 自定义变体分别保持原有的 ≤1150px、≤900px、≤700px 断点。

- 加载界面和文字卷轴的布局、间距与字体使用 Tailwind；加载颜色与字体集中定义在入口文件的 `@theme` 中。
- 渐隐遮罩、进度条渐变、动画及减少动态效果的适配分别归入 `src/components/TextStream.module.css` 和 `src/components/LoadingIndicator.module.css`，由对应组件直接导入。
- 文字卷轴使用 Motion 的帧循环保持原有速度和滚动惯性，加载层使用 Motion 淡出；支持减少动态效果，并在加载结束时释放动画和事件监听。
- 站点外壳、顶部导航、页脚、首页区块、文章列表和空状态已使用 Tailwind；对应的旧规则已从 `blog.css` 删除。首页的系列卡片也使用工具类，系列内页暂保留原有样式。颜色通过主题变量复用既有色值。
- `css/themes.css` 统一管理深浅色调色板。顶部圆形按钮点击一次直接切换深色／浅色，选择保存在 `site-theme`；未手动选择时跟随系统。初始化脚本在首屏绘制前应用偏好。
- 后续按组件迁移：移走旧样式后再使用工具类，避免同一属性同时受全局 CSS 与 Tailwind 控制。含有特殊效果的组件继续保留 CSS Modules。

## 自动构建与发布

`.github/workflows/publish.yml` 在推送 main / master 时执行测试、构建并保存 `static-blog` 产物。服务器部署由 `DEPLOY_ENABLED` 控制；Cloudflare Pages 在测试通过后独立构建并发布。

完成以下配置后，将仓库变量 `DEPLOY_ENABLED` 设为 `true`：

| 类型      | 名称              | 用途                                            |
| --------- | ----------------- | ----------------------------------------------- |
| Variables | `SITE_URL`        | 网站公开地址，例如 `http://你的域名`            |
| Variables | `DEPLOY_ROOT`     | 服务器发布根目录，例如 `/var/www/agent-journey` |
| Variables | `DEPLOY_ENABLED`  | `true` 时启用部署                               |
| Secrets   | `SSH_HOST`        | 服务器 IP 或主机名                              |
| Secrets   | `SSH_USER`        | 部署用户                                        |
| Secrets   | `SSH_PORT`        | 可选，默认 22                                   |
| Secrets   | `SSH_PRIVATE_KEY` | 部署专用 SSH 私钥                               |
| Secrets   | `SSH_KNOWN_HOSTS` | 已通过可信渠道核对的服务器主机密钥              |

服务器需要 Linux、Nginx、rsync，部署用户需要拥有 `DEPLOY_ROOT` 的写入权限。为 GitHub 的 `production` environment 配置所需的变量/密钥或使用仓库级配置。

Nginx 的 `root` 指向 `$DEPLOY_ROOT/current`，将 `deploy/nginx.conf` 的示例路径与域名替换为实际值。不要覆盖已经配置的 HTTPS。

部署脚本先上传到 `releases/运行编号-重试编号`，全部成功后通过原子替换 `current` 符号链接切换版本。测试、构建或上传失败时保留上一版。新版本继承旧版带哈希的静态资源，避免已打开页面在切换后丢失脚本。旧版本不会自动删除；需要时由维护者清理。回滚可以将 `current` 原子切回已确认的旧 release。

当前仓库已配置自动发布：公开地址为 `http://ashyh666.me`，部署用户为 `blogdeploy`，发布根目录为 `/var/www/agent-journey`。推送 `main` 后自动测试、构建并部署；专用密钥仅保存在本机 SSH 目录和 GitHub Actions Secrets 中，不提交到仓库。HTTPS 开通后修改仓库变量 `SITE_URL` 并重新发布。

Cloudflare Pages 同时自动更新：[https://evan-huang-blog.pages.dev](https://evan-huang-blog.pages.dev)。现有 Direct Upload 项目通过 GitHub Actions 的 Wrangler 发布，保留原免费地址。仓库 Secrets `CLOUDFLARE_API_TOKEN` 保存仅包含当前账户 Pages 编辑权限的凭据，`CLOUDFLARE_ACCOUNT_ID` 保存账户 ID。Pages 使用独立的 `SITE_URL` 和 `RSS_ENABLED=true` 构建，网站地图、RSS 和规范链接指向 Pages 地址。推送 `main` 后，服务器和 Pages 在测试通过后分别部署；域名、DNS 与原服务器配置不变。

发布记录与维护方式见 `docs/production.md`。

## 旧版实验室

`backend/` 保留学习用实现。新版前端不请求 `/api/`，不需要启动 FastAPI 或 SQLite 服务。旧版部署说明在 `docs/legacy-deployment.md`，不用于当前博客发布。历史数据库没有删除；要停止线上旧服务时请单独处理。
