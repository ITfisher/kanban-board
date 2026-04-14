import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("github"),
  domain: text("domain").notNull().default("github.com"),
  owner: text("owner").notNull().default(""),
  slug: text("slug").notNull().default(""),
  defaultBranch: text("default_branch").notNull().default("main"),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
})

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  source: text("source").notNull().default("manual"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  ownerUserId: text("owner_user_id"),
  assigneeName: text("assignee_name"),
  assigneeAvatar: text("assignee_avatar"),
  jiraUrl: text("jira_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
})

export const taskAssignments = sqliteTable("task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("owner"),
  createdAt: text("created_at").notNull(),
})

export const taskBranches = sqliteTable("task_branches", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  repositoryId: text("repository_id").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdByUserId: text("created_by_user_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  closedAt: text("closed_at"),
  lastSyncedAt: text("last_synced_at"),
})

export const taskBranchDevelopers = sqliteTable("task_branch_developers", {
  id: text("id").primaryKey(),
  taskBranchId: text("task_branch_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("developer"),
  createdAt: text("created_at").notNull(),
})

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  rootPath: text("root_path").notNull().default(""),
  dependencies: text("dependencies").notNull().default("[]"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const serviceStages = sqliteTable("service_stages", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  name: text("name").notNull(),
  key: text("key").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  targetBranch: text("target_branch").notNull().default("main"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const taskBranchServices = sqliteTable("task_branch_services", {
  id: text("id").primaryKey(),
  taskBranchId: text("task_branch_id").notNull(),
  serviceId: text("service_id").notNull(),
  repositoryId: text("repository_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const pullRequests = sqliteTable("pull_requests", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id").notNull(),
  taskBranchId: text("task_branch_id").notNull(),
  serviceId: text("service_id").notNull(),
  serviceStageId: text("service_stage_id").notNull(),
  provider: text("provider").notNull().default("github"),
  providerDomain: text("provider_domain").notNull().default("github.com"),
  externalNumber: integer("external_number"),
  title: text("title").notNull().default(""),
  htmlUrl: text("html_url"),
  sourceBranch: text("source_branch").notNull(),
  targetBranch: text("target_branch").notNull(),
  state: text("state").notNull().default("open"),
  merged: integer("merged").notNull().default(0),
  mergeable: integer("mergeable"),
  mergeableState: text("mergeable_state"),
  headSha: text("head_sha"),
  baseSha: text("base_sha"),
  draft: integer("draft").notNull().default(0),
  authorUserId: text("author_user_id"),
  rawPayload: text("raw_payload"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  closedAt: text("closed_at"),
  mergedAt: text("merged_at"),
  lastSyncedAt: text("last_synced_at"),
})

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id"),
  taskId: text("task_id"),
  taskBranchId: text("task_branch_id"),
  serviceId: text("service_id"),
  serviceStageId: text("service_stage_id"),
  pullRequestId: text("pull_request_id"),
  actorUserId: text("actor_user_id"),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull().default(""),
  payload: text("payload").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
})

export const mergeOperations = sqliteTable("merge_operations", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id"),
  taskId: text("task_id"),
  taskBranchId: text("task_branch_id"),
  serviceId: text("service_id"),
  serviceStageId: text("service_stage_id"),
  pullRequestId: text("pull_request_id"),
  operationType: text("operation_type").notNull().default("pull_request_merge"),
  status: text("status").notNull().default("completed"),
  summary: text("summary").notNull().default(""),
  payload: text("payload").notNull().default("{}"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id"),
  serviceId: text("service_id"),
  taskBranchId: text("task_branch_id"),
  scope: text("scope").notNull().default("service"),
  status: text("status").notNull().default("running"),
  summary: text("summary").notNull().default(""),
  payload: text("payload").notNull().default("{}"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const scmConnections = sqliteTable("scm_connections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("github"),
  domain: text("domain").notNull().default("github.com"),
  owner: text("owner").notNull(),
  token: text("token").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const repositoryConnections = sqliteTable("repository_connections", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id").notNull(),
  scmConnectionId: text("scm_connection_id").notNull(),
  createdAt: text("created_at").notNull(),
})

export const serviceBranchStageSnapshots = sqliteTable("service_branch_stage_snapshots", {
  id: text("id").primaryKey(),
  repositoryId: text("repository_id").notNull(),
  serviceId: text("service_id").notNull(),
  taskId: text("task_id").notNull(),
  taskBranchId: text("task_branch_id").notNull(),
  serviceStageId: text("service_stage_id").notNull(),
  stageStatus: text("stage_status").notNull().default("idle"),
  gateStatus: text("gate_status").notNull().default("unknown"),
  isActionable: integer("is_actionable").notNull().default(0),
  actionType: text("action_type"),
  latestPullRequestId: text("latest_pull_request_id"),
  latestPullRequestNumber: integer("latest_pull_request_number"),
  latestPullRequestState: text("latest_pull_request_state"),
  latestPullRequestUrl: text("latest_pull_request_url"),
  latestPullRequestTitle: text("latest_pull_request_title"),
  latestPullRequestMergeable: integer("latest_pull_request_mergeable"),
  latestPullRequestMergeableState: text("latest_pull_request_mergeable_state"),
  latestPullRequestDraft: integer("latest_pull_request_draft"),
  latestPullRequestChecks: text("latest_pull_request_checks"),
  taskTitle: text("task_title").notNull().default(""),
  taskStatus: text("task_status").notNull().default("backlog"),
  branchName: text("branch_name").notNull(),
  developerUserIds: text("developer_user_ids").notNull().default("[]"),
  developerNames: text("developer_names").notNull().default("[]"),
  lastSyncedAt: text("last_synced_at"),
  updatedAt: text("updated_at").notNull(),
})

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  notifications: integer("notifications").notNull().default(0),
  darkMode: integer("dark_mode").notNull().default(0),
  compactView: integer("compact_view").notNull().default(0),
  showAssigneeAvatars: integer("show_assignee_avatars").notNull().default(1),
  defaultPriority: text("default_priority").notNull().default("medium"),
  branchPrefix: text("branch_prefix").notNull().default(""),
})

export type Repository = typeof repositories.$inferSelect
export type NewRepository = typeof repositories.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskAssignment = typeof taskAssignments.$inferSelect
export type NewTaskAssignment = typeof taskAssignments.$inferInsert
export type TaskBranch = typeof taskBranches.$inferSelect
export type NewTaskBranch = typeof taskBranches.$inferInsert
export type TaskBranchDeveloper = typeof taskBranchDevelopers.$inferSelect
export type NewTaskBranchDeveloper = typeof taskBranchDevelopers.$inferInsert
export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert
export type ServiceStage = typeof serviceStages.$inferSelect
export type NewServiceStage = typeof serviceStages.$inferInsert
export type TaskBranchService = typeof taskBranchServices.$inferSelect
export type NewTaskBranchService = typeof taskBranchServices.$inferInsert
export type PullRequest = typeof pullRequests.$inferSelect
export type NewPullRequest = typeof pullRequests.$inferInsert
export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type MergeOperation = typeof mergeOperations.$inferSelect
export type NewMergeOperation = typeof mergeOperations.$inferInsert
export type SyncRun = typeof syncRuns.$inferSelect
export type NewSyncRun = typeof syncRuns.$inferInsert
export type ScmConnection = typeof scmConnections.$inferSelect
export type NewScmConnection = typeof scmConnections.$inferInsert
export type RepositoryConnection = typeof repositoryConnections.$inferSelect
export type NewRepositoryConnection = typeof repositoryConnections.$inferInsert
export type ServiceBranchStageSnapshot = typeof serviceBranchStageSnapshots.$inferSelect
export type NewServiceBranchStageSnapshot = typeof serviceBranchStageSnapshots.$inferInsert
export type Settings = typeof settings.$inferSelect
