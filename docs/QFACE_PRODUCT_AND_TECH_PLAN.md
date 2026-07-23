# QFace 产品与技术方案

- 文档状态：V1 自建社区版
- 更新日期：2026-07-23
- 产品形态：固定面试题库 + 用户作答笔记 + 自建问答评论社区
- 内容来源：iFace 固定题库
- 部署基线：Cloudflare Pages + Pages Functions + D1

## 1. 核心判断

QFace 不再使用 giscus 作为正式评论方案。

giscus 的优势是低成本和低运维，但它的交互边界明显：样式难以完全统一，评论编辑/删除依赖 GitHub Discussions 的外部体验，也难以承载账号面板、笔记同步、采纳、积分、徽章这些社区能力。

QFace 当前采用自建评论与学习数据系统：

```text
Vite + React + TanStack Router
  ├─ iFace 题库 JSON
  ├─ URL 筛选状态
  ├─ localStorage 离线笔记 / 离线掌握记录 / 收藏 / UI 偏好
  ├─ Cloudflare Pages Functions API
  │    ├─ GitHub OAuth
  │    ├─ Session cookie
  │    ├─ 回答 / 回复 / 点赞 / 点踩 / 采纳
  │    └─ 云端作答 / 掌握记录
  └─ Cloudflare D1
```

## 2. 产品原则

1. 固定问题，题库由 iFace 同步。
2. 不导入、不展示 iFace 的 AI 答案。
3. 用户先写自己的理解，再看公开回答与讨论。
4. 评论、笔记、掌握记录归 QFace 自己管理；收藏属于本地轻偏好，不进云端数据库。
5. 页面风格保持轻、干净、弱边框，主体是题目和用户内容。
6. GitHub 只作为登录身份提供方，不作为评论存储。
7. 数据结构一次设计完整，避免上线后反复迁移核心关系。

## 3. 功能范围

### 首页

- 搜索题目、模块、标签。
- 按岗位筛选：前端、AI Agent、Golang、Java。
- 按模块筛选：如 JS基础、React、Agent架构。
- 显示筛选状态 chip。
- 展示题目列表、难度、掌握程度、讨论数。
- 支持难度和掌握程度排序。
- 筛选状态写入 URL，并用 localStorage 记忆。
- 登录后掌握星级同步到 D1。

### 题目详情

- 面包屑：题库 / 模块 / 题目。
- 模块名可打开抽屉，快速切换当前模块内题目。
- 展示题目、难度和标签。
- 收藏题目，收藏只写入本地缓存。
- 分享当前题目链接。
- 回答区：顶部是「我的作答」Markdown 编辑器，可在回答 / 详解草稿间切换。
- 支持 Markdown 快捷工具栏、CodeMirror 编辑态高亮、编辑 / 预览切换、折叠编辑器、全屏双栏编辑、GFM 表格与代码高亮。
- 回答和详解本地实时保存；登录后低频同步私密草稿到 D1。
- 公开回答或详解必须手动发布 / 更新，避免半成品自动进入社区回答流。
- 公开回答或详解进入社区回答流后，可被点赞、回复、采纳。
- 底部导航：`< 上一题` / `返回列表` / `下一题 >`。
- 支持左右方向键切题。

### 账号面板

- 未登录：显示本地账户状态和 GitHub 登录入口。
- 已登录：显示头像、昵称、GitHub login。
- 展示笔记数量、做过题数、收藏数量和完成进度。
- 完成进度支持按岗位 / 模块筛选，并缓存筛选偏好。
- 进入笔记页。
- 备份 / 导入 JSON。
- 云端同步状态。
- 仓库入口。
- 退出登录。

### 作答与笔记

