import type { Service, Task, TaskBranch } from "@/lib/types"

type TaskBranchWithServices = TaskBranch & {
  services?: Array<Pick<Service, "id" | "name">>
}

export type TaskServiceSummary = Pick<Service, "id" | "name">

function getTaskBranches(task: Pick<Task, "taskBranches">): TaskBranchWithServices[] {
  return (task.taskBranches ?? []) as TaskBranchWithServices[]
}

export function getTaskServices(task: Pick<Task, "taskBranches">): TaskServiceSummary[] {
  const byId = new Map<string, TaskServiceSummary>()

  for (const service of getTaskBranches(task).flatMap((branch) => branch.services ?? [])) {
    const serviceId = service.id?.trim()
    const serviceName = service.name?.trim()

    if (!serviceId || !serviceName || byId.has(serviceId)) {
      continue
    }

    byId.set(serviceId, { id: serviceId, name: serviceName })
  }

  return Array.from(byId.values())
}

export function getTaskServiceNames(task: Pick<Task, "taskBranches">): string[] {
  return getTaskServices(task).map((service) => service.name)
}

export function getServiceTaskCount(tasks: Task[], serviceId: string): number {
  return tasks.filter((task) => getTaskServices(task).some((service) => service.id === serviceId)).length
}

export function getActiveServiceNames(tasks: Task[]): string[] {
  const byId = new Map<string, string>()

  for (const service of tasks.flatMap((task) => getTaskServices(task))) {
    if (!byId.has(service.id)) {
      byId.set(service.id, service.name)
    }
  }

  return Array.from(byId.values()).sort((left, right) => left.localeCompare(right, "zh-CN"))
}
