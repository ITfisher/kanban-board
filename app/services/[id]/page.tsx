"use client"

import Link from "next/link"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { TASK_STATUS_LABELS } from "@/lib/task-status"
import type { TaskPriority, TaskStatus } from "@/lib/types"
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GitBranch,
  LayoutGrid,
  List,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  User,
} from "lucide-react"

type StageSnapshot = {
  id: string
  serviceId: string
  serviceStageId: string
  stageStatus: "idle" | "ready" | "in_progress" | "blocked" | "merged" | "closed"
  gateStatus: "unknown" | "pending" | "ready" | "blocked" | "merged"
  isActionable: boolean
  actionType?: "create_pr" | "sync" | "view_pr" | "noop"
  latestPullRequestNumber?: number
  latestPullRequestState?: "open" | "closed" | "merged"
  latestPullRequestUrl?: string
  latestPullRequestTitle?: string
  latestPullRequestMergeable?: boolean | null
  latestPullRequestMergeableState?: string
  latestPullRequestDraft?: boolean
  latestPullRequestChecks?: {
    state?: "pending" | "success" | "failure" | "error"
    totalCount?: number
    completedCount?: number
    failedCount?: number
  }
  lastSyncedAt?: string
  updatedAt: string
}

type PullRequestView = {
  id: string
  externalNumber?: number
  title: string
  state: "open" | "closed" | "merged"
  merged: boolean
  mergeable?: boolean | null
  mergeableState?: string
  draft?: boolean
  lastSyncedAt?: string
  htmlUrl?: string
}

type BoardDeveloper = {
  id: string
  name: string
}

type ServiceStageView = {
  id: string
  name: string
  key: string
  targetBranch: string
  isActive: boolean
  position: number
  description?: string
  createdAt?: string
  updatedAt?: string
}

type StageBoardItem = {
  taskId: string
  taskTitle: string
  taskStatus: TaskStatus
  taskPriority: TaskPriority
  taskBranchId: string
  branchName: string
  repositoryName?: string
  developers: BoardDeveloper[]
  stageSnapshot: StageSnapshot
  latestPullRequest?: PullRequestView
}

type StageBoardStage = {
  stage: ServiceStageView
  unmerged: StageBoardItem[]
  merged: StageBoardItem[]
}

type ServiceBoardResponse = {
  service: {
    id: string
    name: string
    description: string
    repository: string
    rootPath?: string
    stages: ServiceStageView[]
  }
  stages: ServiceStageView[]
  board: StageBoardStage[]
}

type ViewMode = "list" | "matrix"

type StageConfigDraft = {
  id: string
  name: string
  key: string
  targetBranch: string
  isActive: boolean
  position: number
  description?: string
  createdAt?: string
  updatedAt?: string
}

type MatrixRow = {
  taskId: string
  taskTitle: string
  taskStatus: TaskStatus
  taskPriority: TaskPriority
  taskBranchId: string
  branchName: string
  repositoryName?: string
  cells: Record<string, StageBoardItem>
}

const priorityLabels: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

const stageStatusLabels: Record<StageSnapshot["stageStatus"], string> = {
  idle: "未开始",
  ready: "待提单",
  in_progress: "进行中",
  blocked: "阻塞",
  merged: "已合并",
  closed: "已关闭",
}

const gateStatusLabels: Record<StageSnapshot["gateStatus"], string> = {
  unknown: "未知",
  pending: "待满足",
  ready: "可推进",
  blocked: "阻塞",
  merged: "已完成",
}

const prStateLabels: Record<NonNullable<StageSnapshot["latestPullRequestState"]>, string> = {
  open: "PR 打开",
  closed: "PR 已关闭",
  merged: "PR 已合并",
}

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString()
}

function slugifyStageKey(name: string, fallback: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || fallback
}

function getStageStatusClass(status: StageSnapshot["stageStatus"]) {
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

function getGateStatusClass(status: StageSnapshot["gateStatus"]) {
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

function getPriorityBadgeClass(priority: TaskPriority) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200"
    case "medium":
      return "bg-amber-100 text-amber-700 border-amber-200"
    default:
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
  }
}

