"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { TASK_STATUS_LABELS } from "@/lib/task-status"
import type { Task } from "@/lib/types"
import { ExternalLink, GitBranch, Save, Trash2 } from "lucide-react"

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
}

const branchStatusLabels: Record<string, string> = {
  active: "进行中",
  merged: "已合并",
  closed: "已关闭",
  archived: "已归档",
}

const priorityLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
}

const branchStatusColors: Record<string, string> = {
  merged: "bg-green-100 text-green-800",
  closed: "bg-zinc-100 text-zinc-800",
  archived: "bg-slate-100 text-slate-800",
  active: "bg-amber-100 text-amber-800",
}

export function TaskDetailDialog({ task, open, onOpenChange, onUpdateTask, onDeleteTask }: TaskDetailDialogProps) {
  const [editedTask, setEditedTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setEditedTask(task ? { ...task } : null)
    setConfirmDelete(false)
  }, [task, open])

  if (!task || !editedTask) return null

  const isDirty =
    editedTask.title !== task.title ||
    editedTask.description !== task.description ||
    editedTask.priority !== task.priority ||
    editedTask.status !== task.status ||
    (editedTask.assignee?.name ?? "") !== (task.assignee?.name ?? "")

  const taskBranches = editedTask.taskBranches ?? []

  function handleSave() {
    if (!editedTask || !onUpdateTask) return
    onUpdateTask(editedTask)
    toast({ title: "任务已保存" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">任务详情</span>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={`/tasks/${task.id}`} onClick={() => onOpenChange(false)}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                完整视图
              </Link>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">标题</Label>
            <Input
              id="task-title"
              value={editedTask.title}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              placeholder="任务标题"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description">描述</Label>
            <Textarea
              id="task-description"
              value={editedTask.description}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              placeholder="任务描述"
              rows={3}
            />
          </div>

          {/* 状态 + 优先级 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>状态</Label>
              <Select
                value={editedTask.status}
                onValueChange={(value) => setEditedTask({ ...editedTask, status: value as Task["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>优先级</Label>
              <Select
                value={editedTask.priority}
                onValueChange={(value) => setEditedTask({ ...editedTask, priority: value as Task["priority"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 负责人 */}
          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">负责人</Label>
            <Input
              id="task-assignee"
              value={editedTask.assignee?.name ?? ""}
              onChange={(e) =>
                setEditedTask({
                  ...editedTask,
                  assignee: e.target.value.trim() ? { name: e.target.value } : undefined,
                })
              }
              placeholder="输入负责人姓名"
            />
          </div>

          {/* 需求分支 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>需求分支</Label>
              <Badge variant="secondary" className="gap-1">
                <GitBranch className="h-3 w-3" />
                {taskBranches.length}
              </Badge>
            </div>
            {taskBranches.length > 0 ? (
              <div className="space-y-2">
                {taskBranches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="font-mono text-xs text-foreground">{branch.name}</span>
                    <Badge className={`${branchStatusColors[branch.status] ?? branchStatusColors.active} text-xs`}>
                      {branchStatusLabels[branch.status] ?? branch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                还没有创建需求分支
              </div>
            )}
          </div>

          {/* 时间信息 */}
          <div className="grid grid-cols-2 gap-4 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">创建时间：</span>
              {task.createdAt ? new Date(task.createdAt).toLocaleString() : "—"}
            </div>
            <div>
              <span className="font-medium">更新时间：</span>
              {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "—"}
            </div>
          </div>

          {/* 操作栏 */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-destructive">确认删除任务及所有关联分支？</span>
                  <Button size="sm" variant="destructive" onClick={() => { onDeleteTask?.(task.id); onOpenChange(false) }}>
                    确认删除
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    取消
                  </Button>
                </>
              ) : (
                onDeleteTask && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    删除任务
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={!isDirty || confirmDelete}>
                <Save className="mr-1.5 h-4 w-4" />
                保存
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
