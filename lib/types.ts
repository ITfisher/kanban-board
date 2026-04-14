export type TaskStatus = "backlog" | "todo" | "in-progress" | "testing" | "done" | "closed"

export type TaskPriority = "low" | "medium" | "high"

export type RepositoryProvider = "github" | "github-enterprise"
export type TaskBranchStatus = "active" | "merged" | "closed" | "archived"
export type TaskAssignmentRole = "owner"
export type TaskBranchDeveloperRole = "developer" | "reviewer"
export type TaskBranchServiceStatus = "active" | "paused" | "removed"
export type PullRequestState = "open" | "closed" | "merged"
export type StageStatus = "idle" | "ready" | "in_progress" | "blocked" | "merged" | "closed"
export type GateStatus = "unknown" | "pending" | "ready" | "blocked" | "merged"
export type StageActionType = "create_pr" | "sync" | "view_pr" | "noop"
export type MergeOperationType = "pull_request_merge" | "pull_request_revert"
export type MergeOperationStatus = "completed" | "failed"
export type SyncRunScope = "repository" | "service" | "task_branch"
export type SyncRunStatus = "running" | "completed" | "failed" | "partial" | "skipped"
export type AuditEventType =
  | "pull_request.created"
  | "pull_request.synced"
  | "pull_request.closed"
  | "pull_request.merged"
  | "pull_request.merge_reverted"
  | "pull_request.reopened"
  | "stage.advanced"
  | "stage.blocked"
  | "snapshot.refreshed"
  | "sync.completed"

export interface TaskAssignee {
  name: string
  avatar?: string
}

export interface Repository {
  id: string
  name: string
  provider: RepositoryProvider
  domain: string
  owner: string
  slug: string
  defaultBranch: string
  description?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  source?: string
  createdAt: string
  updatedAt: string
}

export interface TaskAssignment {
  id: string
  taskId: string
  userId: string
  role: TaskAssignmentRole
  createdAt: string
}

export interface TaskBranch {
  id: string
  taskId: string
  repositoryId: string
  name: string
  title?: string
  description?: string
  status: TaskBranchStatus
  createdByUserId?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  lastSyncedAt?: string
}

export interface TaskBranchDeveloper {
  id: string
  taskBranchId: string
  userId: string
  role: TaskBranchDeveloperRole
  createdAt: string
}

export interface ServiceStage {
  id: string
  serviceId: string
  name: string
  key: string
  description?: string
  position: number
  targetBranch: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TaskBranchService {
  id: string
  taskBranchId: string
  serviceId: string
  repositoryId: string
  status: TaskBranchServiceStatus
  createdAt: string
  updatedAt: string
}

export interface BranchChecks {
  state: "pending" | "success" | "failure" | "error"
  conclusion: string | null
  total_count: number
  completed_count: number
  failed_count: number
}

export interface PullRequestStatus {
  number: number
  state: "open" | "closed"
  merged: boolean
  mergeable: boolean | null
  mergeable_state: string
  merged_at: string | null
  base_ref: string
  head_ref: string
  head_sha: string
  html_url: string
  checks?: BranchChecks
}

export interface PullRequestRecord {
  id: string
  repositoryId: string
  taskBranchId: string
  serviceId: string
  serviceStageId: string
  provider: RepositoryProvider
  providerDomain: string
  externalNumber?: number
  title: string
  htmlUrl?: string
  sourceBranch: string
  targetBranch: string
  state: PullRequestState
  merged: boolean
  mergeable?: boolean | null
  mergeableState?: string
  headSha?: string
  baseSha?: string
  draft?: boolean
  authorUserId?: string
  rawPayload?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  mergedAt?: string
  lastSyncedAt?: string
}

export interface SnapshotPullRequestChecks {
  state?: "pending" | "success" | "failure" | "error"
  totalCount?: number
  completedCount?: number
  failedCount?: number
}

export interface BranchDiffState {
  status: string
  aheadBy: number
  behindBy: number
  totalCommits: number
}

export interface AuditEvent {
  id: string
  repositoryId?: string
  taskId?: string
  taskBranchId?: string
  serviceId?: string
  serviceStageId?: string
  pullRequestId?: string
  actorUserId?: string
  eventType: AuditEventType
  summary?: string
  payload?: string
  occurredAt: string
  createdAt: string
}

export interface MergeOperation {
  id: string
  repositoryId?: string
  taskId?: string
  taskBranchId?: string
  serviceId?: string
  serviceStageId?: string
  pullRequestId?: string
  operationType: MergeOperationType
  status: MergeOperationStatus
  summary?: string
  payload?: string
  startedAt: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SyncRun {
  id: string
  repositoryId?: string
  serviceId?: string
  taskBranchId?: string
  scope: SyncRunScope
  status: SyncRunStatus
  summary?: string
  payload?: string
  startedAt: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ServiceBranchStageSnapshot {
  id: string
  repositoryId: string
  serviceId: string
  taskId: string
  taskBranchId: string
  serviceStageId: string
  stageStatus: StageStatus
  gateStatus: GateStatus
  isActionable: boolean
  actionType?: StageActionType
  latestPullRequestId?: string
  latestPullRequestNumber?: number
  latestPullRequestState?: PullRequestState
  latestPullRequestUrl?: string
  latestPullRequestTitle?: string
  latestPullRequestMergeable?: boolean | null
  latestPullRequestMergeableState?: string
  latestPullRequestDraft?: boolean
  latestPullRequestChecks?: SnapshotPullRequestChecks
  taskTitle: string
  taskStatus: TaskStatus
  branchName: string
  developerUserIds?: string[]
  developerNames?: string[]
  lastSyncedAt?: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  ownerUserId?: string
  assignee?: TaskAssignee
  jiraUrl?: string
  taskBranches?: TaskBranch[]
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}

export interface Service {
  id: string
  repositoryId?: string
  name: string
  description: string
  rootPath?: string
  repository?: string
  dependencies: string[]
  isActive?: boolean
  stages?: ServiceStage[]
  createdAt?: string
  updatedAt?: string
}

export interface ScmConnectionMeta {
  id: string
  name: string
  provider: RepositoryProvider
  domain: string
  owner: string
  isDefault?: boolean
}

export interface SettingsData {
  notifications: boolean
  darkMode: boolean
  compactView: boolean
  showAssigneeAvatars: boolean
  defaultPriority: TaskPriority
  branchPrefix: string
}

export interface BackupData {
  tasks?: Task[]
  services?: Service[]
  repositories?: Repository[]
  users?: User[]
  taskBranches?: TaskBranch[]
  serviceStages?: ServiceStage[]
  pullRequests?: PullRequestRecord[]
  events?: AuditEvent[]
  mergeOperations?: MergeOperation[]
  syncRuns?: SyncRun[]
  snapshots?: ServiceBranchStageSnapshot[]
  scmConnections?: ScmConnectionMeta[]
  settings?: Partial<SettingsData>
  exportDate?: string
  version?: string
}

export interface BranchStatus {
  baseBranch: string
  isMerged: boolean
  diffStatus?: BranchDiffState
  pullRequest?: {
    number: number
    title: string
    state: string
    merged: boolean
    mergedAt: string | null
    url: string
  }
}
