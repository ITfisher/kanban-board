# 项目管理看板 (Kanban Board)

一个基于 **Next.js 15 + React 19 + TypeScript** 的中文项目管理看板。应用当前以 **SQLite + Drizzle ORM + Next.js Route Handler** 为持久化核心，采用“仓库 -> 需求分支 -> 服务阶段流水线 -> PR/快照”的新模型，覆盖任务看板、仓库与服务登记、阶段化 PR 流转和团队概览。

## ✨ 功能概览

- **仪表盘**：统计任务数量、完成率、优先级/状态分布、服务与成员工作量
- **行情分析**：聚合币安广场热度、每日高频币种和合约涨幅波动，输出建议交易币种
- **任务看板**：五阶段流转（待规划 → 待开发 → 开发中 → 待审核 → 已完成）、拖拽移动、筛选搜索、批量删除
- **任务详情**：按需求分支聚合查看挂靠服务、开发者、阶段状态与 PR 历史
- **服务管理**：维护服务、仓库归属和阶段流水线入口
- **服务主视角**：按服务查看各需求分支在不同阶段上的状态、PR 与可操作性
- **仓库管理**：维护仓库根实体与 SCM 显式绑定
- **系统设置**：保存 UI 偏好与多套 GitHub / GitHub Enterprise SCM 连接

## 技术栈

- **框架**：Next.js 15 App Router
- **UI**：React 19、TypeScript、Tailwind CSS v4、shadcn/ui、Radix UI、Lucide React
- **编辑器**：`@uiw/react-md-editor`
- **持久化**：SQLite（`data/kanban.db`）+ Drizzle ORM + Route Handler
- **分析**：Vercel Analytics
- **包管理**：pnpm

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。首页会自动跳转到 `/dashboard`。

## Docker 部署

仓库现在提供了可直接落地的一键 Docker 部署方式：

```bash
./scripts/docker-deploy.sh
```

如果你不想通过脚本，也可以直接执行：

```bash
docker compose up -d --build
```

