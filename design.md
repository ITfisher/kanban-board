# 项目管理看板 — 系统设计文档

> 技术栈：Next.js 15 App Router · React 19 · TypeScript · Tailwind CSS v4 · SQLite (better-sqlite3 + Drizzle ORM)

---

## 一、整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Browser)                        │
│  /dashboard  /tasks  /tasks/[id]  /services/[id]  /branches │
│  /repositories  /settings                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP (fetch)
┌──────────────────────▼──────────────────────────────────────┐
│                    Next.js API Routes                        │
│  /api/tasks/**   /api/task-branches/**   /api/services/**   │
│  /api/repositories/**   /api/scm-connections/**             │
│  /api/github/**  (GitHub 代理，避免 CORS & Token 泄露)       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Drizzle ORM
┌──────────────────────▼──────────────────────────────────────┐
│               SQLite  data/kanban.db                        │
│  WAL 模式 · 单例连接 · 启动时自动迁移                         │
└─────────────────────────────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│         GitHub.com / GitHub Enterprise (SCM)                │
│  Pull Request · Branch Diff · CI Checks · Merge Status      │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、ER 图（完整实体关系）

```mermaid
erDiagram
    repositories {
        text id PK
        text name
        text provider
        text domain
        text owner
        text slug
        text default_branch
        text description
        text created_at
        text updated_at
        text archived_at
    }

    users {
        text id PK
        text name
        text email
        text avatar_url
        text source
        text created_at
        text updated_at
    }

    tasks {
        text id PK
        text title
        text description
        text status
        text priority
        text owner_user_id FK
        text assignee_name
        text assignee_avatar
        text jira_url
        text created_at
        text updated_at
        text completed_at
    }

    task_assignments {
        text id PK
        text task_id FK
        text user_id FK
        text role
        text created_at
    }

    task_comments {
        text id PK
        text task_id FK
        text content
        text author_name
        text created_at
        text updated_at
    }

    task_branches {
        text id PK
        text task_id FK
        text repository_id FK
        text name
        text title
        text description
        text status
        text created_by_user_id FK
        text created_at
        text updated_at
        text closed_at
        text last_synced_at
    }

    task_branch_developers {
        text id PK
        text task_branch_id FK
        text user_id FK
        text role
        text created_at
    }

    services {
        text id PK
        text repository_id FK
        text name
        text description
        text root_path
        text dependencies
        int  is_active
        text created_at
        text updated_at
    }

    service_stages {
        text id PK
        text service_id FK
        text name
        text key
        text description
        int  position
        text target_branch
        int  is_active
        text created_at
        text updated_at
    }

    task_branch_services {
        text id PK
        text task_branch_id FK
        text service_id FK
        text repository_id FK
        text status
        text created_at
        text updated_at
    }

    pull_requests {
        text id PK
        text repository_id FK
        text task_branch_id FK
        text service_id FK
        text service_stage_id FK
        text provider
        text provider_domain
        int  external_number
        text title
        text html_url
        text source_branch
        text target_branch
        text state
        int  merged
        int  mergeable
        text mergeable_state
        text head_sha
        text base_sha
        int  draft
        text author_user_id FK
        text created_at
        text updated_at
        text closed_at
        text merged_at
        text last_synced_at
    }

    service_branch_stage_snapshots {
        text id PK
        text repository_id FK
        text service_id FK
        text task_id FK
        text task_branch_id FK
        text service_stage_id FK
        text stage_status
        text gate_status
        int  is_actionable
        text action_type
        text latest_pull_request_id FK
        int  latest_pull_request_number
        text latest_pull_request_state
        text latest_pull_request_url
        text latest_pull_request_title
        int  latest_pull_request_mergeable
        text latest_pull_request_mergeable_state
        int  latest_pull_request_draft
        text latest_pull_request_checks
        text task_title
        text task_status
        text branch_name
        text developer_user_ids
        text developer_names
        text last_synced_at
        text updated_at
    }

    scm_connections {
        text id PK
        text name
        text provider
        text domain
        text owner
        text token
        int  is_default
        text created_at
        text updated_at
    }

    repository_connections {
        text id PK
        text repository_id FK
        text scm_connection_id FK
        text created_at
    }

    events {
        text id PK
        text repository_id FK
        text task_id FK
        text task_branch_id FK
        text service_id FK
        text service_stage_id FK
        text pull_request_id FK
        text actor_user_id FK
        text event_type
        text summary
        text payload
        text occurred_at
        text created_at
    }

    merge_operations {
        text id PK
        text repository_id FK
        text task_id FK
        text task_branch_id FK
        text service_id FK
        text service_stage_id FK
        text pull_request_id FK
        text operation_type
        text status
        text summary
        text payload
        text started_at
        text completed_at
        text created_at
        text updated_at
    }

    sync_runs {
        text id PK
        text repository_id FK
        text service_id FK
        text task_branch_id FK
        text scope
        text status
        text summary
        text payload
        text started_at
        text completed_at
        text created_at
        text updated_at
    }

    settings {
        text id PK
        int  notifications
        int  dark_mode
        int  compact_view
        int  show_assignee_avatars
        text default_priority
        text branch_prefix
    }

    %% ── 核心关联 ──
    tasks                        }o--o{ task_assignments          : "task_id"
    users                        }o--o{ task_assignments          : "user_id"
    users                        |o--o{ tasks                     : "owner_user_id"
    tasks                        |o--o{ task_comments             : "task_id"
    tasks                        |o--o{ task_branches             : "task_id"
    repositories                 |o--o{ task_branches             : "repository_id"
    users                        |o--o{ task_branches             : "created_by_user_id"
    task_branches                |o--o{ task_branch_developers    : "task_branch_id"
    users                        |o--o{ task_branch_developers    : "user_id"
    repositories                 |o--o{ services                  : "repository_id"
    services                     |o--o{ service_stages            : "service_id"
    task_branches                |o--o{ task_branch_services      : "task_branch_id"
    services                     |o--o{ task_branch_services      : "service_id"
    repositories                 |o--o{ task_branch_services      : "repository_id"
    task_branches                |o--o{ pull_requests             : "task_branch_id"
    services                     |o--o{ pull_requests             : "service_id"
    service_stages               |o--o{ pull_requests             : "service_stage_id"
    repositories                 |o--o{ pull_requests             : "repository_id"
    users                        |o--o{ pull_requests             : "author_user_id"
    repositories                 |o--o{ repository_connections    : "repository_id"
    scm_connections              |o--o{ repository_connections    : "scm_connection_id"
    service_branch_stage_snapshots }o--|| services               : "service_id"
    service_branch_stage_snapshots }o--|| service_stages         : "service_stage_id"
    service_branch_stage_snapshots }o--|| task_branches          : "task_branch_id"
    service_branch_stage_snapshots }o--|| tasks                  : "task_id"
    service_branch_stage_snapshots }o--o| pull_requests          : "latest_pull_request_id"
```

---

## 三、核心聚合关系图（简化视角）

```mermaid
graph TD
    subgraph 凭证层
        SCM[scm_connections<br/>SCM凭证]
        RC[repository_connections<br/>仓库↔凭证绑定]
    end

    subgraph 基础设施层
        REPO[repositories<br/>仓库]
        SVC[services<br/>服务]
        STG[service_stages<br/>阶段流水线<br/>dev→test→prod]
    end

    subgraph 任务层
        TASK[tasks<br/>任务卡片]
        TC[task_comments<br/>任务备注]
        TA[task_assignments<br/>任务指派]
        USR[users<br/>用户]
    end

    subgraph 分支层
        TB[task_branches<br/>任务分支]
        TBD[task_branch_developers<br/>分支开发者]
        TBS[task_branch_services<br/>分支↔服务关联]
    end

    subgraph PR与状态层
        PR[pull_requests<br/>PR记录]
        SNAP[service_branch_stage_snapshots<br/>看板快照/读模型]
    end

    subgraph 审计层
        EV[events<br/>事件日志]
        MO[merge_operations<br/>合并操作]
        SR[sync_runs<br/>同步运行]
    end

    SCM --> RC --> REPO
    REPO --> SVC --> STG
    REPO --> TB
    TASK --> TB
    TASK --> TC
    TASK --> TA --> USR
    TB --> TBD --> USR
    TB --> TBS --> SVC
    TB --> PR
    SVC --> PR
    STG --> PR
    PR --> SNAP
    SVC --> SNAP
    STG --> SNAP
    TB --> SNAP
    TASK --> SNAP

    PR -.-> EV
    PR -.-> MO
    TB -.-> SR
```

---

## 四、业务流转状态机

### 4.1 任务状态流转

```mermaid
stateDiagram-v2
    [*] --> backlog : 创建任务
    backlog --> todo : 开始规划
    todo --> in_progress : 开发启动
    in_progress --> testing : 提交测试
    testing --> done : 测试通过
    testing --> in_progress : 打回修复
    done --> [*]

    note right of in_progress
        此阶段创建 task_branch
        并关联 service
    end note

    note right of testing
        此阶段对各 service_stage
        提交 pull_request
    end note
```

### 4.2 PR 阶段流水线流转

```mermaid
stateDiagram-v2
    [*] --> idle : 分支关联服务后初始化快照

    idle --> pending : 创建 PR (state=open, draft=false)
    pending --> draft : PR 转草稿
    draft --> pending : PR 就绪

    pending --> checking : CI 开始运行
    checking --> mergeable : CI 通过 + mergeable=true
    checking --> blocked : CI 失败 / conflicts
    blocked --> checking : 修复推送

    mergeable --> merged : PR 合并
    merged --> [*]

    note right of merged
        合并后写入 merge_operations
        并触发 events 记录
        快照 stage_status → merged
    end note
```

### 4.3 快照状态字段说明

| 字段 | 可选值 | 含义 |
|------|--------|------|
| `stage_status` | `idle` / `pending` / `merged` / `closed` | 当前阶段整体状态 |
| `gate_status` | `unknown` / `open` / `passing` / `failing` / `blocked` | CI/合并门禁状态 |
| `is_actionable` | `0` / `1` | 是否有可执行动作（创建/合并 PR）|
| `action_type` | `create_pr` / `merge_pr` / `null` | 当前可执行的动作类型 |

---

## 五、索引设计

```
idx_task_branches_task_id                → task_branches(task_id)
idx_task_branches_repository_id          → task_branches(repository_id)
idx_task_branch_services_branch_id       → task_branch_services(task_branch_id)
idx_task_branch_services_service_id      → task_branch_services(service_id)
idx_service_stages_service_id            → service_stages(service_id)
idx_services_repository_name [UNIQUE]    → services(repository_id, name)
idx_service_stages_service_key [UNIQUE]  → service_stages(service_id, key)
idx_service_stages_service_position [UNIQUE] → service_stages(service_id, position)
idx_repository_connections_repo_connection [UNIQUE] → repository_connections(repository_id, scm_connection_id)
idx_pull_requests_branch_stage           → pull_requests(task_branch_id, service_id, service_stage_id)
idx_events_branch_id                     → events(task_branch_id)
idx_merge_operations_branch_id           → merge_operations(task_branch_id)
idx_merge_operations_pull_request_id     → merge_operations(pull_request_id)
idx_sync_runs_scope                      → sync_runs(repository_id, service_id, task_branch_id)
idx_snapshots_service_stage              → service_branch_stage_snapshots(service_id, service_stage_id)
idx_task_comments_task_id                → task_comments(task_id)
```

---

## 六、关键设计决策

### 6.1 `service_branch_stage_snapshots` — 读模型（Read Model）

服务看板主视图（`/services/[id]`）需要同时展示：分支名、开发者、PR 状态、CI 检查、任务标题。若实时 JOIN 多张表，查询复杂且慢。

**解决方案**：快照表冗余所有展示字段，由写入路径（PR 同步、状态变更）主动更新。读取时无需 JOIN，直接 SELECT。

```
写入路径：
  创建/更新 PR → 更新 service_branch_stage_snapshots
  分支关联服务  → 初始化快照行
  同步 CI 状态  → 更新 latest_pull_request_checks 等字段

读取路径：
  /services/[id] 看板 → SELECT * FROM service_branch_stage_snapshots
                         WHERE service_id = ? ORDER BY service_stage_id, updated_at
```

### 6.2 PR 四元组唯一性

一条 PR 记录由以下四个维度共同确定：

```
(task_branch_id, service_id, service_stage_id, repository_id)
```

同一个分支可以对同一服务的不同阶段（dev / test / prod）分别提 PR，记录独立存储，互不干扰。

### 6.3 `task_branch_services` 约束同仓库

`repository_id` 冗余在关联表中，在应用层确保：**分支只能关联同仓库下的服务**，防止跨仓库错误关联。

### 6.4 SCM 凭证解耦

```
repositories ──< repository_connections >── scm_connections
```

一个仓库可绑定多套 SCM 凭证（如同时支持 GitHub.com Token 和 GHE Token）。API 路由会根据仓库的 `domain` 字段自动路由到对应 endpoint：
- `domain = github.com` → `https://api.github.com`
- `domain = ghe.example.com` → `https://ghe.example.com/api/v3`

### 6.5 审计表设计（宽引用模式）

`events`、`merge_operations`、`sync_runs` 均采用**可选外键**模式：所有引用字段（`repository_id`、`task_branch_id` 等）均可为 NULL，记录时按实际上下文填入，方便按任意维度查询历史。

---

## 七、页面与数据来源映射

| 页面路由 | 主要数据来源 | 说明 |
|----------|-------------|------|
| `/dashboard` | `tasks` | 任务统计、状态/优先级分布 |
| `/tasks` | `tasks` + `task_assignments` | 看板五列展示，拖拽改状态 |
| `/tasks/[id]` | `tasks` + `task_branches` + `task_branch_services` + `task_branch_developers` + `pull_requests` + `task_comments` | 任务详情全量信息 |
| `/services/[id]` | `service_branch_stage_snapshots` | 读模型直接驱动，无多表 JOIN |
| `/branches` | `services` | 服务选择入口，跳转至服务主视图 |
| `/repositories` | `repositories` + `repository_connections` + `scm_connections` | 仓库注册与 SCM 绑定管理 |
| `/settings` | `settings` + `scm_connections` | 全局设置与凭证配置 |
