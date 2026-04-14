"use client"

import Link from "next/link"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { TASK_STATUS_LABELS } from "@/lib/task-status"
import type { TaskPriority, TaskStatus } from "@/lib/types"
import { ExternalLink, GitBranch, LayoutGrid, List, Loader2, Search, Server, User } from "lucide-react"

type StageSnapshot = {
  serviceId: string
  serviceStageId: string
  stageStatus: "idle" | "ready" | "in_progress" | "blocked" | "merged" | "closed"
  gateStatus: "unknown" | "pending" | "ready" | "blocked" | "merged"
  isActionable: boolean
  latestPullRequestNumber?: number
  latestPullRequestState?: "open" | "closed" | "merged"
  latestPullRequestUrl?: string
  latestPullRequestChecks?: {
    state?: "pending" | "success" | "failure" | "error"
  }
  lastSyncedAt?: string
  updatedAt: string
}

type PullRequestView = {
  serviceId: string
  serviceStageId: string
  externalNumber?: number
  title: string
  state: "open" | "closed" | "merged"
  merged: boolean
  htmlUrl?: string
}

type BranchDeveloper = {
  id: string
  name: string
}

type BranchService = {
  id: string
  name: string
  stages?: Array<{
    id: string
    name: string
    targetBranch: string
    isActive: boolean
    position: number
  }>
}

type BranchRowResponse = {
  id: string
  taskId: string
  repositoryId: string
  name: string
  title?: string
  status: string
  updatedAt: string
  lastSyncedAt?: string
  repository?: {
    id: string
    fullName: string
  }
  task?: {
    id: string
    title: string
    status: TaskStatus
    priority: TaskPriority
  }
  services: BranchService[]
  developers: BranchDeveloper[]
  snapshots: StageSnapshot[]
  pullRequests: PullRequestView[]
}

type ViewMode = "list" | "matrix"
type BranchStateFilter = "all" | "actionable" | "blocked" | "merged" | "has-pr"

type MatrixColumn = {
  key: string
  serviceId: string
  serviceName: string
  stageId: string
  stageName: string
  targetBranch: string
  position: number
}

type MatrixCell = {
  column: MatrixColumn
  snapshot?: StageSnapshot
  latestPullRequest?: PullRequestView
  isTracked: boolean
  isMerged: boolean
}