- 每道题有「回答」和「详解」两份草稿。
- 未登录写入 localStorage。
- 登录后低频同步私密草稿到 D1，减少写入放大。
- 用户可分别发布回答和详解，也可只发布其中一个。
- 已公开后继续编辑只更新本地/私密草稿，需要点击更新才覆盖公开内容。
- 可取消公开；取消公开保留草稿，公开流内对应内容软删除。
- 登录后从 D1 拉取云端版本，并与本地草稿合并。
- 笔记页支持导出 Markdown，用于阅读、整理和迁移。
- `/notes` 展示所有笔记。
- 支持搜索笔记内容、题目、模块、标签。
- 支持 Markdown / JSON 导出，保留回答 / 详解双草稿和公开关联状态。

### 评论

- 每道题一个回答流。
- 用户公开自己的回答后进入回答流。
- 公开内容类型只保留回答、详解。
- 公开内容使用 Markdown 渲染，不启用原始 HTML。
- 支持按回答 / 详解筛选。
- 支持回复。
- 支持点赞 / 点踩。
- 作者可编辑自己的评论。
- 作者可删除自己的评论。
- 管理员/版主可删除评论。
- 管理员/版主可采纳回答或详解。
- 首页显示讨论数。

## 4. 技术栈

| 层 | 技术 |
| --- | --- |
| 构建 | Vite |
| UI | React 19 |
| 路由 | TanStack Router |
| 语言 | TypeScript |
| Markdown | CodeMirror、react-markdown、remark-gfm、rehype-highlight |
| API | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 |
| 登录 | GitHub OAuth + QFace session cookie |
| 本地状态 | localStorage |
| 部署 | Cloudflare Pages |
| 包管理/脚本 | Bun |
| 检查 | Biome、Vitest、TypeScript、Wrangler |

## 5. 数据模型

| 表 | 用途 |
| --- | --- |
| `users` | GitHub 用户映射、头像、昵称、角色 |
| `sessions` | QFace 登录会话 |
| `comments` | 公开回答、详解、回复、采纳状态 |
| `comment_votes` | 点赞 / 点踩 |
| `notes` | 回答草稿、详解草稿、公开回答关联、公开详解关联、掌握星级 |
| `moderation_logs` | 审核操作记录 |

设计重点：

- GitHub token 不入库；OAuth 只用于登录时换取用户信息。
- session cookie 为 HttpOnly，前端 JS 不能读取。
- 评论软删除，保留回复关系。
- 评论底层保留扩展枚举，当前产品层只露出回答 / 详解。
- `notes.answer_content` / `notes.explain_content` 分别保存两类草稿。
- `notes.answer_comment_id` / `notes.explain_comment_id` 分别指向公开回答和公开详解。
- 公开作答是草稿在社区里的投影；草稿继续编辑后，必须手动更新才覆盖公开内容。
- 收藏不入库，使用 localStorage 保存，降低云端写入和维护成本。
- 采纳状态在评论表内，确保每道题可以沉淀精品回答。

## 6. 为什么不用 Next.js

QFace 需要的是轻前端 + 边缘 API，不需要 Next.js 的 SSR、Server Actions 或 Node runtime。Vite + TanStack Router 保持前端轻快，Pages Functions 承担 API，D1 承担持久化，职责更清晰。

## 7. 部署与运维

首发使用 Cloudflare Pages：

- 构建命令：`bun run build`
- 产物目录：`dist`
- 前端路由回退：Cloudflare Pages SPA fallback
- API：`functions/api/*`
- 数据库迁移：`migrations/*.sql`

这套结构没有自购服务器，也没有常驻进程。需要维护的是：

1. D1 数据库迁移。
2. GitHub OAuth App 配置。
3. Cloudflare Pages 环境变量。
4. 题库更新时重新生成 JSON。

## 8. 当前结论

QFace 的正式方案是：

```text
Vite + React + TanStack Router + Cloudflare Pages Functions + D1 + GitHub OAuth
```

它比 giscus 方案重一点，但换来了完整的站内体验：统一样式、可编辑删除评论、可同步笔记、可展示讨论数、可做采纳与社区治理。这个结构仍然低运维，不需要单独服务器。
