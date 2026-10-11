> 旧版文字实验室的部署记录。仅供查看历史实现，新版博客请使用根目录 README。

# Zero to Tech · 全栈文字实验室

个人主页与文字实验室使用 Next.js App Router。按照模块 4.6 的方式 B，构建时生成完整的静态网站 `out/`，部署时由 Nginx 提供文件。

## 本地开发

```bash
cd ~/zero-to-tech
npm ci
cp .env.example .env.local  # 首次配置；将值改为 http://localhost:8000
npm run dev
```

打开 http://localhost:3000 。页面内容集中在 `data/site.js`。

## 构建和预览静态网站

`next.config.mjs` 已启用 `output: "export"`，同时保留本项目的 `outputFileTracingRoot` 配置。

```bash
npm run build
npm run preview
```

本地 `npm run preview` 只提供静态文件，没有 `/api/` 反向代理。
如果需要在本地静态预览中调用后端，构建时使用
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`，并通过
`http://localhost:3000` 访问，使其与后端允许的开发源一致。
部署到服务器前重新按下面的同源方式构建。

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

## 配置说明

| 文件 | 键 | 值 |
| --- | --- | --- |
| `.env.local` | `NEXT_PUBLIC_API_BASE_URL` | 本地开发填 `http://localhost:8000` |
| `.env.production` | `NEXT_PUBLIC_API_BASE_URL` | 线上留空，使用同源 `/api/` 路径 |
| `backend/.env` | `ALLOWED_ORIGINS` | `http://localhost:3000`；多个开发源用逗号分隔 |

首次本地运行后端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
fastapi dev
```

实际配置文件不进入 Git，示例配置可以提交。保留 CORS 和前端的
`credentials: "include"`，本地 3000 → 8000 仍然需要跨源请求。
历史记录保存在 `backend/history.db`，升级会保留旧数据；没有会话编号的旧记录不会分配给新访客。

## 部署到 Ubuntu 服务器

准备 Python 3.10+、Node.js 20 LTS 或更高版本及 Nginx。
下面以用户 `ubuntu`、项目路径 `/home/ubuntu/zero-to-tech` 为例，应用前按实际情况修改。

### 1. 更新代码与构建前端

```bash
cd ~/zero-to-tech
git status --short
git pull --ff-only
npm ci
```

首次部署时将 `.env.example` 复制为 `.env.production`；已有配置则编辑其中的
`NEXT_PUBLIC_API_BASE_URL`，确保值为空。

```bash
cp .env.example .env.production  # 仅首次部署
NEXT_PUBLIC_API_BASE_URL= npm run build
```

这里显式设置空值，防止服务器残留的 `.env.local` 覆盖生产配置。
构建产物在 `out/`，由 Nginx 提供，线上无需运行 Next.js 开发服务器。

### 2. 安装后端依赖

```bash
cd ~/zero-to-tech/backend
python3 -m venv --prompt=zero-to-tech .venv  # 首次部署
.venv/bin/pip install -r requirements.txt
```

首次部署复制 `backend/.env.example` 为 `backend/.env`。
已有 `.env` 时保留其他配置，只确保 `ALLOWED_ORIGINS` 已设置。

```bash
cp .env.example .env  # 在 backend 目录执行，仅首次部署
```

### 3. 交给 systemd

先修改 `deploy/zero-backend.service` 的 `User`、`WorkingDirectory` 和 `ExecStart` 路径。
如果旧的 nohup 服务占用 8000，确认它的进程号后停止旧进程，再启动新服务。

```bash
cd ~/zero-to-tech
sudo install -m 644 deploy/zero-backend.service /etc/systemd/system/zero-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now zero-backend
sudo systemctl status zero-backend --no-pager
```

后端只监听 `127.0.0.1:8000`，进程退出后自动重启，开机自动启动。

### 4. 配置 Nginx

将 `deploy/nginx.conf` 中的配置合并到服务器已有站点中，保留既有域名、HTTPS 和其他站点配置。
静态目录指向实际的 `out/`；`/api/` 转发到 `127.0.0.1:8000`。
`proxy_pass` 末尾没有斜杠，以保留完整的 `/api/` 路径。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

只有 `/api/` 会进入后端，`/docs` 和 `/openapi.json` 不通过此站点公开。
在云安全组及防火墙删除 8000 的公网放行规则，保留所需的 SSH、HTTP 和既有 HTTPS 规则。

### 5. 验证

在服务器执行：

```bash
curl -f http://127.0.0.1:8000/api/profile
curl -f http://localhost/api/profile
curl -i http://localhost/api/history
sudo systemctl is-enabled zero-backend
sudo systemctl is-active zero-backend
```

浏览器打开服务器网站，验证文字分析与历史记录。无痕窗口应有独立的历史。
Network 中 API 请求应使用与页面相同的源；公网直接访问 8000 应连接失败。
`/docs` 和 `/openapi.json` 应返回 404。

## 日常发布与日志

```bash
cd ~/zero-to-tech
git pull --ff-only
NEXT_PUBLIC_API_BASE_URL= npm run build  # 前端变化时
sudo systemctl restart zero-backend     # 后端变化时
sudo systemctl status zero-backend --no-pager
journalctl -u zero-backend -n 50 --no-pager
journalctl -u zero-backend -f            # Ctrl+C 退出
```

改 service 文件后先执行 `sudo systemctl daemon-reload`，再重启后端。
改 Nginx 配置后先 `sudo nginx -t`，成功后再 reload。

## 参考

- [模块 7.2 课程](https://xn--ygr25xpohxwz.com/zero-to-fullstack/lessons/module-7-2/)
- [Nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)
- [systemd service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)
