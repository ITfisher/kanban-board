export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done"

export type TaskPriority = "low" | "medium" | "high"

export interface TaskAssignee {
  name: string
  avatar?: string
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

export interface BranchDiffState {
  status: string
  aheadBy: number
  behindBy: number
  totalCommits: number
}

export interface ServiceBranch {
  id: string
  taskId?: string
  serviceName: string
  branchName: string
  createdAt: string
  lastCommit?: string
  pullRequestUrl?: string
  mergedToTest?: boolean
  mergedToMaster?: boolean
  testMergeDate?: string
  masterMergeDate?: string
  prStatus?: PullRequestStatus
  lastStatusCheck?: string
  diffStatus?: {
    test?: BranchDiffState
    master?: BranchDiffState
  }
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee?: TaskAssignee
  jiraUrl?: string
  serviceBranches?: ServiceBranch[]
  createdAt?: string
  updatedAt?: string
}

export interface Service {
  id: string
  name: string
  description: string
  repository: string
  dependencies: string[]
  testBranch: string
  masterBranch: string
}

export interface GitHubConfigMeta {
  id: string
  name: string
  domain: string
  owner: string
  isDefault?: boolean
}

export interface SettingsData {
  notifications: boolean
  autoSave: boolean
  darkMode: boolean
  compactView: boolean
  showAssigneeAvatars: boolean
  defaultPriority: TaskPriority
  autoCreateBranch: boolean
  branchPrefix: string
  githubConfigs?: GitHubConfigMeta[]
}

export interface BackupData {
  tasks?: Task[]
  services?: Service[]
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
