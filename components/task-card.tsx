"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Task, TaskBranch } from "@/lib/types"
import { TASK_STATUS_LABELS } from "@/lib/task-status"
import { ExternalLink, GitBranch } from "lucide-react"

type TaskBranchCardView = TaskBranch & {
  services?: Array<{
    id: string
    name: string
  }>
  repository?: {
    id: string
    fullName?: string
  }
}

interface TaskCardProps {
  task: Task
  onUpdate?: (task: Task) => void
  isDragging?: boolean
  compactView?: boolean
  showAssigneeAvatars?: boolean
}

const branchStatusLabels: Record<string, string> = {
  active: "进行中",
  merged: "已合并",
  closed: "已关闭",
  archived: "已归档",
}

function getBranchStatusColor(status: string) {
  switch (status) {
    case "merged":
      return "bg-green-100 text-green-800"
    case "closed":
      return "bg-zinc-100 text-zinc-800"
    case "archived":
      return "bg-slate-100 text-slate-800"
    default:
      return "bg-amber-100 text-amber-800"
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 border-red-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "low":
      return "bg-green-100 text-green-800 border-green-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

function getTaskBranches(task: Task): TaskBranchCardView[] {
  return (task.taskBranches ?? []) as TaskBranchCardView[]
}

function getServiceSummary(branch: TaskBranchCardView): string {
  const names = (branch.services ?? []).map((service) => service.name).filter(Boolean)
  if (names.length <= 2) {
    return names.join("、")
  }
  return `${names.slice(0, 2).join("、")} +${names.length - 2}`
}

export function TaskCard({
  task,
  isDragging = false,
  compactView = false,
  showAssigneeAvatars = true,
}: TaskCardProps) {
  const taskBranches = getTaskBranches(task)
  const updatedAtLabel = task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "未记录"

  return (
    <Card className={isDragging ? "opacity-60" : undefined}>
      <CardHeader className={compactView ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <CardTitle className="line-clamp-2 text-base">{task.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TASK_STATUS_LABELS[task.status] ?? task.status}</Badge>
              <Badge className={`${getPriorityColor(task.priority)} border`}>
                {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {taskBranches.length} 个需求分支
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
            <Link href={`/tasks/${task.id}`}>
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">查看任务详情</span>
            </Link>
          </Button>
        </div>
      </CardHeader>

      {!compactView && (
        <CardContent className="space-y-3 px-4 pb-3">
          {task.description ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{task.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">暂无任务描述</p>
          )}

          {taskBranches.length > 0 ? (
            <div className="space-y-2">
              {taskBranches.slice(0, 3).map((branch) => (
                <div key={branch.id} className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-foreground">{branch.name}</div>
                    <Badge className={`${getBranchStatusColor(branch.status)} text-xs`}>
                      {branchStatusLabels[branch.status] || branch.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {getServiceSummary(branch) || "未关联服务"}
                  </div>
                </div>
              ))}
              {taskBranches.length > 3 && (
                <div className="text-xs text-muted-foreground">还有 {taskBranches.length - 3} 个需求分支未展开</div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              还没有创建需求分支
            </div>
          )}
        </CardContent>
      )}

      <CardFooter className="flex items-center justify-between gap-3 px-4 pb-4 pt-0 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {task.assignee ? (
            <div className="flex min-w-0 items-center gap-2">
              {showAssigneeAvatars && (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
                  <AvatarFallback>{task.assignee.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
              )}
              <span className="truncate">{task.assignee.name}</span>
            </div>
          ) : (
            <span>未分配负责人</span>
          )}
        </div>
        <span className="shrink-0">更新于 {updatedAtLabel}</span>
      </CardFooter>
    </Card>
  )
}