type MatrixBranchRow = {
  branch: BranchRowResponse
  taskTitle: string
  taskStatus: TaskStatus
  taskPriority: TaskPriority
  cells: Record<string, MatrixCell>
  actionableCount: number
  blockedCount: number
  mergedCount: number
  trackedCellCount: number
  hasPullRequest: boolean
  isFullyMerged: boolean
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

function getTrackedCellState(cell: MatrixCell) {
  const stageStatus = cell.snapshot?.stageStatus ?? "idle"
  const gateStatus = cell.snapshot?.gateStatus ?? "unknown"
  const prState = cell.latestPullRequest?.merged ? "merged" : cell.latestPullRequest?.state || cell.snapshot?.latestPullRequestState

  return {
    stageStatus,
    gateStatus,
    prState,
  }
}

function sortBranchRows(rows: MatrixBranchRow[]) {
  return [...rows].sort((left, right) => {
    const leftActionable = left.actionableCount > 0
    const rightActionable = right.actionableCount > 0
    if (leftActionable !== rightActionable) {
      return leftActionable ? -1 : 1
    }

    const leftBlocked = left.blockedCount > 0
    const rightBlocked = right.blockedCount > 0
    if (leftBlocked !== rightBlocked) {
      return leftBlocked ? -1 : 1
    }

    return right.branch.updatedAt.localeCompare(left.branch.updatedAt)
  })
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchRowResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("matrix")
  const [stateFilter, setStateFilter] = useState<BranchStateFilter>("all")
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all")

  async function loadBranches() {
    setLoading(true)
    setLoadError(null)

    try {
      const response = await fetch("/api/task-branches", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(`获取需求分支失败（${response.status}）`)
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        throw new Error("需求分支接口返回的数据格式不正确")
      }

      setBranches(data as BranchRowResponse[])
    } catch (error) {
      console.error("Failed to load branches page data:", error)
      const message = error instanceof Error ? error.message : "加载分支矩阵失败"
      setLoadError(message)
      setBranches([])
      toast({
        title: "加载失败",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBranches()
  }, [])

  const matrixColumns = useMemo<MatrixColumn[]>(() => {
    const map = new Map<string, MatrixColumn>()

    for (const branch of branches) {
      for (const service of branch.services) {
        const activeStages = [...(service.stages ?? [])]
          .filter((stage) => stage.isActive)
          .sort((left, right) => left.position - right.position)

        for (const stage of activeStages) {
          const key = `${service.id}:${stage.id}`
          if (map.has(key)) {
            continue
          }

          map.set(key, {
            key,
            serviceId: service.id,
            serviceName: service.name,
            stageId: stage.id,
            stageName: stage.name,
            targetBranch: stage.targetBranch,
            position: stage.position,
          })
        }
      }
    }

    return [...map.values()].sort((left, right) => {
      const serviceCompare = left.serviceName.localeCompare(right.serviceName, "zh-CN")
      if (serviceCompare !== 0) {
        return serviceCompare
      }
      return left.position - right.position
    })
  }, [branches])

  const branchRows = useMemo<MatrixBranchRow[]>(() => {
    return sortBranchRows(
      branches.map((branch) => {
        const cells: Record<string, MatrixCell> = {}
        let actionableCount = 0
        let blockedCount = 0
        let mergedCount = 0
        let trackedCellCount = 0
        let hasPullRequest = false

        for (const service of branch.services) {
          const activeStages = [...(service.stages ?? [])]
            .filter((stage) => stage.isActive)
            .sort((left, right) => left.position - right.position)

          for (const stage of activeStages) {
            const key = `${service.id}:${stage.id}`
            const snapshot = branch.snapshots.find(
              (item) => item.serviceId === service.id && item.serviceStageId === stage.id
            )
            const latestPullRequest = branch.pullRequests.find(
              (record) => record.serviceId === service.id && record.serviceStageId === stage.id
            )
            const isMerged = Boolean(
              snapshot?.stageStatus === "merged" ||
                snapshot?.gateStatus === "merged" ||
                latestPullRequest?.merged
            )

            cells[key] = {
              column: {
                key,
                serviceId: service.id,
                serviceName: service.name,
                stageId: stage.id,
                stageName: stage.name,
                targetBranch: stage.targetBranch,
                position: stage.position,
              },
              snapshot,
              latestPullRequest,
              isTracked: true,
              isMerged,
            }

            trackedCellCount += 1
            if (snapshot?.isActionable) actionableCount += 1
            if (snapshot?.stageStatus === "blocked" || snapshot?.gateStatus === "blocked") blockedCount += 1
            if (isMerged) mergedCount += 1
            if (latestPullRequest?.htmlUrl || snapshot?.latestPullRequestUrl) hasPullRequest = true
          }
        }

        return {
          branch,
          taskTitle: branch.task?.title ?? branch.title ?? branch.name,
          taskStatus: branch.task?.status ?? "backlog",
          taskPriority: branch.task?.priority ?? "medium",
          cells,
          actionableCount,
          blockedCount,
          mergedCount,
          trackedCellCount,
          hasPullRequest,
          isFullyMerged: trackedCellCount > 0 && trackedCellCount === mergedCount,
        }
      })
    )
  }, [branches])

  const filteredRows = useMemo(() => {
    return branchRows.filter((row) => {
      if (stateFilter === "actionable" && row.actionableCount === 0) return false
      if (stateFilter === "blocked" && row.blockedCount === 0) return false
      if (stateFilter === "merged" && !row.isFullyMerged) return false
      if (stateFilter === "has-pr" && !row.hasPullRequest) return false
      if (taskStatusFilter !== "all" && row.taskStatus !== taskStatusFilter) return false

      const normalized = keyword.trim().toLowerCase()
      if (!normalized) {
        return true
      }

      const haystacks = [
        row.taskTitle,
        row.branch.name,
        row.branch.repository?.fullName ?? "",
        ...row.branch.services.map((service) => service.name),
        ...row.branch.developers.map((developer) => developer.name),
      ]

      return haystacks.some((value) => value.toLowerCase().includes(normalized))
    })
  }, [branchRows, keyword, stateFilter, taskStatusFilter])

  const stats = useMemo(() => {
    return {
      branchCount: branchRows.length,
      actionableCount: branchRows.filter((row) => row.actionableCount > 0).length,
      blockedCount: branchRows.filter((row) => row.blockedCount > 0).length,
      serviceCount: new Set(branches.flatMap((branch) => branch.services.map((service) => service.id))).size,
    }
  }, [branchRows, branches])

  const hasActiveFilters = keyword.trim() !== "" || stateFilter !== "all" || taskStatusFilter !== "all"

  function renderBranchListCard(row: MatrixBranchRow) {
    return (
      <Card key={row.branch.id}>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/tasks/${row.branch.taskId}`} className="font-medium text-foreground hover:text-primary">
                  {row.taskTitle}
                </Link>
                <Badge variant="outline" className={getPriorityBadgeClass(row.taskPriority)}>
                  {row.taskPriority === "high" ? "高" : row.taskPriority === "medium" ? "中" : "低"}
                </Badge>
                <Badge variant="outline">{TASK_STATUS_LABELS[row.taskStatus]}</Badge>
                {row.actionableCount > 0 ? <Badge variant="secondary">可操作 {row.actionableCount}</Badge> : null}
                {row.blockedCount > 0 ? <Badge variant="destructive">阻塞 {row.blockedCount}</Badge> : null}
                {row.isFullyMerged ? <Badge variant="secondary">全阶段已合并</Badge> : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="font-mono text-foreground">{row.branch.name}</span>
                </span>
                <span>{row.branch.repository?.fullName || row.branch.repositoryId}</span>
                <span>最近同步：{formatDateTime(row.branch.lastSyncedAt || row.branch.updatedAt)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {row.branch.developers.length > 0 ? (
                  row.branch.developers.map((developer) => (
                    <Badge key={developer.id} variant="secondary" className="gap-1">
                      <User className="h-3 w-3" />
                      {developer.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">暂无开发者</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {row.branch.services.map((service) => (
                <Button key={service.id} variant="outline" size="sm" asChild>
                  <Link href={`/services/${service.id}`}>
                    <Server className="mr-1 h-3.5 w-3.5" />
                    {service.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {row.branch.services.map((service) => {
              const activeStages = [...(service.stages ?? [])]
                .filter((stage) => stage.isActive)
                .sort((left, right) => left.position - right.position)

              return (
                <div key={service.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-medium">{service.name}</div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/services/${service.id}`}>查看服务</Link>
                    </Button>
                  </div>
                  {activeStages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">当前服务没有启用阶段</div>
                  ) : (
                    <div className="space-y-2">
                      {activeStages.map((stage) => {
                        const cell = row.cells[`${service.id}:${stage.id}`]
                        const state = cell ? getTrackedCellState(cell) : undefined
                        const prUrl = cell?.latestPullRequest?.htmlUrl || cell?.snapshot?.latestPullRequestUrl

                        return (
                          <div key={stage.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{stage.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <Badge variant="outline" className={getStageStatusClass(state?.stageStatus ?? "idle")}>
                                  {stageStatusLabels[state?.stageStatus ?? "idle"]}
                                </Badge>
                                <Badge variant="outline" className={getGateStatusClass(state?.gateStatus ?? "unknown")}>
                                  {gateStatusLabels[state?.gateStatus ?? "unknown"]}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {state?.prState ? (
                                <Badge variant="outline" className={getPrStateClass(state.prState)}>
                                  {prStateLabels[state.prState]}
                                </Badge>
                              ) : null}
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
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">分支矩阵</h1>
            <p className="text-sm text-muted-foreground">按需求分支查看跨服务、跨阶段的当前状态、门禁与 PR 流转。</p>
          </div>

          <div className="flex w-full max-w-3xl flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索任务、分支、仓库、服务或开发者"
                  className="pl-9"
                />
              </div>
              <select
                value={taskStatusFilter}
                onChange={(event) => setTaskStatusFilter(event.target.value as "all" | TaskStatus)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm lg:w-44"
              >
                <option value="all">全部任务状态</option>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex items-center rounded-md border p-1">
                <Button variant={viewMode === "matrix" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("matrix")}>
                  <LayoutGrid className="mr-1 h-4 w-4" />
                  矩阵
                </Button>
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                  <List className="mr-1 h-4 w-4" />
                  列表
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={stateFilter === "all" ? "secondary" : "outline"} size="sm" onClick={() => setStateFilter("all")}>
                全部
              </Button>
              <Button
                variant={stateFilter === "actionable" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStateFilter("actionable")}
              >
                可推进
              </Button>
              <Button
                variant={stateFilter === "blocked" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStateFilter("blocked")}
              >
                阻塞中
              </Button>
              <Button
                variant={stateFilter === "merged" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStateFilter("merged")}
              >
                已全合并
              </Button>
              <Button variant={stateFilter === "has-pr" ? "secondary" : "outline"} size="sm" onClick={() => setStateFilter("has-pr")}>
                有 PR
              </Button>
              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setKeyword("")
                    setStateFilter("all")
                    setTaskStatusFilter("all")
                  }}
                >
                  清除筛选
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>需求分支数</CardDescription>
                <CardTitle>{stats.branchCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>关联服务数</CardDescription>
                <CardTitle>{stats.serviceCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>可推进分支</CardDescription>
                <CardTitle>{stats.actionableCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>阻塞分支</CardDescription>
                <CardTitle>{stats.blockedCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">加载分支矩阵中...</span>
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
              <GitBranch className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <h3 className="text-base font-medium text-destructive">加载失败</h3>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
              <Button className="mt-4" variant="outline" onClick={() => void loadBranches()}>
                重新加载
              </Button>
            </div>
          ) : branchRows.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-medium">暂无需求分支</h3>
              <p className="mt-2 text-sm text-muted-foreground">先创建任务和需求分支，再回到这里查看跨服务阶段流转。</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-16 text-center">
              <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-medium">没有匹配的分支</h3>
              <p className="mt-2 text-sm text-muted-foreground">可以调整搜索关键字或筛选条件。</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              {filteredRows.map(renderBranchListCard)}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>分支阶段矩阵</CardTitle>
                <CardDescription>按行查看需求分支，按列查看其在服务阶段上的当前状态、门禁与 PR。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px] overflow-hidden rounded-lg border">
                    <div
                      className="grid bg-muted/40"
                      style={{ gridTemplateColumns: `320px repeat(${matrixColumns.length || 1}, minmax(180px, 1fr))` }}
                    >
                      <div className="border-b border-r px-4 py-3 text-sm font-medium">需求分支</div>
                      {matrixColumns.length > 0 ? (
                        matrixColumns.map((column) => (
                          <div key={column.key} className="border-b border-r px-4 py-3 text-sm font-medium last:border-r-0">
                            <div>{column.serviceName}</div>
                            <div className="mt-1 text-xs text-foreground/80">{column.stageName}</div>
                            <div className="mt-1 text-xs font-normal text-muted-foreground">{column.targetBranch}</div>
                          </div>
                        ))
                      ) : (
                        <div className="border-b px-4 py-3 text-sm text-muted-foreground">暂无阶段列</div>
                      )}

                      {filteredRows.map((row) => (
                        <Fragment key={row.branch.id}>
                          <div key={`${row.branch.id}-summary`} className="border-b border-r px-4 py-4">
                            <div className="space-y-2">
                              <Link href={`/tasks/${row.branch.taskId}`} className="font-medium hover:text-primary">
                                {row.taskTitle}
                              </Link>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className={getPriorityBadgeClass(row.taskPriority)}>
                                  {row.taskPriority === "high" ? "高" : row.taskPriority === "medium" ? "中" : "低"}
                                </Badge>
                                <Badge variant="outline">{TASK_STATUS_LABELS[row.taskStatus]}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <div className="font-mono text-foreground">{row.branch.name}</div>
                                <div>{row.branch.repository?.fullName || row.branch.repositoryId}</div>
                                <div>最近同步：{formatDateTime(row.branch.lastSyncedAt || row.branch.updatedAt)}</div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {row.branch.developers.length > 0 ? (
                                  row.branch.developers.map((developer) => (
                                    <Badge key={developer.id} variant="secondary" className="gap-1">
                                      <User className="h-3 w-3" />
                                      {developer.name}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">暂无开发者</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {matrixColumns.map((column) => {
                            const cell = row.cells[column.key]
                            const state = cell ? getTrackedCellState(cell) : undefined
                            const prUrl = cell?.latestPullRequest?.htmlUrl || cell?.snapshot?.latestPullRequestUrl

                            return (
                              <div key={`${row.branch.id}-${column.key}`} className="border-b border-r px-3 py-4 last:border-r-0">
                                {cell ? (
                                  <div className="space-y-2">
                                    <Badge variant="outline" className={getStageStatusClass(state?.stageStatus ?? "idle")}>
                                      {stageStatusLabels[state?.stageStatus ?? "idle"]}
                                    </Badge>
                                    <Badge variant="outline" className={getGateStatusClass(state?.gateStatus ?? "unknown")}>
                                      {gateStatusLabels[state?.gateStatus ?? "unknown"]}
                                    </Badge>
                                    {state?.prState ? (
                                      <Badge variant="outline" className={getPrStateClass(state.prState)}>
                                        {prStateLabels[state.prState]}
                                      </Badge>
                                    ) : null}
                                    {cell.snapshot?.latestPullRequestChecks?.state ? (
                                      <Badge
                                        variant="outline"
                                        className={getChecksStateClass(cell.snapshot.latestPullRequestChecks.state)}
                                      >
                                        检查 {cell.snapshot.latestPullRequestChecks.state}
                                      </Badge>
                                    ) : null}
                                    <div className="text-xs text-muted-foreground">
                                      {formatDateTime(cell.snapshot?.lastSyncedAt || cell.snapshot?.updatedAt || row.branch.updatedAt)}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {prUrl ? (
                                        <a
                                          href={prUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          {cell.snapshot?.latestPullRequestNumber
                                            ? `PR #${cell.snapshot.latestPullRequestNumber}`
                                            : "查看 PR"}
                                        </a>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          {cell.snapshot?.isActionable ? "可推进" : "无 PR"}
                                        </span>
                                      )}
                                      <Link href={`/services/${column.serviceId}`} className="text-xs text-muted-foreground hover:text-primary">
                                        查看服务
                                      </Link>
                                    </div>
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
        </div>
      </div>
    </div>
  )
}