服务启动后访问 [http://localhost:3000](http://localhost:3000)。

### Docker 文件说明

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 多阶段构建 Next.js 生产镜像，输出 standalone 运行时 |
| `docker-compose.yml` | 一条命令构建并启动容器，同时挂载 SQLite 持久化卷 |
| `scripts/docker-deploy.sh` | 一键执行 `docker compose up -d --build` |

### SQLite 初始化行为

- 数据库文件位于 `data/kanban.db`
- 首次启动时自动创建 `data/` 目录、`kanban.db` 文件和全部表结构
- `settings` 单例行也会在初始化时自动补齐
- 不需要手动先执行 SQL 初始化脚本

### SQLite 表设计约束

- 当前表结构以 `repositories` 为根实体，需求分支和服务都显式挂靠到仓库
- 阶段化流转通过 `service_stages`、`pull_requests`、`service_branch_stage_snapshots` 表达，而不是在任务里内嵌旧分支 blob
- 数据库初始化明确不使用外键约束，实体关联和级联清理由应用层保证
- 数据库层仍尽量保持弱耦合，跨表清理由 `app/api/*` 在应用层显式处理

### 数据持久化

- `docker-compose.yml` 默认把 `/app/data` 挂载到命名卷 `kanban_data`
- 重建容器不会丢失 SQLite 数据；如需清空数据，删除对应 volume 即可
- 如需改端口，可在启动前设置环境变量：`PORT=3001 ./scripts/docker-deploy.sh`

## ✅ 推荐验证命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

> 当前仓库仅提供一个 README 对齐测试；交付时以 lint / typecheck / README 测试 / build 作为主要验证手段。

## 🌐 页面地图

| 路由 | 说明 | 主要组件 / 源码入口 |
| --- | --- | --- |
| `/` | 启动页，自动跳转到仪表盘 | `app/page.tsx` |
| `/dashboard` | 数据总览、状态/优先级/服务统计 | `app/dashboard/page.tsx` |
| `/market-analysis` | 聚合热度、频次和波动后的行情分析页 | `app/market-analysis/page.tsx` |
| `/tasks` | 主看板页面，包含拖拽、筛选、批量操作 | `app/tasks/page.tsx`、`TaskCard`、`CreateTaskDialog`、`SearchFilter` |
| `/tasks/[id]` | 单任务详情页，按需求分支聚合展示服务、开发者和阶段状态 | `app/tasks/[id]/page.tsx` |
| `/services` | 服务登记与仓库归属配置 | `app/services/page.tsx`、`AddServiceDialog` |
| `/services/[id]` | 服务主视角页，支持阶段 Tab 与矩阵/列表切换 | `app/services/[id]/page.tsx` |
| `/repositories` | 仓库登记、SCM 绑定和仓库概览 | `app/repositories/page.tsx` |
| `/branches` | 服务流水线入口，选择服务后进入服务主视角 | `app/branches/page.tsx` |
| `/settings` | 偏好设置与 SCM 连接配置 | `app/settings/page.tsx` |
| `/api/github/*` | 服务端 GitHub 代理接口 | `app/api/github/pull-request/route.ts`、`app/api/github/pr-status/route.ts`、`app/api/github/branch-diff/route.ts`、`app/api/github/check-merge-status/route.ts` |

### 页面导航图

```mermaid
graph TD
  Root["/"] --> Dashboard["/dashboard"]
  Dashboard --> Sidebar["Sidebar 导航"]
  Sidebar --> MarketAnalysis["/market-analysis"]
  Sidebar --> Tasks["/tasks"]
  Sidebar --> Services["/services"]
  Sidebar --> Repositories["/repositories"]
  Sidebar --> Branches["/branches"]
  Sidebar --> Settings["/settings"]
  Tasks --> TaskDetail["/tasks/[id]"]
  Services --> ServiceDetail["/services/[id]"]
```

## 🔄 数据流

```mermaid
graph LR
  User[用户操作] --> Page[页面 / 业务组件]
  Page --> ApiFetch[fetch /api/*]
  ApiFetch --> AppApi[Next.js Route Handler]
  AppApi --> DB[(SQLite / data/kanban.db)]
  AppApi --> GitHub[GitHub / GitHub Enterprise API]
  Settings[设置页] --> ApiFetch
  Services[服务页] --> ApiFetch
  Tasks[任务页] --> ApiFetch
  Branches[分支页] --> ApiFetch
  TaskDetail[任务详情页] --> ApiFetch
```

## 🧩 核心组件协作图

```mermaid
graph TD
  MainLayout[MainLayout] --> Sidebar
  DashboardPage[Dashboard Page] --> MainLayout
  TasksPage[Tasks Page] --> MainLayout
  ServicesPage[Services Page] --> MainLayout
  BranchesPage[Branches Page] --> MainLayout
  SettingsPage[Settings Page] --> MainLayout

  TasksPage --> SearchFilter
  TasksPage --> CreateTaskDialog
  TasksPage --> TaskCard
  TaskCard --> TaskDetailDialog

  ServicesPage --> AddServiceDialog
  TaskDetailDialog --> GithubApi[app/api/github/*]
  BranchesPage --> GithubApi
  SettingsPage --> AppApi[app/api/*]
  AppApi --> Sqlite[(SQLite)]
```

## 持久化模型

核心业务数据保存在 `data/kanban.db` 中，由 `app/api/*` 路由统一读写：

| 表 | 说明 |
| --- | --- |
| `repositories` | 仓库根实体，统一承载服务、需求分支和 SCM 绑定 |
| `services` | 服务登记信息，显式关联 `repository_id` |
| `service_stages` | 每个服务自定义的阶段流水线 |
| `tasks` | 任务主表，保存标题、描述、状态、优先级、负责人、JIRA、时间戳 |
| `task_branches` | 需求分支主实体，属于任务且属于仓库 |
| `task_branch_services` | 需求分支与同仓库服务的挂靠关系 |
| `task_branch_developers` | 需求分支开发者关系 |
| `pull_requests` | 各服务阶段的 PR 历史 |
| `service_branch_stage_snapshots` | 服务主视角当前展示态与操作态 |
| `scm_connections` / `repository_connections` | SCM 连接与仓库显式绑定 |
| `events` / `merge_operations` / `sync_runs` | 审计、合并与同步历史 |
| `settings` | 应用设置单例 |

### Task（摘要）

```ts
interface Task {
  id: string
  title: string
  description: string
  status: "backlog" | "todo" | "in-progress" | "testing" | "done" | "closed"
  priority: "low" | "medium" | "high"
  ownerUserId?: string
  assignee?: { name: string; avatar?: string }
  jiraUrl?: string
  taskBranches?: TaskBranch[]
  createdAt?: string
  updatedAt?: string
}
```

### TaskBranch（摘要）

```ts
interface TaskBranch {
  id: string
  taskId: string
  repositoryId: string
  name: string
  status: "active" | "merged" | "closed" | "archived"
  developers?: User[]
  services?: Service[]
  pullRequests?: PullRequestRecord[]
  snapshots?: ServiceBranchStageSnapshot[]
}
```

### Service（摘要）

```ts
interface Service {
  id: string
  repositoryId?: string
  name: string
  description: string
  rootPath?: string
  dependencies: string[]
  stages?: ServiceStage[]
}
```

### ScmConnection（摘要）

```ts
interface ScmConnectionMeta {
  id: string
  name: string
  provider: "github" | "github-enterprise"
  domain: string
  owner: string
  isDefault?: boolean
}
```

## 目录结构

```text
kanban-board/
├── app/
│   ├── api/
│   │   ├── import/route.ts
│   │   ├── github/
│   │   │   ├── branch-diff/route.ts
│   │   │   ├── check-merge-status/route.ts
│   │   │   ├── pr-status/route.ts
│   │   │   └── pull-request/route.ts
│   │   ├── services/
│   │   ├── settings/route.ts
│   │   └── tasks/
│   ├── branches/page.tsx
│   ├── dashboard/page.tsx
│   ├── market-analysis/page.tsx
│   ├── services/page.tsx
│   ├── settings/page.tsx
│   ├── tasks/
│   │   ├── [id]/page.tsx
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── loading.tsx
│   └── page.tsx
├── components/
│   ├── ui/                      # shadcn/ui 基础组件
│   ├── add-service-dialog.tsx
│   ├── create-task-dialog.tsx
│   ├── main-layout.tsx
│   ├── search-filter.tsx
│   ├── sidebar.tsx
│   ├── task-card.tsx
│   └── task-detail-dialog.tsx
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── branch-generator.ts
│   ├── db.ts
│   ├── github-utils.ts
│   ├── import-export.ts
│   ├── schema.ts
│   ├── service-branch-utils.ts
│   ├── service-data.ts
│   ├── task-data.ts
│   ├── task-utils.ts
│   └── utils.ts
├── public/
├── eslint.config.mjs
├── next.config.mjs
├── package.json
└── README.md
```

## 📁 仓库约定

| 约定 | 说明 |
| --- | --- |
| `app/**/page.tsx` | 仅负责页面级组合、状态拼装和路由入口 |
| `components/ui/*` | shadcn/ui 基础组件，尽量保持无业务语义 |
| `components/*.tsx` | 业务组件层，承载对话框、卡片、筛选器等交互 |
| `app/api/tasks/*` / `app/api/services/*` / `app/api/settings/*` | 业务数据的唯一服务端读写边界 |
| `app/api/github/*` | 与 GitHub 通信的唯一服务端边界；不要在客户端直接持有 token |
| `lib/db.ts` / `lib/schema.ts` | SQLite 连接、建表与 Drizzle schema 定义 |
| `lib/*-data.ts` | 数据库行到前端模型的转换层 |
| `lib/*.ts` | 纯工具或无 UI 逻辑的封装，例如分支名生成与导入校验 |
| `@/*` 路径别名 | 统一通过 `@/` 引用根目录模块，避免深层相对路径 |
| 中文文案优先 | UI 文字、README 说明、默认提示均以中文为主 |

### 开发时建议遵守

1. **页面数据统一走 `app/api/*`**，不要在组件里直接操作数据库或私自维护旁路持久化
2. **GitHub 配置保存在数据库中，但 token 只允许服务端读取**；客户端只能通过 `app/api/github/*` 间接访问
3. **新增任务 / 服务字段时，同步检查**：Drizzle schema、Route Handler、前端共享类型、详情页、统计页和 README 数据模型
4. **保持页面职责清晰**：路由层组合、组件层交互、`lib/` 层纯逻辑、`app/api/*` 层数据边界
5. 仓库中存在少量**未接入当前页面流的原型组件**；新增功能前先确认是否为当前主路径的一部分

## GitHub 集成说明

所有 GitHub 请求都通过 `app/api/github/` 下的 Route Handler 转发，支持：

- GitHub.com
- GitHub Enterprise（当 `domain !== github.com` 时，自动走 `https://{domain}/api/v3/...`）

当前接口职责：

- `POST /api/github/pull-request`：创建 PR
- `POST /api/github/pr-status`：查询 PR / CI 状态
- `POST /api/github/branch-diff`：比较分支与测试/主分支差异
- `POST /api/github/check-merge-status`：检查分支是否已经合并

## 构建与发布

```bash
pnpm build
pnpm start
```

默认输出适用于 Next.js 标准部署。若使用 Vercel，可直接导入仓库部署。
