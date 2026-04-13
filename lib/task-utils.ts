import { resolveServiceFromBranch } from "@/lib/service-branch-utils"
import type { Task } from "@/lib/types"

export const findServiceForBranch = resolveServiceFromBranch

export function getTaskServiceNames(task: Pick<Task, "serviceBranches">): string[] {
  if (!task.serviceBranches?.length) {
    return []
  }

  return Array.from(
    new Set(
      task.serviceBranches
        .map((branch) => branch.serviceName.trim())
        .filter(Boolean)
    )
  )
}

export function getServiceTaskCount(tasks: Task[], serviceName: string): number {
  return tasks.filter((task) => getTaskServiceNames(task).includes(serviceName)).length
}

export function getActiveServiceNames(tasks: Task[]): string[] {
  return Array.from(
    new Set(
      tasks.flatMap((task) => getTaskServiceNames(task))
    )
  ).sort((a, b) => a.localeCompare(b, "zh-CN"))
}
