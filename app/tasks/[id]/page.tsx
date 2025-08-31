"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  FileText,
  Edit,
  Save,
  X,
  ArrowLeft,
  User,
  Calendar,
  GitBranch,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react"

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
  labels: string[]
  jiraUrl?: string
  serviceBranches?: ServiceBranch[]
  createdAt?: string
  updatedAt?: string
}

interface ServiceBranch {
  id: string
  serviceName: string
  branchName: string
  status: "active" | "merged" | "closed"
  createdAt: string
  lastCommit?: string
  pullRequestUrl?: string
  mergedToTest?: boolean
  mergedToMaster?: boolean
  testMergeDate?: string
  masterMergeDate?: string
}


export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [tasks, setTasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState<Task | null>(null)
  const [mergingBranches, setMergingBranches] = useState<Set<string>>(new Set())

  const task = tasks.find((t) => t.id === taskId)

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task })
    }
  }, [task])

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

  const handleSave = () => {
    if (!editedTask) return

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...editedTask, updatedAt: new Date().toISOString() } : t,
    )
    setTasks(updatedTasks)
    setIsEditing(false)
    toast({
      title: "任务更新成功",
      description: `任务 "${editedTask.title}" 已更新`,
    })
  }

  const handleCancel = () => {
    setEditedTask({ ...task })
    setIsEditing(false)
  }

  const handleAddServiceBranch = () => {
    if (!editedTask) return

    const newBranch: ServiceBranch = {
      id: Date.now().toString(),
      serviceName: "默认服务",
      branchName: `feature/${editedTask.title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      status: "active",
      createdAt: new Date().toISOString(),
    }

    setEditedTask({
      ...editedTask,
      serviceBranches: [...(editedTask.serviceBranches || []), newBranch],
    })
  }

  const handleUpdateServiceBranch = (branchId: string, updates: Partial<ServiceBranch>) => {
    if (!editedTask) return

    setEditedTask({
      ...editedTask,
      serviceBranches: editedTask.serviceBranches?.map((branch) =>
        branch.id === branchId ? { ...branch, ...updates } : branch,
      ),
    })
  }

  const handleDeleteServiceBranch = (branchId: string) => {
    if (!editedTask) return

    setEditedTask({
      ...editedTask,
      serviceBranches: editedTask.serviceBranches?.filter((branch) => branch.id !== branchId),
    })
  }

  const handleCopyGitCommand = (branchName: string) => {
    const command = `git checkout -b ${branchName}`
    navigator.clipboard.writeText(command)
    toast({
      title: "已复制到剪贴板",
      description: `Git命令: ${command}`,
    })
  }

  const handleMergeToTest = async (branchId: string) => {
    if (!editedTask) return

    const branch = editedTask.serviceBranches?.find((b) => b.id === branchId)
    if (!branch) return

    setMergingBranches((prev) => new Set(prev).add(branchId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[${editedTask.title}] Merge to test branch`,
        branch.branchName,
        "test",
        `自动创建的Pull Request\n\n任务: ${editedTask.title}\n描述: ${editedTask.description}`,
      )

      setEditedTask({
        ...editedTask,
        serviceBranches: editedTask.serviceBranches?.map((b) =>
          b.id === branchId
            ? {
                ...b,
                mergedToTest: true,
                testMergeDate: new Date().toISOString(),
                pullRequestUrl: pullRequest.html_url,
              }
            : b,
        ),
      })

      toast({
        title: "Pull Request 创建成功",
        description: `已创建合并到测试分支的 Pull Request: #${pullRequest.number}`,
      })
    } catch (error) {
      console.error("Failed to create pull request:", error)
      toast({
        title: "创建 Pull Request 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches((prev) => {
        const newSet = new Set(prev)
        newSet.delete(branchId)
        return newSet
      })
    }
  }

  const handleMergeToMaster = async (branchId: string) => {
    if (!editedTask) return

    const branch = editedTask.serviceBranches?.find((b) => b.id === branchId)
    if (!branch) return

    setMergingBranches((prev) => new Set(prev).add(branchId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[${editedTask.title}] Merge to master branch`,
        branch.branchName,
        "master",
        `自动创建的Pull Request\n\n任务: ${editedTask.title}\n描述: ${editedTask.description}\n\n已通过测试分支验证`,
      )

      setEditedTask({
        ...editedTask,
        serviceBranches: editedTask.serviceBranches?.map((b) =>
          b.id === branchId
            ? {
                ...b,
                mergedToMaster: true,
                masterMergeDate: new Date().toISOString(),
                pullRequestUrl: pullRequest.html_url,
              }
            : b,
        ),
      })

      toast({
        title: "Pull Request 创建成功",
        description: `已创建合并到主分支的 Pull Request: #${pullRequest.number}`,
      })
    } catch (error) {
      console.error("Failed to create pull request:", error)
      toast({
        title: "创建 Pull Request 失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setMergingBranches((prev) => {
        const newSet = new Set(prev)
        newSet.delete(branchId)
        return newSet
      })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "backlog":
        return "bg-gray-100 text-gray-800"
      case "todo":
        return "bg-blue-100 text-blue-800"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800"
      case "review":
        return "bg-purple-100 text-purple-800"
      case "done":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getBranchStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "merged":
        return "bg-blue-100 text-blue-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const statusLabels = {
    backlog: "待规划",
    todo: "待开发",
    "in-progress": "开发中",
    review: "待审核",
    done: "已完成",
  }

  const priorityLabels = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  }

  const branchStatusLabels = {
    active: "活跃",
    merged: "已合并",
    closed: "已关闭",
  }

  if (!task) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">任务不存在</h3>
          <p className="text-muted-foreground mb-4">找不到指定的任务信息</p>
          <Button onClick={() => router.push("/tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回任务列表
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/tasks")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">任务详情</h1>
                  <p className="text-sm text-muted-foreground">ID: {task.id}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    取消
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">任务标题</Label>
                          <Input
                            id="title"
                            value={editedTask?.title || ""}
                            onChange={(e) =>
                              setEditedTask(editedTask ? { ...editedTask, title: e.target.value } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">任务描述</Label>
                          <Textarea
                            id="description"
                            value={editedTask?.description || ""}
                            onChange={(e) =>
                              setEditedTask(editedTask ? { ...editedTask, description: e.target.value } : null)
                            }
                            rows={4}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-2xl mb-2">{task.title}</CardTitle>
                        <CardDescription className="text-base">{task.description}</CardDescription>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge className={getPriorityColor(task.priority)}>
                      {priorityLabels[task.priority as keyof typeof priorityLabels]}
                    </Badge>
                    <Badge className={getStatusColor(task.status)}>
                      {statusLabels[task.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {task.assignee && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">负责人:</span>
                      <span className="font-medium">{task.assignee.name}</span>
                    </div>
                  )}
                  {task.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">创建时间:</span>
                      <span className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {task.updatedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">更新时间:</span>
                      <span className="font-medium">{new Date(task.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {task.labels.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">标签:</p>
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((label) => (
                        <Badge key={label} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      服务分支
                    </CardTitle>
                    <CardDescription>管理与此任务关联的多个服务分支</CardDescription>
                  </div>
                  {isEditing && (
                    <Button onClick={handleAddServiceBranch} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      添加分支
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(!task.serviceBranches || task.serviceBranches.length === 0) && !isEditing ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>暂无关联的服务分支</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(editedTask?.serviceBranches || task.serviceBranches || []).map((branch) => (
                      <div key={branch.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            {isEditing ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label>服务名称</Label>
                                  <select
                                    value={branch.serviceName}
                                    onChange={(e) =>
                                      handleUpdateServiceBranch(branch.id, { serviceName: e.target.value })
                                    }
                                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                  >
                                      <option value="默认服务">默认服务</option>
                                  </select>
                                </div>
                                <div>
                                  <Label>分支名称</Label>
                                  <Input
                                    value={branch.branchName}
                                    onChange={(e) =>
                                      handleUpdateServiceBranch(branch.id, { branchName: e.target.value })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>状态</Label>
                                  <select
                                    value={branch.status}
                                    onChange={(e) =>
                                      handleUpdateServiceBranch(branch.id, {
                                        status: e.target.value as ServiceBranch["status"],
                                      })
                                    }
                                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                                  >
                                    <option value="active">活跃</option>
                                    <option value="merged">已合并</option>
                                    <option value="closed">已关闭</option>
                                  </select>
                                </div>
                                <div>
                                  <Label>Pull Request URL</Label>
                                  <Input
                                    value={branch.pullRequestUrl || ""}
                                    onChange={(e) =>
                                      handleUpdateServiceBranch(branch.id, { pullRequestUrl: e.target.value })
                                    }
                                    placeholder="https://github.com/..."
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium">{branch.serviceName}</h4>
                                  <Badge className={getBranchStatusColor(branch.status)}>
                                    {branchStatusLabels[branch.status as keyof typeof branchStatusLabels]}
                                  </Badge>
                                  {branch.mergedToTest && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      已合并测试
                                    </Badge>
                                  )}
                                  {branch.mergedToMaster && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      已合并主分支
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-sm text-muted-foreground">分支名:</span>
                                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                                    {branch.branchName}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyGitCommand(branch.branchName)}
                                    className="h-7 px-2"
                                  >
                                    <GitBranch className="h-3 w-3 mr-1" />
                                    复制
                                  </Button>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                  {!branch.mergedToTest && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMergeToTest(branch.id)}
                                      disabled={mergingBranches.has(branch.id)}
                                      className="h-7 text-xs"
                                    >
                                      {mergingBranches.has(branch.id) ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          创建中...
                                        </>
                                      ) : (
                                        "创建测试分支 PR"
                                      )}
                                    </Button>
                                  )}
                                  {!branch.mergedToMaster && branch.mergedToTest && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMergeToMaster(branch.id)}
                                      disabled={mergingBranches.has(branch.id)}
                                      className="h-7 text-xs"
                                    >
                                      {mergingBranches.has(branch.id) ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          创建中...
                                        </>
                                      ) : (
                                        "创建主分支 PR"
                                      )}
                                    </Button>
                                  )}
                                </div>

                                {(branch.mergedToTest || branch.mergedToMaster) && (
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    {branch.mergedToTest && branch.testMergeDate && (
                                      <div>测试分支合并时间: {new Date(branch.testMergeDate).toLocaleString()}</div>
                                    )}
                                    {branch.mergedToMaster && branch.masterMergeDate && (
                                      <div>主分支合并时间: {new Date(branch.masterMergeDate).toLocaleString()}</div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteServiceBranch(branch.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </MainLayout>
  )
}
