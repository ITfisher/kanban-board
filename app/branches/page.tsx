"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { 
  GitBranch, 
  CheckCircle, 
  XCircle, 
  GitMerge, 
  Loader2,
  AlertCircle,
  ExternalLink,
  Server
} from "lucide-react"

interface ServiceBranch {
  id: string
  serviceName: string
  branchName: string
  createdAt: string
  lastCommit?: string
  pullRequestUrl?: string
  mergedToTest?: boolean
  mergedToMaster?: boolean
  testMergeDate?: string
  masterMergeDate?: string
  taskId?: string
  taskTitle?: string
}

interface Task {
  id: string
  title: string
  description: string
  status: "backlog" | "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high"
  assignee?: {
    name: string
    avatar?: string
  }
  serviceBranches?: ServiceBranch[]
  service?: string
}

interface Service {
  id: string
  name: string
  description: string
  repository?: string
  masterBranch?: string
  testBranch?: string
}

export default function BranchesPage() {
  const searchParams = useSearchParams()
  const selectedService = searchParams.get('service')
  
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [services] = useLocalStorage<Service[]>("kanban-services", [])
  const [currentService, setCurrentService] = useState<string>(selectedService || "all")
  const [mergingBranches, setMergingBranches] = useState<Set<string>>(new Set())

  // 获取当前服务的所有分支
  const getServiceBranches = (): ServiceBranch[] => {
    const branches: ServiceBranch[] = []
    
    tasks.forEach(task => {
      if (task.serviceBranches) {
        task.serviceBranches
          .filter(branch => currentService === "all" || branch.serviceName === currentService)
          .forEach(branch => {
            branches.push({
              ...branch,
              taskId: task.id,
              taskTitle: task.title
            })
          })
      }
    })
    
    return branches.filter(branch => !branch.mergedToMaster) // 只显示未合并到主分支的分支
  }

  const serviceBranches = getServiceBranches()
  const availableServices = Array.from(new Set([
    ...services.map(s => s.name),
    ...serviceBranches.map(b => b.serviceName)
  ]))

  useEffect(() => {
    if (selectedService && availableServices.includes(selectedService)) {
      setCurrentService(selectedService)
    } else if (availableServices.length > 0 && currentService === "all" && !selectedService) {
      // 如果有可用服务但没有指定服务，保持显示所有服务
    }
  }, [selectedService, availableServices.join(',')])

  const createPullRequest = async (serviceName: string, title: string, head: string, base: string, body?: string) => {
    const response = await fetch("/api/github/pull-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serviceName,
        title,
        head,
        base,
        body,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create pull request")
    }

    return response.json()
  }

  const handleMergeToTest = async (branch: ServiceBranch) => {
    const mergeId = `${branch.id}-test`
    setMergingBranches(prev => new Set(prev).add(mergeId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[TEST][${branch.taskTitle}] Deploy to Test Environment`,
        branch.branchName,
        "test",
        `🔄 **测试环境部署 Pull Request**\n\n**任务**: ${branch.taskTitle}\n**分支**: ${branch.branchName}\n**目标**: 测试环境 (test)\n\n⚠️ **注意**: 此PR仅用于测试环境部署，不会影响线上环境。\n\n请审核代码质量和功能完整性后合并到测试环境进行验证。`
      )

      toast({
        title: "✅ 测试环境 PR 创建成功",
        description: `已为分支 ${branch.branchName} 创建独立的测试环境 Pull Request`,
      })
    } catch (error) {
      toast({
        title: "❌ 创建测试环境 PR 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches(prev => {
        const newSet = new Set(prev)
        newSet.delete(mergeId)
        return newSet
      })
    }
  }

  const handleMergeToMaster = async (branch: ServiceBranch) => {
    const mergeId = `${branch.id}-master`
    setMergingBranches(prev => new Set(prev).add(mergeId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[PROD][${branch.taskTitle}] Deploy to Production Environment`,
        branch.branchName,
        "master",
        `🚀 **线上环境部署 Pull Request**\n\n**任务**: ${branch.taskTitle}\n**分支**: ${branch.branchName}\n**目标**: 线上环境 (master)\n\n✅ **状态**: ${branch.mergedToTest ? '已通过测试环境验证' : '⚠️ 未验证测试环境'}\n\n🔒 **部署要求**:\n- 代码已在测试环境充分验证\n- 功能测试通过\n- 性能测试通过\n- 安全审查通过\n\n⚠️ **重要**: 此为线上环境部署，请仔细审核后合并。`
      )

      toast({
        title: "🚀 线上环境 PR 创建成功", 
        description: `已为分支 ${branch.branchName} 创建独立的线上环境 Pull Request`,
      })
    } catch (error) {
      toast({
        title: "❌ 创建线上环境 PR 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches(prev => {
        const newSet = new Set(prev)
        newSet.delete(mergeId)
        return newSet
      })
    }
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Server className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">服务分支管理</h1>
                <p className="text-sm text-muted-foreground">管理服务的所有未完成分支及其合并状态</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select value={currentService} onValueChange={setCurrentService}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择服务" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有服务</SelectItem>
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

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {/* 面包屑导航 */}
            {currentService && currentService !== "all" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>服务分支管理</span>
                  <span>/</span>
                  <span className="font-medium text-foreground">{currentService}</span>
                  <Badge variant="outline" className="ml-2">
                    {serviceBranches.length} 个未完成分支
                  </Badge>
                </div>
              </div>
            )}
            {serviceBranches.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">没有找到未完成的分支</h3>
                <p className="text-muted-foreground">
                  {currentService && currentService !== "all"
                    ? `服务 "${currentService}" 下没有未完成合并的分支` 
                    : "当前没有任何未完成合并到主分支的分支"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4">
                  {serviceBranches.map((branch) => (
                    <Card key={branch.id} className="hover:shadow-sm transition-shadow">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">{branch.serviceName}</CardTitle>
                            <CardDescription>
                              分支: <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{branch.branchName}</span>
                            </CardDescription>
                            {branch.taskTitle && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-sm text-muted-foreground">关联任务:</span>
                                <span className="text-sm font-medium">{branch.taskTitle}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* 环境独立性提示 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
                            <AlertCircle className="h-4 w-4" />
                            环境独立部署
                          </div>
                          <p className="text-blue-700 text-xs">
                            测试环境和线上环境的合并操作完全独立，可以同时进行或分别操作，互不影响。
                          </p>
                        </div>
                        
                        {/* 合并状态展示 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 测试环境状态 */}
                          <div className="border rounded-lg p-4 bg-blue-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-800">🟦 测试环境</span>
                                {branch.mergedToTest ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    已合并
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    未合并
                                  </Badge>
                                )}
                              </div>
                              {!branch.mergedToTest && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMergeToTest(branch)}
                                  disabled={mergingBranches.has(`${branch.id}-test`)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {mergingBranches.has(`${branch.id}-test`) ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      创建中...
                                    </>
                                  ) : (
                                    <>
                                      <GitMerge className="h-3 w-3 mr-1" />
                                      合并到测试
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            {branch.mergedToTest && branch.testMergeDate && (
                              <div className="text-xs text-blue-700">
                                合并时间: {new Date(branch.testMergeDate).toLocaleString()}
                              </div>
                            )}
                          </div>

                          {/* 线上环境状态 */}
                          <div className="border rounded-lg p-4 bg-green-50/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-green-800">🔴 线上环境</span>
                                {branch.mergedToMaster ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    已合并
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    未合并
                                  </Badge>
                                )}
                              </div>
                              {!branch.mergedToMaster && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMergeToMaster(branch)}
                                  disabled={mergingBranches.has(`${branch.id}-master`) || !branch.mergedToTest}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {mergingBranches.has(`${branch.id}-master`) ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      创建中...
                                    </>
                                  ) : (
                                    <>
                                      <GitMerge className="h-3 w-3 mr-1" />
                                      合并到线上
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            {!branch.mergedToTest && (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                建议先在测试环境验证
                              </div>
                            )}
                            {branch.mergedToMaster && branch.masterMergeDate && (
                              <div className="text-xs text-green-700">
                                合并时间: {new Date(branch.masterMergeDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 其他信息 */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                          <span>创建于: {new Date(branch.createdAt).toLocaleDateString()}</span>
                          {branch.pullRequestUrl && (
                            <a
                              href={branch.pullRequestUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              查看 PR
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