function getPrStateClass(state?: StageSnapshot["latestPullRequestState"]) {
  switch (state) {
    case "merged":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "open":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "closed":
      return "bg-zinc-100 text-zinc-700 border-zinc-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getChecksStateClass(state?: "pending" | "success" | "failure" | "error") {
  switch (state) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "failure":
    case "error":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getPrUrl(item: StageBoardItem) {
  return item.latestPullRequest?.htmlUrl || item.stageSnapshot.latestPullRequestUrl
}

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const serviceId = params.id as string

  const [data, setData] = useState<ServiceBoardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingStages, setEditingStages] = useState(false)
  const [savingStages, setSavingStages] = useState(false)
  const [stageDrafts, setStageDrafts] = useState<StageConfigDraft[]>([])
  const [activeStageId, setActiveStageId] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const loadBoard = useCallback(async (options?: { sync?: boolean; silent?: boolean }) => {
    const shouldSync = options?.sync ?? false
    if (shouldSync) {
      setSyncing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch(`/api/services/${serviceId}/stage-board${shouldSync ? "?sync=1" : ""}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(response.status === 404 ? "服务不存在" : "获取服务阶段看板失败")
      }

      const board: ServiceBoardResponse = await response.json()
      setData(board)
      setStageDrafts(
        [...(board.service.stages ?? [])]
          .sort((left, right) => left.position - right.position)
          .map((stage, index) => ({
            id: stage.id,
            name: stage.name,
            key: stage.key,
            targetBranch: stage.targetBranch,
            isActive: stage.isActive,
            position: stage.position ?? index,
            description: stage.description,
            createdAt: stage.createdAt,
            updatedAt: stage.updatedAt,
          }))
      )
      setActiveStageId((current) => {
        if (current && board.stages.some((stage) => stage.id === current)) {
          return current
        }
        return board.stages[0]?.id ?? ""
      })

      if (shouldSync && !options?.silent) {
        toast({ title: "同步完成", description: "服务阶段看板已刷新到最新状态。" })
      }
    } catch (error) {
      toast({
        title: shouldSync ? "同步失败" : "加载失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [serviceId])

  useEffect(() => {
    void loadBoard({ silent: true })
  }, [loadBoard])

  const handleStageDraftChange = useCallback((stageId: string, patch: Partial<StageConfigDraft>) => {
    setStageDrafts((current) =>
      current.map((stage) => {
        if (stage.id !== stageId) {
          return stage
        }

        const nextName = patch.name ?? stage.name
        return {
          ...stage,
          ...patch,
          key: patch.key ?? slugifyStageKey(nextName, stage.key || `stage-${stage.position + 1}`),
        }
      })
    )
  }, [])

  const handleMoveStage = useCallback((index: number, direction: -1 | 1) => {
    setStageDrafts((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current
      }

      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next.map((stage, position) => ({ ...stage, position }))
    })
  }, [])

  const handleAddStage = useCallback(() => {
    setStageDrafts((current) => {
      const nextPosition = current.length
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          name: `阶段 ${nextPosition + 1}`,
          key: `stage-${nextPosition + 1}`,
          targetBranch: "main",
          isActive: true,
          position: nextPosition,
        },
      ]
    })
  }, [])

  const handleRemoveStage = useCallback((stageId: string) => {
    setStageDrafts((current) =>
      current.filter((stage) => stage.id !== stageId).map((stage, position) => ({ ...stage, position }))
    )
  }, [])

  const handleCancelStageEdit = useCallback(() => {
    setEditingStages(false)
    setStageDrafts(
      [...(data?.service.stages ?? [])]
        .sort((left, right) => left.position - right.position)
        .map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          key: stage.key,
          targetBranch: stage.targetBranch,
          isActive: stage.isActive,
          position: stage.position ?? index,
          description: stage.description,
          createdAt: stage.createdAt,
          updatedAt: stage.updatedAt,
        }))
    )
  }, [data?.service.stages])

  const handleSaveStages = useCallback(async () => {
    const normalizedStages = stageDrafts.map((stage, index) => ({
      ...stage,
      name: stage.name.trim(),
      key: slugifyStageKey(stage.name, stage.key || `stage-${index + 1}`),
      targetBranch: stage.targetBranch.trim(),
      position: index,
      description: stage.description?.trim() || "",
    }))

    if (normalizedStages.some((stage) => !stage.name)) {
      toast({ title: "保存失败", description: "阶段名称不能为空", variant: "destructive" })
      return
    }

    if (normalizedStages.some((stage) => !stage.targetBranch)) {
      toast({ title: "保存失败", description: "目标分支不能为空", variant: "destructive" })
      return
    }

    setSavingStages(true)
    try {
      const response = await fetch(`/api/services/${serviceId}/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: normalizedStages }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "保存阶段配置失败")
      }

      setEditingStages(false)
      await loadBoard({ silent: true })
      toast({ title: "阶段配置已保存", description: "启停、排序和目标分支已更新。" })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSavingStages(false)
    }
  }, [loadBoard, serviceId, stageDrafts])

  const currentStageBoard = useMemo(
    () => data?.board.find((entry) => entry.stage.id === activeStageId),
    [activeStageId, data],
  )

  const matrixRows = useMemo<MatrixRow[]>(() => {
    if (!data) return []

    const rowMap = new Map<string, MatrixRow>()

    for (const stageGroup of data.board) {
      for (const item of [...stageGroup.unmerged, ...stageGroup.merged]) {
        const current = rowMap.get(item.taskBranchId)
        if (current) {
          current.cells[stageGroup.stage.id] = item
          continue
        }

        rowMap.set(item.taskBranchId, {
          taskId: item.taskId,
          taskTitle: item.taskTitle,
          taskStatus: item.taskStatus,
          taskPriority: item.taskPriority,
          taskBranchId: item.taskBranchId,
          branchName: item.branchName,
          repositoryName: item.repositoryName,
          cells: {
            [stageGroup.stage.id]: item,
          },
        })
      }
    }

    return [...rowMap.values()].sort((left, right) => left.taskTitle.localeCompare(right.taskTitle, "zh-CN"))
  }, [data])

  const summary = useMemo(() => {
    if (!data) {
      return {
        stageCount: 0,
        branchCount: 0,
        actionableCount: 0,
      }
    }

    const items = data.board.flatMap((stage) => [...stage.unmerged, ...stage.merged])
    return {
      stageCount: data.stages.length,
      branchCount: new Set(items.map((item) => item.taskBranchId)).size,
      actionableCount: items.filter((item) => item.stageSnapshot.isActionable).length,
    }
  }, [data])

  const stageConfigSummary = useMemo(() => {
    const activeCount = stageDrafts.filter((stage) => stage.isActive).length
    return {
      totalCount: stageDrafts.length,
      activeCount,
      inactiveCount: Math.max(stageDrafts.length - activeCount, 0),
    }
  }, [stageDrafts])

  const renderAction = (item: StageBoardItem) => {
    const actionType = item.stageSnapshot.actionType
    const prUrl = getPrUrl(item)

    if (actionType === "view_pr" && prUrl) {
      return (
        <Button size="sm" variant="outline" asChild>
          <a href={prUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            查看 PR
          </a>
        </Button>
      )
    }

    if (actionType === "sync") {
      return (
        <Button size="sm" variant="outline" onClick={() => void loadBoard({ sync: true })} disabled={syncing}>
          {syncing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          同步
        </Button>
      )
    }

    if (actionType === "create_pr") {
      return (
        <Button size="sm" variant="outline" disabled title="Task4 先交付可视化主视图，阶段提单动作后续接入。">
          待创建 PR
        </Button>
      )
    }

    return <span className="text-xs text-muted-foreground">无操作</span>
  }

  const renderItemCard = (item: StageBoardItem) => {
    const prUrl = getPrUrl(item)
    const prState = item.latestPullRequest?.merged ? "merged" : item.latestPullRequest?.state || item.stageSnapshot.latestPullRequestState
    const prNumber = item.latestPullRequest?.externalNumber ?? item.stageSnapshot.latestPullRequestNumber
    const prTitle = item.latestPullRequest?.title || item.stageSnapshot.latestPullRequestTitle
    const checks = item.stageSnapshot.latestPullRequestChecks
    const mergeableState = item.latestPullRequest?.mergeableState || item.stageSnapshot.latestPullRequestMergeableState

    return (
      <Card key={`${item.taskBranchId}-${item.stageSnapshot.serviceStageId}`}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/tasks/${item.taskId}`} className="font-medium text-foreground hover:text-primary">
                  {item.taskTitle}
                </Link>
                <Badge variant="outline" className={getPriorityBadgeClass(item.taskPriority)}>
                  {priorityLabels[item.taskPriority]}
                </Badge>
                <Badge variant="outline">{TASK_STATUS_LABELS[item.taskStatus]}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="font-mono text-foreground">{item.branchName}</span>
                </span>
                <span>{item.repositoryName || "未绑定仓库"}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {item.developers.length > 0 ? (
                  item.developers.map((developer) => (
                    <Badge key={developer.id} variant="secondary" className="gap-1">
                      <User className="h-3 w-3" />
                      {developer.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">暂无开发者</span>
                )}
              </div>

              {prState ? (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={getPrStateClass(prState)}>
                      {prStateLabels[prState]}
                    </Badge>
                    {prNumber ? <Badge variant="outline">#{prNumber}</Badge> : null}
                    {item.stageSnapshot.latestPullRequestDraft ? <Badge variant="outline">Draft</Badge> : null}
                    {mergeableState ? <Badge variant="outline">{mergeableState}</Badge> : null}
                    {checks?.state ? (
                      <Badge variant="outline" className={getChecksStateClass(checks.state)}>
                        检查 {checks.state}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {prTitle || item.stageSnapshot.latestPullRequestTitle || "当前阶段已有 PR 记录"}
                  </div>
                  {checks ? (
                    <div className="text-xs text-muted-foreground">
                      检查结果：{checks.completedCount ?? 0}/{checks.totalCount ?? 0} 已完成，失败 {checks.failedCount ?? 0}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">当前阶段暂无 PR 快照</div>
              )}
            </div>

            <div className="flex min-w-[220px] flex-col items-start gap-2 lg:items-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="outline" className={getStageStatusClass(item.stageSnapshot.stageStatus)}>
                  {stageStatusLabels[item.stageSnapshot.stageStatus]}
                </Badge>
                <Badge variant="outline" className={getGateStatusClass(item.stageSnapshot.gateStatus)}>
                  {gateStatusLabels[item.stageSnapshot.gateStatus]}
                </Badge>
                {item.stageSnapshot.isActionable ? <Badge variant="secondary">可操作</Badge> : null}
              </div>

              <div className="text-xs text-muted-foreground">
                最近同步：{formatDateTime(item.stageSnapshot.lastSyncedAt || item.stageSnapshot.updatedAt)}
              </div>

              <div className="flex items-center gap-2">
                {prUrl ? (
                  <a
                    href={prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-primary hover:bg-primary/5"
                    title="查看 PR"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {renderAction(item)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">加载服务流水线中...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>服务不存在</CardTitle>
            <CardDescription>请返回服务列表确认服务是否仍然存在。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/branches")}>返回流水线入口</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push("/branches")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">{data.service.name}</h1>
                <p className="text-sm text-muted-foreground">{data.service.description || "服务主视角：按阶段查看需求分支状态与操作态。"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Server className="h-3.5 w-3.5" />
                {data.service.repository || "未绑定仓库"}
              </span>
              <span>路径：{data.service.rootPath || "/"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border p-1">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                <List className="mr-1 h-4 w-4" />
                列表
              </Button>
              <Button variant={viewMode === "matrix" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("matrix")}>
                <LayoutGrid className="mr-1 h-4 w-4" />
                矩阵
              </Button>
            </div>
            <Button variant="outline" onClick={() => void loadBoard({ sync: true })} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              同步状态
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>阶段数</CardDescription>
                <CardTitle>{summary.stageCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>需求分支数</CardDescription>
                <CardTitle>{summary.branchCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>可操作单元格</CardDescription>
                <CardTitle>{summary.actionableCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>阶段配置</CardTitle>
                  <CardDescription>在服务详情中直接管理阶段启停、顺序和目标分支。</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">总计 {stageConfigSummary.totalCount}</Badge>
                  <Badge variant="secondary">启用 {stageConfigSummary.activeCount}</Badge>
                  {stageConfigSummary.inactiveCount > 0 ? <Badge variant="outline">停用 {stageConfigSummary.inactiveCount}</Badge> : null}
                  {editingStages ? (
                    <>
                      <Button variant="outline" onClick={handleAddStage} disabled={savingStages}>
                        <Plus className="mr-2 h-4 w-4" />
                        添加阶段
                      </Button>
                      <Button variant="outline" onClick={handleCancelStageEdit} disabled={savingStages}>
                        取消
                      </Button>
                      <Button onClick={() => void handleSaveStages()} disabled={savingStages}>
                        {savingStages ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        保存阶段配置
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setEditingStages(true)}>
                      <PencilLine className="mr-2 h-4 w-4" />
                      编辑阶段
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageDrafts.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">当前服务还没有阶段配置，先添加一个发布阶段。</p>
                  {!editingStages ? (
                    <Button className="mt-4" variant="outline" onClick={() => { setEditingStages(true); handleAddStage() }}>
                      <Plus className="mr-2 h-4 w-4" />
                      添加阶段
                    </Button>
                  ) : null}
                </div>
              ) : editingStages ? (
                stageDrafts.map((stage, index) => (
                  <div key={stage.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_180px_100px_auto]">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">阶段名称</div>
                      <Input
                        value={stage.name}
                        onChange={(event) => handleStageDraftChange(stage.id, { name: event.target.value })}
                        placeholder="例如：QA / 预发 / 生产"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">目标分支</div>
                      <Input
                        value={stage.targetBranch}
                        onChange={(event) => handleStageDraftChange(stage.id, { targetBranch: event.target.value })}
                        placeholder="main"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">启用</div>
                        <div className="text-xs text-muted-foreground">影响看板展示</div>
                      </div>
                      <Switch checked={stage.isActive} onCheckedChange={(checked) => handleStageDraftChange(stage.id, { isActive: checked })} />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="outline" onClick={() => handleMoveStage(index, -1)} disabled={index === 0 || savingStages}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleMoveStage(index, 1)}
                        disabled={index === stageDrafts.length - 1 || savingStages}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleRemoveStage(stage.id)} disabled={savingStages}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="lg:col-span-4 text-xs text-muted-foreground">
                      键值：{stage.key || slugifyStageKey(stage.name, `stage-${index + 1}`)}，排序：{index + 1}
                    </div>
                  </div>
                ))
              ) : (
                stageDrafts
                  .slice()
                  .sort((left, right) => left.position - right.position)
                  .map((stage, index) => (
                    <div key={stage.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{index + 1}. {stage.name}</span>
                          <Badge variant={stage.isActive ? "secondary" : "outline"}>{stage.isActive ? "启用" : "停用"}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">目标分支：<span className="font-mono text-foreground">{stage.targetBranch}</span></div>
                      </div>
                      <div className="text-xs text-muted-foreground">键值：{stage.key}</div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          {data.stages.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-base font-medium">该服务尚未配置启用阶段</h3>
                <p className="mt-2 text-sm text-muted-foreground">Task4 已提供详情页结构，但当前服务还没有可展示的阶段流水线。</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Tabs value={activeStageId} onValueChange={setActiveStageId}>
                <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-lg border bg-background p-1">
                  {data.board.map((entry) => (
                    <TabsTrigger key={entry.stage.id} value={entry.stage.id} className="gap-2">
                      {entry.stage.name}
                      <Badge variant="secondary">{entry.unmerged.length + entry.merged.length}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {viewMode === "list" ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{currentStageBoard?.stage.name || "当前阶段"} · 未合并</CardTitle>
                      <CardDescription>优先展示仍需推进的需求分支。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {currentStageBoard && currentStageBoard.unmerged.length > 0 ? (
                        <div className="space-y-3">{currentStageBoard.unmerged.map(renderItemCard)}</div>
                      ) : (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                          当前阶段暂无未合并分支
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{currentStageBoard?.stage.name || "当前阶段"} · 已合并</CardTitle>
                      <CardDescription>已经完成当前阶段的需求分支。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {currentStageBoard && currentStageBoard.merged.length > 0 ? (
                        <div className="space-y-3">{currentStageBoard.merged.map(renderItemCard)}</div>
                      ) : (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                          当前阶段暂无已合并分支
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>阶段矩阵</CardTitle>
                    <CardDescription>按行查看需求分支，按列查看每个阶段的当前状态与操作态。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <div className="min-w-[960px] overflow-hidden rounded-lg border">
                        <div className="grid bg-muted/40" style={{ gridTemplateColumns: `280px repeat(${data.stages.length}, minmax(180px, 1fr))` }}>
                          <div className="border-b border-r px-4 py-3 text-sm font-medium">需求分支</div>
                          {data.stages.map((stage) => (
                            <div key={stage.id} className="border-b border-r px-4 py-3 text-sm font-medium last:border-r-0">
                              <div>{stage.name}</div>
                              <div className="mt-1 text-xs font-normal text-muted-foreground">{stage.targetBranch}</div>
                            </div>
                          ))}

                          {matrixRows.map((row) => (
                            <Fragment key={row.taskBranchId}>
                              <div className="border-b border-r px-4 py-4">
                                <div className="space-y-2">
                                  <Link href={`/tasks/${row.taskId}`} className="font-medium hover:text-primary">
                                    {row.taskTitle}
                                  </Link>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className={getPriorityBadgeClass(row.taskPriority)}>
                                      {priorityLabels[row.taskPriority]}
                                    </Badge>
                                    <Badge variant="outline">{TASK_STATUS_LABELS[row.taskStatus]}</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <div className="font-mono text-foreground">{row.branchName}</div>
                                    <div>{row.repositoryName || "未绑定仓库"}</div>
                                  </div>
                                </div>
                              </div>

                              {data.stages.map((stage) => {
                                const item = row.cells[stage.id]
                                const prUrl = item ? getPrUrl(item) : undefined
                                const prState = item
                                  ? item.latestPullRequest?.merged
                                    ? "merged"
                                    : item.latestPullRequest?.state || item.stageSnapshot.latestPullRequestState
                                  : undefined
                                return (
                                  <div key={`${row.taskBranchId}-${stage.id}`} className="border-b border-r px-3 py-4 last:border-r-0">
                                    {item ? (
                                      <div className="space-y-2">
                                        <Badge variant="outline" className={getStageStatusClass(item.stageSnapshot.stageStatus)}>
                                          {stageStatusLabels[item.stageSnapshot.stageStatus]}
                                        </Badge>
                                        <Badge variant="outline" className={getGateStatusClass(item.stageSnapshot.gateStatus)}>
                                          {gateStatusLabels[item.stageSnapshot.gateStatus]}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground">
                                          {formatDateTime(item.stageSnapshot.lastSyncedAt || item.stageSnapshot.updatedAt)}
                                        </div>
                                        {prState ? (
                                          <Badge variant="outline" className={getPrStateClass(prState)}>
                                            {prStateLabels[prState]}
                                          </Badge>
                                        ) : null}
                                        {item.stageSnapshot.latestPullRequestChecks?.state ? (
                                          <Badge
                                            variant="outline"
                                            className={getChecksStateClass(item.stageSnapshot.latestPullRequestChecks.state)}
                                          >
                                            检查 {item.stageSnapshot.latestPullRequestChecks.state}
                                          </Badge>
                                        ) : null}
                                        {prUrl ? (
                                          <a
                                            href={prUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                            {item.stageSnapshot.latestPullRequestNumber
                                              ? `PR #${item.stageSnapshot.latestPullRequestNumber}`
                                              : "查看 PR"}
                                          </a>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            {item.stageSnapshot.actionType === "create_pr" ? "可创建 PR" : "无 PR"}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">未挂靠</span>
                                    )}
                                  </div>
                                )
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
