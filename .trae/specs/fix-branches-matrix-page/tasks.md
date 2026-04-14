# Tasks

- [x] Task 1: 重做 `/branches` 数据模型与页面骨架，使其以需求分支为主语而不是服务列表。
  - [x] SubTask 1.1: 梳理 `/branches` 所需聚合数据，确认是否复用现有 `task_branches` / `service_branch_stage_snapshots` / `stage-board` 数据
  - [x] SubTask 1.2: 移除当前 `service` 查询参数跳转 `/services/[id]` 的行为
  - [x] SubTask 1.3: 设计分支矩阵页的空态、错误态和基础筛选布局

- [x] Task 2: 实现分支矩阵页核心交互，交付“按分支查看跨服务进度”的最小可用体验。
  - [x] SubTask 2.1: 以 `task_branch` 为行展示矩阵或等价聚合列表
  - [x] SubTask 2.2: 展示服务/阶段状态、门禁状态、最新 PR 入口、最近同步时间
  - [x] SubTask 2.3: 提供跳转到任务详情、服务详情和 PR 的入口

- [x] Task 3: 完成分支主视角的筛选与验证，确保交互与导航名称一致。
  - [x] SubTask 3.1: 提供按阻塞、可推进、已合并、任务状态等条件的分支筛选
  - [x] SubTask 3.2: 手动验证 `/branches` 不再表现为服务入口页
  - [x] SubTask 3.3: 运行 `pnpm lint` 与 `pnpm typecheck`

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
