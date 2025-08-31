"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GitBranch, Calendar, User, Tag, ExternalLink, Eye, Plus } from "lucide-react"
import Link from "next/link"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { toast } from "@/hooks/use-toast"

interface ServiceBranch {
  id: string
  serviceName: string
  branchName: string
  status: "active" | "merged" | "closed"
  createdAt: string
  lastCommit?: string
  pullRequestUrl?: string
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
  labels: string[]
  jiraUrl?: string
  serviceId?: string
  serviceBranches?: ServiceBranch[]
}

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  techStack: string[]
  dependencies: string[]
  testBranch: string
  masterBranch: string
}

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateTask?: (task: Task) => void
}

export function TaskDetailDialog({ task, open, onOpenChange, onUpdateTask }: TaskDetailDialogProps) {
  const [services] = useLocalStorage<Service[]>("kanban-services", [])
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [branchName, setBranchName] = useState<string>(`feature/${task.id}`)

  if (!task) return null
  
  const handleCreateBranch = () => {
    if (!selectedServiceId || !branchName.trim()) {
      toast({
        title: "创建失败",
        description: "请选择服务并输入分支名称",
        variant: "destructive"
      })
      return
    }

    const selectedService = services.find(s => s.id === selectedServiceId)
    if (!selectedService) return

    const newBranch: ServiceBranch = {
      id: Date.now().toString(),
      serviceName: selectedService.name,
      branchName: branchName,
      status: "active",
      createdAt: new Date().toISOString(),
    }

    const updatedTask: Task = {
      ...task,
      serviceBranches: [...(task.serviceBranches || []), newBranch],
      serviceId: task.serviceId || selectedServiceId
    }

    if (onUpdateTask) {
      onUpdateTask(updatedTask)
    }

    toast({
      title: "分支创建成功",
      description: `在 ${selectedService.name} 服务中创建分支 ${branchName}`,
    })

    setShowCreateBranch(false)
    setSelectedServiceId("")
    setBranchName(`feature/${task.id}`)
  }

  const getPriorityColor = (priority: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "backlog":
        return "bg-gray-100 text-gray-800"
      case "todo":
        return "bg-blue-100 text-blue-800"
      case "in-progress":
        return "bg-orange-100 text-orange-800"
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "backlog":
        return "待规划"
      case "todo":
        return "待开发"
      case "in-progress":
        return "开发中"
      case "review":
        return "待审核"
      case "done":
        return "已完成"
      default:
        return status
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto hide-scrollbar [&>button]:hidden">
        <DialogHeader>
          <div className="relative">
            <DialogTitle className="text-lg font-semibold text-balance leading-tight pr-12">{task.title}</DialogTitle>
            <Button size="sm" variant="ghost" className="absolute top-0 right-0 h-8 w-8 p-0 hover:bg-muted" asChild>
              <Link href={`/tasks/${task.id}`}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">查看详情页</span>
              </Link>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">状态</span>
              </div>
              <Badge className={`${getStatusColor(task.status)}`}>{getStatusText(task.status)}</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">优先级</span>
              </div>
              <Badge className={`${getPriorityColor(task.priority)}`}>
                {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
              </Badge>
            </div>
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">描述</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description || "暂无描述"}</p>
          </div>

          {/* 负责人 */}
          {task.assignee && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">负责人</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={task.assignee.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-xs">{task.assignee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{task.assignee.name}</span>
              </div>
            </div>
          )}

          {/* JIRA链接 */}
          {task.jiraUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">JIRA需求</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent" asChild>
                <a href={task.jiraUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  查看JIRA需求
                </a>
              </Button>
            </div>
          )}

          {/* 服务分支 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">服务分支</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowCreateBranch(!showCreateBranch)}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                创建分支
              </Button>
            </div>


            {/* 创建分支表单 */}
            {showCreateBranch && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <h4 className="text-sm font-medium">创建新分支</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="service-select" className="text-xs">选择服务</Label>
                    <Select 
                      value={selectedServiceId} 
                      onValueChange={setSelectedServiceId}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="选择一个服务" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id} className="text-xs">
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-name" className="text-xs">分支名称</Label>
                    <Input
                      id="branch-name"
                      placeholder={`feature/${task.id}`}
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleCreateBranch}
                      className="h-7 text-xs"
                    >
                      创建
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setShowCreateBranch(false)
                        setSelectedServiceId("")
                        setBranchName(`feature/${task.id}`)
                      }}
                      className="h-7 text-xs"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 现有分支列表 */}
            {task.serviceBranches && task.serviceBranches.length > 0 && (
              <div className="space-y-2">
                {task.serviceBranches.map((branch) => (
                  <div key={branch.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {branch.serviceName}
                        </Badge>
                        <Badge className={`text-xs ${getBranchStatusColor(branch.status)}`}>
                          {branch.status === "active" ? "活跃" : branch.status === "merged" ? "已合并" : "已关闭"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(branch.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="font-mono text-sm bg-muted/50 rounded px-2 py-1">{branch.branchName}</div>
                    {branch.pullRequestUrl && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-xs bg-transparent" asChild>
                          <a href={branch.pullRequestUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            查看 PR
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!task.serviceBranches?.length && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                暂无服务分支
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
