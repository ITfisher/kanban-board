import type { BackupData, Service, SettingsData, Task, TaskPriority, TaskStatus } from "@/lib/types"

const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "in-progress", "testing", "done", "closed"]
const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES.includes(value as TaskStatus) || value === "review")
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && TASK_PRIORITIES.includes(value as TaskPriority)
}

export function validateTaskList(input: unknown): Task[] {
  if (!Array.isArray(input)) {
    throw new Error("任务数据必须是数组")
  }

  return input.map((task, index) => {
    if (!isRecord(task)) {
      throw new Error(`第 ${index + 1} 个任务格式不正确`)
    }

    if (typeof task.title !== "string" || !task.title.trim()) {
      throw new Error(`第 ${index + 1} 个任务缺少有效标题`)
    }

    if (task.status !== undefined && !isTaskStatus(task.status)) {
      throw new Error(`第 ${index + 1} 个任务的状态无效`)
    }

    if (task.priority !== undefined && !isTaskPriority(task.priority)) {
      throw new Error(`第 ${index + 1} 个任务的优先级无效`)
    }

    if (task.taskBranches !== undefined && !Array.isArray(task.taskBranches)) {
      throw new Error(`第 ${index + 1} 个任务的需求分支必须是数组`)
    }

    return task as unknown as Task
  })
}

export function validateServiceList(input: unknown): Service[] {
  if (!Array.isArray(input)) {
    throw new Error("服务数据必须是数组")
  }

  return input.map((service, index) => {
    if (!isRecord(service)) {
      throw new Error(`第 ${index + 1} 个服务格式不正确`)
    }

    if (typeof service.name !== "string" || !service.name.trim()) {
      throw new Error(`第 ${index + 1} 个服务缺少有效名称`)
    }

    if (service.dependencies !== undefined && !Array.isArray(service.dependencies)) {
      throw new Error(`第 ${index + 1} 个服务的依赖必须是数组`)
    }

    return service as unknown as Service
  })
}

export function validateSettingsData(input: unknown): Partial<SettingsData> {
  if (!isRecord(input)) {
    throw new Error("设置数据格式不正确")
  }

  if (input.defaultPriority !== undefined && !isTaskPriority(input.defaultPriority)) {
    throw new Error("默认优先级无效")
  }

  return input as Partial<SettingsData>
}

export function validateBackupData(input: unknown): BackupData {
  if (!isRecord(input)) {
    throw new Error("导入文件必须是 JSON 对象")
  }

  const hasKnownSection =
    input.tasks !== undefined || input.services !== undefined || input.settings !== undefined

  if (!hasKnownSection) {
    throw new Error("导入文件缺少 tasks、services 或 settings 字段")
  }

  const result: BackupData = {}

  if (input.tasks !== undefined) {
    result.tasks = validateTaskList(input.tasks)
  }

  if (input.services !== undefined) {
    result.services = validateServiceList(input.services)
  }

  if (input.settings !== undefined) {
    result.settings = validateSettingsData(input.settings)
  }

  if (input.exportDate !== undefined && typeof input.exportDate !== "string") {
    throw new Error("导出时间字段格式不正确")
  }

  if (input.version !== undefined && typeof input.version !== "string") {
    throw new Error("版本字段格式不正确")
  }

  result.exportDate = typeof input.exportDate === "string" ? input.exportDate : undefined
  result.version = typeof input.version === "string" ? input.version : undefined

  return result
}
