import type { TaskStatus } from "@/lib/types"

export const TASK_STATUS_COLUMNS: Array<{ id: TaskStatus; title: string; color: string }> = [
  { id: "backlog", title: "待规划", color: "bg-gray-100" },
  { id: "todo", title: "待开发", color: "bg-blue-50" },
  { id: "in-progress", title: "开发中", color: "bg-yellow-50" },
  { id: "testing", title: "测试中", color: "bg-purple-50" },
  { id: "done", title: "已完成", color: "bg-green-50" },
  { id: "closed", title: "已关闭", color: "bg-zinc-100" },
]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "待规划",
  todo: "待开发",
  "in-progress": "开发中",
  testing: "测试中",
  done: "已完成",
  closed: "已关闭",
}

export function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (status === "review") {
    return "testing"
  }

  switch (status) {
    case "backlog":
    case "todo":
    case "in-progress":
    case "testing":
    case "done":
    case "closed":
      return status
    default:
      return "backlog"
  }
}

export function isCompletedTaskStatus(status: string | null | undefined) {
  const normalized = normalizeTaskStatus(status)
  return normalized === "done" || normalized === "closed"
}
