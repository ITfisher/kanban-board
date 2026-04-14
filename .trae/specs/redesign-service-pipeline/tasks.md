# Tasks

- [x] Task 1: 重建领域表结构与共享类型，落地仓库、需求分支、服务阶段、PR 历史、事件审计与服务主视角快照。
  - [x] SubTask 1.1: 更新 `lib/schema.ts`，移除旧 `service_branches` 中心模型并新增新表
  - [x] SubTask 1.2: 更新 `lib/db.ts` 初始化逻辑，按新项目方式建表
  - [x] SubTask 1.3: 更新 `lib/types.ts`，定义新领域 DTO 与枚举
  - [x] SubTask 1.4: 为服务主视角补充 `service_branch_stage_snapshots` 读模型

- [x] Task 2: 重建服务端 mapper 与 API 资源边界，提供任务、服务、需求分支、阶段看板和同步接口。
  - [x] SubTask 2.1: 重写任务与服务相关 mapper，移除旧 `serviceBranches` 聚合方式
  - [x] SubTask 2.2: 新增仓库、需求分支、服务阶段、服务主视角接口
  - [x] SubTask 2.3: 调整 GitHub 代理接口入参，改为显式仓库标识
  - [x] SubTask 2.4: 新增服务阶段看板接口 `GET /api/services/[id]/stage-board`

- [x] Task 3: 实现状态感知与门禁计算，驱动服务主视角的“可合并/已合并/阻塞”状态。
  - [x] SubTask 3.1: 提取阶段门禁规则与前置阶段判断逻辑
  - [x] SubTask 3.2: 实现同步引擎，统一 repo 级 PR/分支状态刷新
  - [x] SubTask 3.3: 在同步后刷新 `service_branch_stage_snapshots`
  - [x] SubTask 3.4: 记录 `events`、`merge_operations`、`sync_runs`

- [x] Task 4: 重构页面，交付任务视角、分支视角和服务主视角的最小可用 UI。
  - [x] SubTask 4.1: 重构 `app/tasks/[id]/page.tsx` 为“任务 + 需求分支聚合”视图
  - [x] SubTask 4.2: 重构 `app/branches/page.tsx` 为真正的分支矩阵页
  - [x] SubTask 4.3: 新增 `app/services/[id]/page.tsx` 服务主视角页，支持阶段 Tab
  - [x] SubTask 4.4: 在服务主视角页支持矩阵视图 / 列表视图切换

- [x] Task 5: 完成验证与收尾，确保新模型和服务主视角可正常工作。
  - [x] SubTask 5.1: 运行 `pnpm lint` 与 `pnpm typecheck`
  - [x] SubTask 5.2: 为阶段门禁或 mapper 增加必要测试
  - [x] SubTask 5.3: 手动验证服务主视角的阶段 Tab、已合并/未合并分组和矩阵视图

- [x] Task 6: 补齐验收失败项，完善阶段配置 UI、PR 状态展示、显式仓库 GitHub 接入与撤销合并审计。
  - [x] SubTask 6.1: 在服务管理或服务详情中补齐阶段流水线配置入口，支持启停、排序与目标分支编辑
  - [x] SubTask 6.2: 在服务主视角页面补充 PR 状态展示，并将其纳入阶段快照
  - [x] SubTask 6.3: 删除 GitHub 接口对 `serviceName -> repo slug` 的回退依赖，仅接受显式仓库标识
  - [x] SubTask 6.4: 为撤销合并补充审计事件、状态处理与测试

- [x] Task 7: 修复审计发现的设计对齐问题，消除旧设计残留带来的数据一致性与统计偏差。
  - [x] SubTask 7.1: 修复 `PATCH /api/task-branches/[id]`，当修改 `repositoryId` 时重校验已关联服务必须属于同一仓库
  - [x] SubTask 7.2: 将任务、服务页和仪表盘中的服务统计口径从 `service.name` 切换为 `service.id`
  - [x] SubTask 7.3: 清理或下线旧设计残留组件与死代码，例如 `components/git-branch-manager.tsx`
  - [x] SubTask 7.4: 同步更新 README、AGENTS、CLAUDE 与架构文档，移除 `service_branches`、`github_configs`、`testBranch/masterBranch` 等旧设计描述

- [x] Task 8: 补齐用户模型与仓库视角的实现闭环，完成最新重构方案中尚未落地的页面与资源。
  - [x] SubTask 8.1: 为 `users` / `task_assignments` 提供 API 与页面，替换当前主要依赖 `assigneeName` 字符串的负责人输入与展示
  - [x] SubTask 8.2: 新增 `/repositories` 页面，支持仓库维护、SCM 绑定和仓库下服务/需求分支概览
  - [x] SubTask 8.3: 审视导入/导出链路，明确旧备份格式的兼容策略或给出升级提示，避免误认为已自动迁移

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 6] depends on [Task 2]
- [Task 6] depends on [Task 3]
- [Task 6] depends on [Task 4]
- [Task 5] depends on [Task 4]
- [Task 5] depends on [Task 6]
- [Task 7] depends on [Task 2]
- [Task 7] depends on [Task 4]
- [Task 8] depends on [Task 1]
- [Task 8] depends on [Task 2]
- [Task 8] depends on [Task 4]
