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
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"
import {
  Edit,
  Save,
  X,
  User,
  Calendar,
  GitBranch,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  HelpCircle,
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
  jiraUrl?: string
  serviceBranches?: ServiceBranch[]
  createdAt?: string
  updatedAt?: string
}

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
}


export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [tasks, setTasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [services] = useLocalStorage<any[]>("kanban-services", [])
  const [settings] = useLocalStorage<any>("kanban-settings", { githubConfigs: [] })
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
        githubConfigs: settings.githubConfigs || [],
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

  const handleCopyGitCommand = (branchName: string, serviceName: string) => {
    // 查找对应的服务配置获取master分支名
    const service = services.find(s => s.name === serviceName)
    const masterBranch = service?.masterBranch || 'main'
    
    // 单行命令：获取远程信息，智能处理三种场景
    const command = `git fetch origin && (git checkout ${branchName} 2>/dev/null || (git show-ref --verify --quiet refs/remotes/origin/${branchName} && git checkout -b ${branchName} origin/${branchName} || (git checkout -b ${branchName} origin/${masterBranch} && git push -u origin ${branchName})))`

    navigator.clipboard.writeText(command)
    toast({
      title: "已复制Git命令到剪贴板",
      description: `智能分支切换：本地存在→切换，远程存在→检出，都不存在→创建并推送`,
    })
  }

  const handleMergeToTest = async (branchId: string) => {
    if (!editedTask) return

    const branch = editedTask.serviceBranches?.find((b) => b.id === branchId)
    if (!branch) return

    // 从服务配置中获取测试分支名称
    const service = services.find(s => s.name === branch.serviceName)
    const testBranch = service?.testBranch || 'test'

    setMergingBranches((prev) => new Set(prev).add(branchId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[TEST][${editedTask.title}] Merge to Test Branch`,
        branch.branchName,
        testBranch,
        `🔄 **合并到测试分支 Pull Request**\n\n**任务**: ${editedTask.title}\n**描述**: ${editedTask.description}\n**分支**: ${branch.branchName}\n**目标**: 测试分支 (${testBranch})\n\n⚠️ **注意**: 此PR用于将功能分支合并到测试分支，不会影响线上环境。\n\n请审核代码质量和功能完整性后合并到测试分支进行验证。`,
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
        title: "✅ 测试分支合并 PR 创建成功",
        description: `已创建合并到测试分支的 Pull Request: #${pullRequest.number}`,
      })
    } catch (error) {
      console.error("Failed to create pull request:", error)
      toast({
        title: "❌ 创建测试分支合并 PR 失败",
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

    // 从服务配置中获取主分支名称
    const service = services.find(s => s.name === branch.serviceName)
    const masterBranch = service?.masterBranch || 'master'

    setMergingBranches((prev) => new Set(prev).add(branchId))

    try {
      const pullRequest = await createPullRequest(
        branch.serviceName,
        `[PROD][${editedTask.title}] Merge to Master Branch`,
        branch.branchName,
        masterBranch,
        `🚀 **合并到主分支 Pull Request**\n\n**任务**: ${editedTask.title}\n**描述**: ${editedTask.description}\n**分支**: ${branch.branchName}\n**目标**: 主分支 (${masterBranch})\n\n✅ **状态**: ${branch.mergedToTest ? '已通过测试分支验证' : '⚠️ 未验证测试分支'}\n\n🔒 **合并要求**:\n- 代码已在测试分支充分验证\n- 功能测试通过\n- 性能测试通过\n- 安全审查通过\n\n⚠️ **重要**: 此为主分支合并，请仔细审核后合并。`,
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
        title: "🚀 主分支合并 PR 创建成功",
        description: `已创建合并到主分支的 Pull Request: #${pullRequest.number}`,
      })
    } catch (error) {
      console.error("Failed to create pull request:", error)
      toast({
        title: "❌ 创建主分支合并 PR 失败",
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


  if (!task) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <h3 className="text-lg font-semibold mb-2">任务不存在</h3>
          <p className="text-muted-foreground mb-4">找不到指定的任务信息</p>
          <Button onClick={() => router.push("/tasks")}>
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
          <div className="flex items-center justify-end px-6 py-4">
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
                          <Label htmlFor="description">
                            任务描述 
                            <span className="text-xs text-muted-foreground ml-2">
                              支持 Markdown 格式
                            </span>
                          </Label>
                          <div className="mt-2">
                            <MDEditor
                              value={editedTask?.description || ""}
                              onChange={(value) =>
                                setEditedTask(editedTask ? { ...editedTask, description: value || "" } : null)
                              }
                              height={350}
                              data-color-mode="light"
                              visibleDragBar={false}
                              preview="live"
                              hideToolbar={false}
                              toolbarHeight={40}
                              textareaProps={{
                                placeholder: "请输入任务描述，支持 Markdown 格式...\n\n示例:\n# 功能需求\n- 功能点1\n- 功能点2\n\n## 技术要求\n```javascript\n// 代码示例\n```",
                                style: {
                                  fontSize: "14px",
                                  lineHeight: "1.6",
                                  fontFamily: "inherit",
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-2xl mb-2">{task.title}</CardTitle>
                        <div className="text-base">
                          <MDEditor.Markdown 
                            source={task.description || "暂无描述"} 
                            style={{ 
                              whiteSpace: 'pre-wrap',
                              backgroundColor: 'transparent',
                              color: 'inherit',
                              fontSize: 'inherit'
                            }}
                          />
                        </div>
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
                                    {services.map((service) => (
                                      <option key={service.id} value={service.name}>
                                        {service.name}
                                      </option>
                                    ))}
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
                                  <a
                                    href={`/branches?service=${encodeURIComponent(branch.serviceName)}`}
                                    className="text-primary hover:text-primary/80 transition-colors"
                                    title="查看服务分支"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  {branch.mergedToTest && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                      🟢 已合并测试分支
                                    </Badge>
                                  )}
                                  {branch.mergedToMaster && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      🔴 已合并主分支
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
                                    onClick={() => handleCopyGitCommand(branch.branchName, branch.serviceName)}
                                    className="h-7 px-2"
                                    title="复制Git命令：若分支存在则切换，若不存在则从主分支创建"
                                  >
                                    <GitBranch className="h-3 w-3 mr-1" />
                                    复制Git命令
                                  </Button>
                                </div>

                                {/* 合并状态和操作 */}
                                <div className="space-y-3">
                                  {/* 测试分支部分 */}
                                  <div className="border rounded-lg p-3 bg-blue-50/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-blue-800">🟦 测试分支</span>
                                        {branch.mergedToTest && (
                                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                                            ✓ 已合并
                                          </Badge>
                                        )}
                                        {!branch.mergedToTest && (
                                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                                            ✗ 未合并
                                          </Badge>
                                        )}
                                      </div>
                                      {!branch.mergedToTest && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleMergeToTest(branch.id)}
                                          disabled={mergingBranches.has(branch.id)}
                                          className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                        >
                                          {mergingBranches.has(branch.id) ? (
                                            <>
                                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              合并中...
                                            </>
                                          ) : (
                                            "🔄 合并到测试分支"
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

                                  {/* 主分支部分 */}
                                  <div className="border rounded-lg p-3 bg-green-50/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-green-800">🔴 主分支</span>
                                        {branch.mergedToMaster && (
                                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                                            ✓ 已合并
                                          </Badge>
                                        )}
                                        {!branch.mergedToMaster && (
                                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                                            ✗ 未合并
                                          </Badge>
                                        )}
                                      </div>
                                      {!branch.mergedToMaster && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleMergeToMaster(branch.id)}
                                          disabled={mergingBranches.has(branch.id)}
                                          className="h-7 text-xs bg-green-600 text-white hover:bg-green-700 border-green-600"
                                        >
                                          {mergingBranches.has(branch.id) ? (
                                            <>
                                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                              合并中...
                                            </>
                                          ) : (
                                            "🚀 合并到主分支"
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                    {branch.mergedToMaster && branch.masterMergeDate && (
                                      <div className="text-xs text-green-700">
                                        合并时间: {new Date(branch.masterMergeDate).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </div>

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
