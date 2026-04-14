# 研发效能管理系统重构 Spec

## Why
当前系统仍以“任务下的服务分支记录”为核心，无法准确表达 Monorepo 多服务挂靠同一需求分支、服务自定义阶段流水线、以及服务主视角下的可合并状态。需要按新项目视角重建领域模型、服务主视角页面和状态读模型，为后续实现稳定的阶段化 PR 流转提供基础。

## What Changes
- 重建核心数据模型，从 `task -> service_branches[]` 迁移为 `task -> task_branches -> services/stages -> pull_requests/events`
- 新增仓库实体、需求分支实体、服务阶段流水线、PR 历史、同步历史、事件审计与服务主视角快照
- 新增服务主视角页面 `services/[id]`，支持阶段 `Tab` 与阶段横向矩阵两种查看方式
- 新增服务阶段看板接口，支持查看当前服务下“已合并 / 未合并”需求分支及可操作状态
- 新增用户模型与任务负责人/分支开发者关联，用于统计与归属
- **BREAKING** 废弃当前 `service_branches` 为中心的读写方式
- **BREAKING** 废弃当前 `services.repository/testBranch/masterBranch` 作为发布模型中心字段的方式
- **BREAKING** 废弃当前按 `serviceName -> repo slug` 推导仓库的 GitHub 接入方式

## Impact
- Affected specs: 任务管理、服务管理、分支流转、GitHub 集成、状态同步、用户统计
- Affected code: `lib/schema.ts`、`lib/types.ts`、`lib/db.ts`、`app/api/tasks/*`、`app/api/services/*`、`app/api/github/*`、`app/tasks/[id]/page.tsx`、`app/branches/page.tsx`、`app/services/page.tsx`

## ADDED Requirements

### Requirement: Repository-Centric Domain Model
系统 SHALL 以仓库为需求分支与服务的共同归属根实体，并允许一个需求分支挂靠同仓库下多个服务。

#### Scenario: 创建需求分支并关联多个服务
- **WHEN** 用户为某个任务创建一个需求分支并选择多个服务
- **THEN** 系统为该需求分支绑定一个仓库
- **AND** 系统只允许选择同一仓库下的服务
- **AND** 系统保存需求分支与服务的多对多关系

### Requirement: Service Pipeline Stages
系统 SHALL 支持每个服务维护独立的阶段流水线，并通过排序、启停和目标分支定义发布路径。

#### Scenario: 服务定义多阶段流水线
- **WHEN** 用户为服务配置 `QA`、`Pre`、`Prod` 等阶段
- **THEN** 系统按 `position` 保存阶段顺序
- **AND** 每个阶段保存 `target_branch`
- **AND** 禁用某阶段后，下游阶段仍能基于最近的启用前置阶段继续判定门禁

### Requirement: Pull Request History and Audit
系统 SHALL 为每个 `需求分支 + 服务 + 阶段` 保留完整 PR 历史与审计事件，而不只保存最新链接。

#### Scenario: 同一阶段重复提单
- **WHEN** 某需求分支在同一服务阶段多次创建 PR
- **THEN** 系统保存多条 PR 记录
- **AND** 每条记录都包含仓库、源分支、目标分支、状态、可合并状态和时间戳
- **AND** 系统为创建、合并、关闭、撤销合并等操作写入审计事件

### Requirement: Service Main View
系统 SHALL 提供服务主视角页面，用于查看当前服务下各需求分支在不同阶段的状态、是否可操作以及是否已合并。

#### Scenario: 通过阶段 Tab 查看分支状态
- **WHEN** 用户打开某服务详情页并切换到一个阶段 Tab
- **THEN** 系统展示该阶段下的未合并需求分支列表
- **AND** 系统展示该阶段下的已合并需求分支列表
- **AND** 每条记录显示任务标题、需求分支、开发用户、PR 状态、最近同步时间和可操作状态

#### Scenario: 通过矩阵查看完整轨迹
- **WHEN** 用户切换到阶段横向矩阵视图
- **THEN** 系统按行展示需求分支
- **AND** 按列展示服务阶段
- **AND** 每个单元格展示该分支在该阶段的状态、PR 入口和可操作按钮

### Requirement: Service Stage Snapshot Read Model
系统 SHALL 维护服务主视角快照表，为每个 `服务 + 需求分支 + 阶段` 保存当前展示态与操作态。

#### Scenario: 同步后刷新服务主视角状态
- **WHEN** 系统完成一次 PR 状态同步或阶段动作
- **THEN** 系统更新对应快照记录
- **AND** 快照至少包含 `stage_status`、`gate_status`、`is_actionable`、`action_type`、`latest_pull_request_id` 和 `last_synced_at`

### Requirement: User Assignment Model
系统 SHALL 区分任务负责人和分支开发者两个维度的用户归属。

#### Scenario: 统计口径分离
- **WHEN** 一个任务分配了负责人，且其需求分支分配了多个开发用户
- **THEN** 系统分别保存任务负责人关系和分支开发者关系
- **AND** 服务视角和任务视角可以按不同口径统计用户工作量

## MODIFIED Requirements

### Requirement: Service Management
服务管理功能 MUST 以仓库归属和阶段流水线为中心，而不再以内嵌测试/主分支配置作为唯一发布模型。

#### Scenario: 查看服务配置
- **WHEN** 用户查看服务配置
- **THEN** 系统展示服务所属仓库、根路径、阶段流水线和依赖关系
- **AND** 不再只展示 `testBranch/masterBranch` 两段式配置

### Requirement: Task Detail
任务详情功能 MUST 展示任务下的需求分支聚合信息，而不是直接编辑按服务拆开的分支 JSON 列表。

#### Scenario: 查看任务详情
- **WHEN** 用户打开任务详情页
- **THEN** 系统展示任务信息
- **AND** 展示该任务下的需求分支列表
- **AND** 每个需求分支下展示挂靠服务、开发用户和阶段化状态

### Requirement: GitHub Integration
GitHub 集成 MUST 以显式仓库标识为准，而不是通过服务名推导 repo slug。

#### Scenario: 创建 PR
- **WHEN** 系统为某需求分支在某服务阶段创建 PR
- **THEN** 服务端使用仓库信息或 `repository_id` 定位目标仓库
- **AND** 不再依赖 `serviceName -> repo slug` 的隐式推导

## REMOVED Requirements

### Requirement: Service Branch Blob Model
**Reason**: 旧模型把分支、服务、阶段状态和 PR 状态混在 `service_branches` 中，无法支持多服务挂靠、完整历史和服务主视角快照。
**Migration**: 新项目直接移除该模型，不做兼容迁移；统一改为 `task_branches`、`task_branch_services`、`pull_requests`、`service_branch_stage_snapshots` 等显式表结构。

### Requirement: Team Model In This Version
**Reason**: 当前版本优先交付分支流转、服务主视角和用户归属，`teams` 不属于最小闭环。
**Migration**: 本期不建设 `teams` / `team_memberships`；未来如需团队维度统计，再以增量 spec 追加。
