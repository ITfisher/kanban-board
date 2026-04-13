import { serviceBranches, tasks } from "@/lib/schema"
import type { ServiceBranch, Task } from "@/lib/types"

type TaskRow = typeof tasks.$inferSelect
type ServiceBranchRow = typeof serviceBranches.$inferSelect

export function toClientTask(task: TaskRow, branches: ServiceBranchRow[]): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as Task["status"],
    priority: task.priority as Task["priority"],
    assignee: task.assigneeName
      ? { name: task.assigneeName, avatar: task.assigneeAvatar ?? undefined }
      : undefined,
    jiraUrl: task.jiraUrl ?? undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    serviceBranches: branches.map(toClientServiceBranch),
  }
}

export function toClientServiceBranch(branch: ServiceBranchRow): ServiceBranch {
  return {
    id: branch.id,
    taskId: branch.taskId,
    serviceName: branch.serviceName,
    branchName: branch.branchName,
    pullRequestUrl: branch.pullRequestUrl ?? undefined,
    mergedToTest: branch.mergedToTest === 1,
    mergedToMaster: branch.mergedToMaster === 1,
    testMergeDate: branch.testMergeDate ?? undefined,
    masterMergeDate: branch.masterMergeDate ?? undefined,
    lastCommit: branch.lastCommit ?? undefined,
    lastStatusCheck: branch.lastStatusCheck ?? undefined,
    prStatus: branch.prStatus ? JSON.parse(branch.prStatus) : undefined,
    diffStatus: branch.diffStatus ? JSON.parse(branch.diffStatus) : undefined,
    createdAt: branch.createdAt,
  }
}
