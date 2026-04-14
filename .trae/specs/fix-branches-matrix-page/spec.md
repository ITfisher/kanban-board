# 修复分支矩阵页偏差 Spec

## Why
当前新版本设计明确要求 `/branches` 作为真正的“分支主视角 / 分支矩阵页”，但现有实现仍把 `/branches` 做成“服务主视角入口页”，页面文案也直接说明需要跳转到单个服务后再看阶段状态。这与设计文档、已完成任务记录和用户认知都不一致，属于已交付能力和实际行为不一致的问题。

## What Changes
- 将 `/branches` 从“服务入口页”改为真正的“分支矩阵页”
- 让 `/branches` 以 `task_branch` 为行、以阶段或服务阶段快照为列展示跨服务进度
- 保留从分支矩阵跳转到任务详情、服务详情、PR 链接的能力
- 为矩阵页补充空态、错误态、筛选与排序规则
- **BREAKING** 移除当前 `/branches?service=...` 自动跳转到 `/services/[id]` 的入口行为

## Impact
- Affected specs: 分支主视角、服务主视角、任务详情联动、页面导航一致性
- Affected code: `app/branches/page.tsx`、`app/services/[id]/page.tsx`、`app/api/task-branches/*`、`app/api/services/[id]/stage-board`、`components/sidebar.tsx`

## ADDED Requirements

### Requirement: Branch Matrix Primary View
系统 SHALL 将 `/branches` 作为需求分支主视角页面，而不是服务入口页。

#### Scenario: 打开分支页
- **WHEN** 用户访问 `/branches`
- **THEN** 系统展示需求分支列表或矩阵
- **AND** 每一行代表一个 `task_branch`
- **AND** 用户不需要先选择某个服务才能看到分支流转信息

### Requirement: Cross-Service Matrix Overview
系统 SHALL 在 `/branches` 中展示一个需求分支跨服务与阶段的整体状态矩阵。

#### Scenario: 查看分支跨服务进度
- **WHEN** 页面存在多个需求分支，且每个分支挂靠多个服务
- **THEN** 系统展示该分支关联的服务与阶段状态
- **AND** 用户可以看见阶段状态、门禁状态、最新 PR 入口、最近同步时间
- **AND** 用户可以一眼比较同一需求分支在多个服务中的推进差异

### Requirement: Branch-Centric Filters
系统 SHALL 为 `/branches` 提供符合分支主视角的筛选与排序，而不是服务筛选入口。

#### Scenario: 筛选异常或待处理分支
- **WHEN** 用户需要查看阻塞、可推进、已合并或指定任务状态的需求分支
- **THEN** 系统提供分支级筛选条件
- **AND** 默认按最近更新时间或可操作优先级排序

## MODIFIED Requirements

### Requirement: Branch Page
`/branches` 页面 MUST 展示分支维度矩阵，而不是列出服务后跳转到服务详情页。

#### Scenario: 页面交互一致
- **WHEN** 用户从左侧导航点击“Git 分支”
- **THEN** 页面内容与导航名称一致，直接展示“分支”而不是“服务入口”
- **AND** 页面主操作围绕分支查看、筛选、跳转任务/服务/PR，而不是“查看服务详情”

## REMOVED Requirements

### Requirement: Branch Page As Service Entry
**Reason**: 这种实现会让“Git 分支”导航进入一个服务列表页，用户需要再次跳转，交互反常识，也与新设计中的“分支主视角”相违背。
**Migration**: 移除 `/branches?service=...` 到 `/services/[id]` 的自动跳转逻辑；如仍需服务入口，应由 `/services` 或服务主视角承担。
