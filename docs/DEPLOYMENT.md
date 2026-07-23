# QFace Cloudflare Pages 部署

QFace 使用 Cloudflare Pages 托管前端，Pages Functions 提供 API，D1 保存用户、评论、笔记和互动数据。不需要自购服务器、维护 Node 常驻进程或单独部署数据库服务。

## 1. 结构

```text
用户
  ↓
Cloudflare Pages
  ├─ Vite 静态产物
  ├─ Pages Functions API
  │    ├─ GitHub OAuth 登录
  │    ├─ Session cookie
  │    ├─ 回答 / 回复 / 点赞 / 采纳
  │    └─ 作答同步 / 私密公开 / 导出
  └─ D1 数据库
```

## 2. Cloudflare Pages 设置

| 项目 | 值 |
| --- | --- |
| Framework preset | Vite |
| Build command | `bun run build` |
| Build output directory | `dist` |
| Root directory | `/` |

QFace 是纯 SPA，不放置自定义 `_redirects`，由 Cloudflare Pages 的 SPA 回退行为处理 `/q/js-001`、`/notes` 这类前端路由。

## 3. D1

创建数据库：

```bash
wrangler d1 create qface
```

把返回的 `database_id` 写入 [wrangler.jsonc](../wrangler.jsonc)：

```jsonc
{
  "binding": "DB",
  "database_name": "qface",
  "database_id": "替换为 Cloudflare 返回的 database_id",
  "migrations_dir": "migrations"
}
```

应用迁移：

```bash
bun run db:migrate:remote
```

本地开发迁移：

```bash
bun run db:migrate:local
```

## 4. GitHub OAuth

在 GitHub 创建 OAuth App：

| 项目 | 本地值 | 生产值 |
| --- | --- | --- |
| Homepage URL | `http://localhost:8788` | `https://qface.dogxi.me` |
| Authorization callback URL | `http://localhost:8788/api/auth/github/callback` | `https://qface.dogxi.me/api/auth/github/callback` |

Cloudflare Pages 使用 `wrangler.jsonc` 作为配置源时，普通变量需要写进 `vars`，只有加密变量通过 Dashboard 或 Wrangler Secret 管理。

已在 `wrangler.jsonc` 管理的普通变量：

```jsonc
{
  "vars": {
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "SITE_URL": "https://qface.dogxi.me",
    "VITE_QFACE_REPO_URL": "https://github.com/dogxii/QFace"
  }
}
```

需要在 Cloudflare Pages Production Secrets 中配置的加密变量：

```dotenv
GITHUB_CLIENT_SECRET=
COOKIE_SECRET=
```

`COOKIE_SECRET` 建议使用 32 字节以上随机字符串。

## 5. 发布流程

```bash
bun install
bun run content:generate
bun run check
bun run test
bun run build
bun run db:migrate:remote
```

Cloudflare Pages 连接 GitHub 后，push 到主分支即可自动构建。

## 6. 数据备份

QFace 的核心数据都在 D1：

- 用户
- session
- 评论
- 点赞/点踩
- 作答与笔记
- 审核日志

收藏只保存在用户浏览器本地。用户侧可以在笔记页导出 Markdown，在账号面板备份 / 导入 JSON。站点侧可以通过 Cloudflare D1 导出数据库备份。
