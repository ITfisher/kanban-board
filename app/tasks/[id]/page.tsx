"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { TASK_STATUS_LABELS } from "@/lib/task-status"
import type { TaskPriority, TaskStatus, User as UserOption } from "@/lib/types"
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Loader2,
  PencilLine,
  Save,
  Server,
  User,
  X,
} from "lucide-react"

type TaskDeveloper = {
  id: string
  name: string
}

type TaskBranchSnapshot = {
  id: string
  serviceId: string
  serviceStageId: string
  stageStatus: "idle" | "ready" | "in_progress" | "blocked" | "merged" | "closed"
  gateStatus: "unknown" | "pending" | "ready" | "blocked" | "merged"
  latestPullRequestUrl?: string
}

type TaskBranchPullRequest = {
  id: string
  serviceId: string
  serviceStageId: string
  htmlUrl?: string
}

type TaskBranchService = {
  id: string
  name: string
  stages?: Array<{
    id: string
    name: string
    position: number
    isActive: boolean
  }>
}

type TaskBranchView = {
  id: string
  name: string
  title?: string
  status: string
  repositoryId: string
  repository?: {
    id: string
    fullName: string
  }
  services: TaskBranchService[]
  developers: TaskDeveloper[]
  snapshots: TaskBranchSnapshot[]
  pullRequests: TaskBranchPullRequest[]
  lastSyncedAt?: string
}

type TaskDetailResponse = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  ownerUserId?: string
  assignee?: {
    name: string
    avatar?: string
  }
  createdAt?: string
  updatedAt?: string
  completedAt?: string
  taskBranches: TaskBranchView[]
}

type EditableTask = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  ownerUserId?: string
}

const priorityLabels: Record<TaskPriority, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
}

const priorityBadgeClass: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

const branchStatusLabels: Record<string, string> = {
  active: "活跃",
  merged: "已合并",
  closed: "已关闭",
  archived: "已归档",
}

const stageStatusLabels: Record<TaskBranchSnapshot["stageStatus"], string> = {
  idle: "未开始",
  ready: "待提单",
  in_progress: "进行中",
  blocked: "阻塞",
  merged: "已合并",
  closed: "已关闭",
}

const gateStatusLabels: Record<TaskBranchSnapshot["gateStatus"], string> = {
  unknown: "未知",
  pending: "待满足",
  ready: "可推进",
  blocked: "阻塞",
  merged: "已完成",
}

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString()
}

