"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import { resolveServiceFromBranch } from "@/lib/service-branch-utils"
import type { BranchStatus, Service, ServiceBranch, Task } from "@/lib/types"
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  GitMerge,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"

type EnvironmentTab = "test" | "master"

interface BranchWithTask extends ServiceBranch {
  taskId?: string
  taskTitle?: string
}

function getLatestPullRequestUrl(branch: ServiceBranch) {
  return branch.masterPullRequestUrl || branch.testPullRequestUrl || branch.pullRequestUrl
}

function getEnvironmentLabel(tab: EnvironmentTab) {
  return tab === "test" ? "测试环境" : "线上环境"
}

function getEnvironmentPullRequestUrl(branch: BranchWithTask, tab: EnvironmentTab) {
  return tab === "test" ? branch.testPullRequestUrl : branch.masterPullRequestUrl
}

function getEnvironmentMerged(branch: BranchWithTask, tab: EnvironmentTab) {
  return tab === "test" ? Boolean(branch.mergedToTest) : Boolean(branch.mergedToMaster)
}

function getEnvironmentMergeDate(branch: BranchWithTask, tab: EnvironmentTab) {
  return tab === "test" ? branch.testMergeDate : branch.masterMergeDate
}

function sortBranches(branches: BranchWithTask[], tab: EnvironmentTab) {
  return [...branches].sort((a, b) => {
    const aMerged = getEnvironmentMerged(a, tab)
    const bMerged = getEnvironmentMerged(b, tab)

    if (aMerged !== bMerged) {
      return Number(aMerged) - Number(bMerged)
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export default function BranchesPage() {
  const searchParams = useSearchParams()
  const selectedService = searchParams.get("service")

  const [tasks, setTasks] = useState<Task[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [defaultConfigId, setDefaultConfigId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [currentService, setCurrentService] = useState<string>(selectedService || "")
  const [activeTab, setActiveTab] = useState<EnvironmentTab>("test")
  const [mergingBranches, setMergingBranches] = useState<Set<string>>(new Set())
  const [checkingBranches, setCheckingBranches] = useState<Set<string>>(new Set())
  const [refreshingAll, setRefreshingAll] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, servicesRes, settingsRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/services"),
          fetch("/api/settings"),
        ])

        if (tasksRes.ok) {
          setTasks(await tasksRes.json())
        }
        if (servicesRes.ok) {
          setServices(await servicesRes.json())
        }
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          const defaultConfig = settings.githubConfigs?.find((c: { id: string; isDefault: boolean }) => c.isDefault)
          setDefaultConfigId(defaultConfig?.id)
        }
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [])

  const allBranches = useMemo<BranchWithTask[]>(
    () =>
      tasks.flatMap((task) =>
        (task.serviceBranches ?? []).map((branch) => ({
          ...branch,
          taskId: task.id,
          taskTitle: task.title,
        })),
      ),
    [tasks],
  )

  const availableServices = useMemo(
    () =>
      Array.from(
        new Set([
          ...services.map((service) => service.name),
          ...allBranches.map((branch) => branch.serviceName),
        ]),
      ),
    [allBranches, services],
  )

  useEffect(() => {
    if (selectedService && availableServices.includes(selectedService)) {
      setCurrentService(selectedService)
      return
    }

    if (!currentService && availableServices.length > 0) {
      setCurrentService(availableServices[0])
      return
    }

    if (currentService && !availableServices.includes(currentService) && availableServices.length > 0) {
      setCurrentService(availableServices[0])
    }
  }, [availableServices, currentService, selectedService])

  const currentServiceBranches = useMemo(
    () => allBranches.filter((branch) => branch.serviceName === currentService),
    [allBranches, currentService],
  )

  const currentServiceConfig = useMemo(
    () => services.find((service) => service.name === currentService),
    [currentService, services],
  )

  const testBranches = useMemo(() => sortBranches(currentServiceBranches, "test"), [currentServiceBranches])
  const masterBranches = useMemo(() => sortBranches(currentServiceBranches, "master"), [currentServiceBranches])

  const stats = useMemo(() => {
    const total = currentServiceBranches.length
    const testMerged = currentServiceBranches.filter((branch) => branch.mergedToTest).length
    const masterMerged = currentServiceBranches.filter((branch) => branch.mergedToMaster).length
    const testWithPr = currentServiceBranches.filter((branch) => branch.testPullRequestUrl).length
    const masterWithPr = currentServiceBranches.filter((branch) => branch.masterPullRequestUrl).length

    return {
      total,
      testMerged,
      masterMerged,
      testPending: total - testMerged,
      masterPending: total - masterMerged,
      testWithPr,
      masterWithPr,
    }
  }, [currentServiceBranches])

  const updateBranchState = async (
    taskId: string,
    branchId: string,
    updates: Record<string, unknown>,
  ) => {
    const res = await fetch(`/api/tasks/${taskId}/branches/${branchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => null)
      throw new Error(error?.error || "更新服务分支失败")
    }

    const updatedBranch: ServiceBranch = await res.json()

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              serviceBranches: task.serviceBranches?.map((branch) =>
                branch.id === branchId ? { ...branch, ...updatedBranch } : branch,
              ),
            }
          : task,
      ),
    )

    return updatedBranch
  }

  const createPullRequest = async (
    serviceName: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ) => {
    const response = await fetch("/api/github/pull-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceName,
        title,
        head,
        base,
        body,
        configId: defaultConfigId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "创建 Pull Request 失败")
    }

    return response.json()
  }

  const handleMergeToTest = async (branch: BranchWithTask) => {
    const mergeId = `${branch.id}-test`
    setMergingBranches((prev) => new Set(prev).add(mergeId))

    try {
      const service = resolveServiceFromBranch(services, branch)
      const testBranch = service?.testBranch

      if (!service || !testBranch) {
        throw new Error(`服务 "${branch.serviceName}" 未配置测试分支`)
      }

      const pullRequest = await createPullRequest(
        service.name,
        `[TEST][${branch.taskTitle}] Deploy to Test Environment`,
        branch.branchName,
        testBranch,
        `🔄 **测试环境部署 Pull Request**\n\n**任务**: ${branch.taskTitle}\n**分支**: ${branch.branchName}\n**目标**: 测试环境 (${testBranch})`,
      )

      if (branch.taskId) {
        await updateBranchState(branch.taskId, branch.id, {
          testPullRequestUrl: pullRequest.html_url,
          pullRequestUrl: pullRequest.html_url,
          mergedToTest: false,
          testMergeDate: null,
        })
      }

      toast({
        title: "测试环境 PR 创建成功",
        description: `已为 ${branch.branchName} 创建测试环境 PR`,
      })
    } catch (error) {
      toast({
        title: "创建测试环境 PR 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches((prev) => {
        const next = new Set(prev)
        next.delete(mergeId)
        return next
      })
    }
  }

  const handleMergeToMaster = async (branch: BranchWithTask) => {
    const mergeId = `${branch.id}-master`
    setMergingBranches((prev) => new Set(prev).add(mergeId))

    try {
      const service = resolveServiceFromBranch(services, branch)
      const masterBranch = service?.masterBranch

      if (!service || !masterBranch) {
        throw new Error(`服务 "${branch.serviceName}" 未配置线上分支`)
      }

      const pullRequest = await createPullRequest(
        service.name,
        `[PROD][${branch.taskTitle}] Deploy to Production Environment`,
        branch.branchName,
        masterBranch,
        `🚀 **线上环境部署 Pull Request**\n\n**任务**: ${branch.taskTitle}\n**分支**: ${branch.branchName}\n**目标**: 线上环境 (${masterBranch})`,
      )

      if (branch.taskId) {
        await updateBranchState(branch.taskId, branch.id, {
          masterPullRequestUrl: pullRequest.html_url,
          pullRequestUrl: pullRequest.html_url,
          mergedToMaster: false,
          masterMergeDate: null,
        })
      }

      toast({
        title: "线上环境 PR 创建成功",
        description: `已为 ${branch.branchName} 创建线上环境 PR`,
      })
    } catch (error) {
      toast({
        title: "创建线上环境 PR 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches((prev) => {
        const next = new Set(prev)
        next.delete(mergeId)
        return next
      })
    }
  }

  const refreshBranchStatus = async (
    branch: BranchWithTask,
    options?: { silent?: boolean },
  ) => {
    if (!branch.taskId) {
      throw new Error("分支缺少关联任务，无法刷新状态")
    }

    const service = resolveServiceFromBranch(services, branch)
    if (!service) {
      throw new Error(`找不到服务 "${branch.serviceName}" 的配置`)
    }

    const refreshId = branch.id
    setCheckingBranches((prev) => new Set(prev).add(refreshId))

    try {
      const response = await fetch("/api/github/check-merge-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: service.name,
          headBranch: branch.branchName,
          baseBranches: [service.testBranch, service.masterBranch],
          configId: defaultConfigId,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "检查分支状态失败")
      }

      const result = await response.json()
      const branchStatuses = result.branchStatuses || []
      const testStatus = branchStatuses.find((status: BranchStatus) => status.baseBranch === service.testBranch)
      const masterStatus = branchStatuses.find((status: BranchStatus) => status.baseBranch === service.masterBranch)

      const updates: Partial<ServiceBranch> = {
        lastStatusCheck: new Date().toISOString(),
        diffStatus: {},
      }

      if (testStatus) {
        updates.mergedToTest = testStatus.pullRequest?.merged ?? testStatus.isMerged
        updates.testMergeDate = testStatus.pullRequest?.mergedAt ?? null
        updates.testPullRequestUrl = testStatus.pullRequest?.url ?? branch.testPullRequestUrl ?? null

        if (testStatus.diffStatus) {
          updates.diffStatus!.test = {
            status: testStatus.diffStatus.status,
            aheadBy: testStatus.diffStatus.aheadBy,
            behindBy: testStatus.diffStatus.behindBy,
            totalCommits: testStatus.diffStatus.totalCommits,
          }
        }
      }

      if (masterStatus) {
        updates.mergedToMaster = masterStatus.pullRequest?.merged ?? masterStatus.isMerged
        updates.masterMergeDate = masterStatus.pullRequest?.mergedAt ?? null
        updates.masterPullRequestUrl = masterStatus.pullRequest?.url ?? branch.masterPullRequestUrl ?? null

        if (masterStatus.diffStatus) {
          updates.diffStatus!.master = {
            status: masterStatus.diffStatus.status,
            aheadBy: masterStatus.diffStatus.aheadBy,
            behindBy: masterStatus.diffStatus.behindBy,
            totalCommits: masterStatus.diffStatus.totalCommits,
          }
        }
      }

      updates.pullRequestUrl =
        masterStatus?.pullRequest?.url ||
        testStatus?.pullRequest?.url ||
        branch.masterPullRequestUrl ||
        branch.testPullRequestUrl ||
        branch.pullRequestUrl ||
        null

      await updateBranchState(branch.taskId, branch.id, updates)

      if (!options?.silent) {
        toast({
          title: "状态刷新成功",
          description: `测试: ${updates.mergedToTest ? "已合并" : "未合并"}，线上: ${updates.mergedToMaster ? "已合并" : "未合并"}`,
        })
      }
    } finally {
      setCheckingBranches((prev) => {
        const next = new Set(prev)
        next.delete(refreshId)
        return next
      })
    }
  }

  const handleRefreshAll = async () => {
    if (currentServiceBranches.length === 0) {
      return
    }

    setRefreshingAll(true)
    try {
      await Promise.all(currentServiceBranches.map((branch) => refreshBranchStatus(branch, { silent: true })))
      toast({
        title: "全部刷新完成",
        description: `已刷新 ${currentServiceBranches.length} 条分支的最新状态`,
      })
    } catch (error) {
      toast({
        title: "刷新状态失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setRefreshingAll(false)
    }
  }

  const renderBranchList = (tab: EnvironmentTab, branches: BranchWithTask[]) => {
    if (branches.length === 0) {
      return (
        <div className="text-center py-12">
          <GitBranch className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h3 className="text-lg font-semibold mb-2">当前服务下暂无需求分支</h3>
          <p className="text-muted-foreground">当多个任务挂靠到这个服务后，这里会展示它们在 {getEnvironmentLabel(tab)} 的合并状态。</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {branches.map((branch) => {
          const isMerged = getEnvironmentMerged(branch, tab)
          const prUrl = getEnvironmentPullRequestUrl(branch, tab)
          const mergeDate = getEnvironmentMergeDate(branch, tab)
          const isRefreshing = checkingBranches.has(branch.id)
          const isMerging = mergingBranches.has(`${branch.id}-${tab}`)
          const latestPullRequestUrl = getLatestPullRequestUrl(branch)
          const otherTab = tab === "test" ? "master" : "test"
          const otherMerged = getEnvironmentMerged(branch, otherTab)
          const targetBranch = tab === "test" ? currentServiceConfig?.testBranch || "未配置" : currentServiceConfig?.masterBranch || "未配置"

          return (
            <Card key={`${tab}-${branch.id}`} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CardTitle className="text-base truncate">{branch.taskTitle || "未命名需求"}</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="shrink-0">
                            {isMerged ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="ml-1">{isMerged ? "已合并" : "未合并"}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{getEnvironmentLabel(tab)}当前状态</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 bg-muted/40">
                            <GitBranch className="h-3 w-3" />
                            <span className="font-mono text-foreground">{branch.branchName}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>需求分支</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 bg-muted/40">
                            <Server className="h-3 w-3" />
                            <span className="font-mono text-foreground">{targetBranch}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{getEnvironmentLabel(tab)}目标分支</TooltipContent>
                      </Tooltip>

                      {tab === "master" && !branch.mergedToTest && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-amber-600 border-amber-200 bg-amber-50">
                              <AlertCircle className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>测试环境尚未合并，但线上环境可独立推进</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
                          tab === "test" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}>
                          {tab === "test" ? <GitBranch className="h-4 w-4" /> : <GitMerge className="h-4 w-4" />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{getEnvironmentLabel(tab)}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
                          otherMerged ? "border-green-200 bg-green-50 text-green-700" : "border-muted bg-muted/40 text-muted-foreground"
                        }`}>
                          {otherMerged ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{otherTab === "test" ? "测试环境" : "线上环境"}{otherMerged ? "已合并" : "未合并"}</TooltipContent>
                    </Tooltip>

                    {prUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>{tab === "test" ? "查看测试 PR" : "查看线上 PR"}</TooltipContent>
                      </Tooltip>
                    )}

                    {latestPullRequestUrl && latestPullRequestUrl !== prUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={latestPullRequestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-muted bg-muted/40 text-muted-foreground hover:bg-muted/70"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>查看最近 PR</TooltipContent>
                      </Tooltip>
                    )}

                    {mergeDate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-700">
                            <CheckCircle className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>合并时间：{new Date(mergeDate).toLocaleString()}</TooltipContent>
                      </Tooltip>
                    )}

                    {branch.lastStatusCheck && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-muted bg-muted/40 text-muted-foreground">
                            <RefreshCw className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>最近刷新：{new Date(branch.lastStatusCheck).toLocaleString()}</TooltipContent>
                      </Tooltip>
                    )}

                    <Button variant="outline" size="icon" onClick={() => refreshBranchStatus(branch)} disabled={isRefreshing}>
                      {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>

                    {!isMerged && (
                      <Button
                        size="sm"
                        onClick={() => (tab === "test" ? handleMergeToTest(branch) : handleMergeToMaster(branch))}
                        disabled={isMerging}
                        className={tab === "test" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                      >
                        {isMerging ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            创建中
                          </>
                        ) : (
                          <>
                            <GitMerge className="h-3 w-3 mr-1" />
                            合并
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Server className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">服务分支管理</h1>
              <p className="text-sm text-muted-foreground">从服务维度查看该服务下所有需求分支在测试环境和线上环境中的合并状态</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleRefreshAll} disabled={refreshingAll || currentServiceBranches.length === 0}>
              {refreshingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              刷新全部状态
            </Button>
            <Select value={currentService} onValueChange={setCurrentService} disabled={availableServices.length === 0}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="选择服务" />
              </SelectTrigger>
              <SelectContent>
                {availableServices.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : currentService ? (
          <div className="max-w-6xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  {currentService}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border p-4 bg-muted/20">
                  <div className="text-sm text-muted-foreground">分支总数</div>
                  <div className="text-3xl font-semibold mt-2">{stats.total}</div>
                </div>
                <div className="rounded-xl border p-4 bg-blue-50/60 border-blue-200">
                  <div className="text-sm text-blue-800">测试环境</div>
                  <div className="text-2xl font-semibold mt-2">{stats.testMerged}/{stats.total}</div>
                  <div className="text-xs text-blue-700 mt-2">已合并 {stats.testMerged}，待处理 {stats.testPending}，已有 PR {stats.testWithPr}</div>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50/60 border-emerald-200">
                  <div className="text-sm text-emerald-800">线上环境</div>
                  <div className="text-2xl font-semibold mt-2">{stats.masterMerged}/{stats.total}</div>
                  <div className="text-xs text-emerald-700 mt-2">已合并 {stats.masterMerged}，待处理 {stats.masterPending}，已有 PR {stats.masterWithPr}</div>
                </div>
                <div className="rounded-xl border p-4 bg-muted/20">
                  <div className="text-sm text-muted-foreground">目标分支</div>
                  <div className="text-sm mt-2 space-y-1">
                    <div>测试: <span className="font-mono">{currentServiceConfig?.testBranch || "未配置"}</span></div>
                    <div>线上: <span className="font-mono">{currentServiceConfig?.masterBranch || "未配置"}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EnvironmentTab)} className="gap-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="test">
                  测试环境
                  <Badge variant="secondary" className="ml-1">{stats.testMerged}/{stats.total}</Badge>
                </TabsTrigger>
                <TabsTrigger value="master">
                  线上环境
                  <Badge variant="secondary" className="ml-1">{stats.masterMerged}/{stats.total}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="test" className="space-y-4">
                {renderBranchList("test", testBranches)}
              </TabsContent>

              <TabsContent value="master" className="space-y-4">
                {renderBranchList("master", masterBranches)}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12">
            <GitBranch className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">暂无可用服务</h3>
            <p className="text-muted-foreground">请先在服务管理中创建服务，并给任务添加对应的服务分支。</p>
          </div>
        )}
      </div>
    </div>
  )
}
