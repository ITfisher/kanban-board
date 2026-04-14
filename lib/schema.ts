import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  assigneeName: text("assignee_name"),
  assigneeAvatar: text("assignee_avatar"),
  jiraUrl: text("jira_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const serviceBranches = sqliteTable("service_branches", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  serviceId: text("service_id"),
  serviceName: text("service_name").notNull(),
  branchName: text("branch_name").notNull(),
  pullRequestUrl: text("pull_request_url"),
  testPullRequestUrl: text("test_pull_request_url"),
  masterPullRequestUrl: text("master_pull_request_url"),
  mergedToTest: integer("merged_to_test").notNull().default(0),
  mergedToMaster: integer("merged_to_master").notNull().default(0),
  testMergeDate: text("test_merge_date"),
  masterMergeDate: text("master_merge_date"),
  lastCommit: text("last_commit"),
  lastStatusCheck: text("last_status_check"),
  prStatus: text("pr_status"), // JSON blob
  diffStatus: text("diff_status"), // JSON blob
  createdAt: text("created_at").notNull(),
})

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  repository: text("repository").notNull().default(""),
  testBranch: text("test_branch").notNull().default("develop"),
  masterBranch: text("master_branch").notNull().default("main"),
  dependencies: text("dependencies").notNull().default("[]"), // JSON array
})

export const githubConfigs = sqliteTable("github_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  owner: text("owner").notNull(),
  token: text("token").notNull(), // Never returned to client
  isDefault: integer("is_default").notNull().default(0),
})

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  notifications: integer("notifications").notNull().default(0),
  darkMode: integer("dark_mode").notNull().default(0),
  compactView: integer("compact_view").notNull().default(0),
  showAssigneeAvatars: integer("show_assignee_avatars").notNull().default(1),
  defaultPriority: text("default_priority").notNull().default("medium"),
  autoCreateBranch: integer("auto_create_branch").notNull().default(1),
  branchPrefix: text("branch_prefix").notNull().default(""),
})

// TypeScript types inferred from schema
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type ServiceBranch = typeof serviceBranches.$inferSelect
export type NewServiceBranch = typeof serviceBranches.$inferInsert
export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert
export type GitHubConfig = typeof githubConfigs.$inferSelect
export type NewGitHubConfig = typeof githubConfigs.$inferInsert
export type Settings = typeof settings.$inferSelect