function getStageBadgeClass(status: TaskBranchSnapshot["stageStatus"]) {
  switch (status) {
    case "merged":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "in_progress":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "ready":
      return "bg-violet-100 text-violet-700 border-violet-200"
    case "blocked":
      return "bg-red-100 text-red-700 border-red-200"
    case "closed":
      return "bg-zinc-100 text-zinc-700 border-zinc-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getGateBadgeClass(status: TaskBranchSnapshot["gateStatus"]) {
  switch (status) {
    case "merged":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "ready":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "blocked":
      return "bg-red-50 text-red-700 border-red-200"
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getTaskStatusBadgeClass(status: TaskStatus) {
  switch (status) {
    case "done":
    case "closed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "testing":
      return "bg-violet-100 text-violet-700 border-violet-200"
    case "in-progress":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "todo":
      return "bg-amber-100 text-amber-700 border-amber-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [task, setTask] = useState<TaskDetailResponse | null>(null)
  const [form, setForm] = useState<EditableTask | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    const loadTask = async () => {
      setLoading(true)
      try {
        const [taskResponse, usersResponse] = await Promise.all([
          fetch(`/api/tasks/${taskId}`, { cache: "no-store" }),
          fetch("/api/users", { cache: "no-store" }),
        ])
        if (!taskResponse.ok) {
          throw new Error(taskResponse.status === 404 ? "任务不存在" : "加载任务失败")
        }

        const data: TaskDetailResponse = await taskResponse.json()
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(Array.isArray(usersData) ? usersData : [])
        } else {
          setUsers([])
          toast({
            title: "用户列表加载失败",
            description: `负责人选择暂不可用（${usersResponse.status}）`,
            variant: "destructive",
          })
        }
        setTask(data)
        setForm({
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          ownerUserId: data.ownerUserId,
        })
      } catch (error) {
        toast({
          title: "加载任务失败",
          description: error instanceof Error ? error.message : "无法获取任务详情",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    void loadTask()
  }, [taskId])

  const summary = useMemo(() => {
    const branches = task?.taskBranches ?? []
    const serviceIds = new Set(branches.flatMap((branch) => branch.services.map((service) => service.id)))
    const prCount = branches.reduce((total, branch) => total + branch.pullRequests.length, 0)

    return {
      branchCount: branches.length,
      serviceCount: serviceIds.size,
      prCount,
    }
  }, [task])

  const handleSave = async () => {
    if (!form) return

    setSaving(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          status: form.status,
          priority: form.priority,
          ownerUserId: form.ownerUserId ?? null,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "保存任务失败")
      }

      const updated: TaskDetailResponse = await response.json()
      setTask(updated)
      setForm({
        title: updated.title,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        ownerUserId: updated.ownerUserId,
      })
      setIsEditing(false)
      toast({ title: "任务已保存", description: "基础信息已更新，需求分支聚合视图已刷新。" })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!task) return
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      ownerUserId: task.ownerUserId,
    })
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">加载任务详情中...</span>
        </div>
      </div>
    )
  }

  if (!task || !form) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>任务不存在</CardTitle>
            <CardDescription>当前任务可能已删除，或数据尚未完成迁移。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/tasks")}>返回任务列表</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/tasks")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">任务详情</h1>
              <p className="text-sm text-muted-foreground">按需求分支聚合查看服务挂靠、开发者和阶段状态。</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <PencilLine className="mr-2 h-4 w-4" />
                编辑任务
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="task-title">任务标题</Label>
                        <Input
                          id="task-title"
                          value={form.title}
                          onChange={(event) => setForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description">任务描述</Label>
                        <Textarea
                          id="task-description"
                          rows={8}
                          value={form.description}
                          onChange={(event) => setForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                          className="resize-y"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <CardTitle className="text-2xl leading-tight">{task.title}</CardTitle>
                      <CardDescription className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">
                        {task.description || "暂无描述"}
                      </CardDescription>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:w-52 md:justify-end">
                  <Badge variant="outline" className={priorityBadgeClass[task.priority]}>
                    {priorityLabels[task.priority]}
                  </Badge>
                  <Badge variant="outline" className={getTaskStatusBadgeClass(task.status)}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="task-status">状态</Label>
                    <select
                      id="task-status"
                      value={form.status}
                      onChange={(event) =>
                        setForm((prev) => (prev ? { ...prev, status: event.target.value as TaskStatus } : prev))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-priority">优先级</Label>
                    <select
                      id="task-priority"
                      value={form.priority}
                      onChange={(event) =>
                        setForm((prev) => (prev ? { ...prev, priority: event.target.value as TaskPriority } : prev))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">负责人</Label>
                    <select
                      id="task-assignee"
                      value={form.ownerUserId ?? "unassigned"}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                ownerUserId: event.target.value === "unassigned" ? undefined : event.target.value,
                              }
                            : prev
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="unassigned">未分配</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                          {user.email ? ` (${user.email})` : ""}
                        </option>
                      ))}
                    </select>
                    {users.length === 0 && (
                      <p className="text-xs text-muted-foreground">暂无可选用户，请先到用户管理中创建。</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">负责人</div>
                    <div className="mt-2 font-medium">{task.assignee?.name || "未分配"}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">创建时间</div>
                    <div className="mt-2 font-medium">{formatDateTime(task.createdAt)}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">更新时间</div>
                    <div className="mt-2 font-medium">{formatDateTime(task.updatedAt)}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">完成时间</div>
                    <div className="mt-2 font-medium">{formatDateTime(task.completedAt)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>需求分支</CardDescription>
                <CardTitle>{summary.branchCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>挂靠服务</CardDescription>
                <CardTitle>{summary.serviceCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>阶段 PR 记录</CardDescription>
                <CardTitle>{summary.prCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                需求分支
              </CardTitle>
              <CardDescription>每个需求分支展示挂靠服务、开发者和阶段化流水线状态。</CardDescription>
            </CardHeader>
            <CardContent>
              {task.taskBranches.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-12 text-center">
                  <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-base font-medium">当前任务还没有需求分支</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Task4 视图已切换到聚合模式，这里不再直接编辑旧的服务分支 JSON。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {task.taskBranches.map((branch) => (
                    <Card key={branch.id} className="border-dashed">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-lg">{branch.title || branch.name}</CardTitle>
                              <Badge variant="outline">{branchStatusLabels[branch.status] || branch.status}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <GitBranch className="h-3.5 w-3.5" />
                                <span className="font-mono text-foreground">{branch.name}</span>
                              </span>
                              <span>{branch.repository?.fullName || branch.repositoryId}</span>
                              <span>最近同步：{formatDateTime(branch.lastSyncedAt)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {branch.services.map((service) => (
                              <Button key={service.id} variant="outline" size="sm" asChild>
                                <Link href={`/services/${service.id}`}>
                                  <Server className="mr-1 h-3.5 w-3.5" />
                                  {service.name}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                          {branch.developers.length > 0 ? (
                            branch.developers.map((developer) => (
                              <Badge key={developer.id} variant="secondary" className="gap-1">
                                <User className="h-3 w-3" />
                                {developer.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无开发者</span>
                          )}
                        </div>

                        <div className="space-y-3">
                          {branch.services.map((service) => {
                            const activeStages = [...(service.stages ?? [])]
                              .filter((stage) => stage.isActive)
                              .sort((left, right) => left.position - right.position)

                            return (
                              <div key={service.id} className="rounded-lg border p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <div className="font-medium">{service.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {activeStages.length > 0
                                        ? `${activeStages.length} 个启用阶段`
                                        : "当前服务尚未配置启用阶段"}
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/services/${service.id}`}>查看服务流水线</Link>
                                  </Button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {activeStages.length > 0 ? (
                                    activeStages.map((stage) => {
                                      const snapshot = branch.snapshots.find(
                                        (item) => item.serviceId === service.id && item.serviceStageId === stage.id,
                                      )
                                      const pullRequest = branch.pullRequests.find(
                                        (item) => item.serviceId === service.id && item.serviceStageId === stage.id,
                                      )
                                      const pullRequestUrl = snapshot?.latestPullRequestUrl || pullRequest?.htmlUrl

                                      return (
                                        <div
                                          key={stage.id}
                                          className="flex min-w-[220px] flex-1 items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{stage.name}</div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              <Badge variant="outline" className={getStageBadgeClass(snapshot?.stageStatus ?? "idle")}>
                                                {stageStatusLabels[snapshot?.stageStatus ?? "idle"]}
                                              </Badge>
                                              <Badge variant="outline" className={getGateBadgeClass(snapshot?.gateStatus ?? "unknown")}>
                                                {gateStatusLabels[snapshot?.gateStatus ?? "unknown"]}
                                              </Badge>
                                            </div>
                                          </div>

                                          {pullRequestUrl ? (
                                            <a
                                              href={pullRequestUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-primary hover:bg-primary/5"
                                              title="查看 PR"
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                            </a>
                                          ) : null}
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <span className="text-sm text-muted-foreground">暂无阶段数据</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
