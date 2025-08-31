"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, X, GitBranch } from "lucide-react"

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
  projectId: string
  serviceId: string
  labels: string[]
  serviceBranches?: ServiceBranch[]
}

interface Service {
  id: string
  name: string
  projectId: string
}

interface Project {
  id: string
  name: string
}

interface CreateTaskDialogProps {
  onCreateTask: (task: Omit<Task, "id">) => void
  services: Service[]
  projects: Project[]
  defaultStatus?: string
}

export function CreateTaskDialog({ onCreateTask, services, projects, defaultStatus = "backlog" }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: defaultStatus as Task["status"],
    priority: "medium" as Task["priority"],
    assignee: undefined as Task["assignee"],
    projectId: projects?.[0]?.id || "",
    serviceId: services?.[0]?.id || "",
    labels: [] as string[],
    serviceBranches: [] as ServiceBranch[],
  })

  const generateBranchName = (title: string, serviceName: string) => {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
      .replace(/-+/g, "-")
      .trim()
    const cleanService = serviceName.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
    return `feature/${cleanService}-${cleanTitle}-${Date.now()}`
  }

  const handleAddServiceBranch = () => {
    const firstService = services?.[0]
    const newBranch: ServiceBranch = {
      id: Date.now().toString(),
      serviceName: firstService?.name || "默认服务",
      branchName: generateBranchName(newTask.title || "new-task", firstService?.name || "default"),
      status: "active",
      createdAt: new Date().toISOString(),
    }

    setNewTask({
      ...newTask,
      serviceBranches: [...newTask.serviceBranches, newBranch],
    })
  }

  const handleUpdateServiceBranch = (branchId: string, updates: Partial<ServiceBranch>) => {
    setNewTask({
      ...newTask,
      serviceBranches: newTask.serviceBranches.map((branch) =>
        branch.id === branchId ? { ...branch, ...updates } : branch,
      ),
    })
  }

  const handleDeleteServiceBranch = (branchId: string) => {
    setNewTask({
      ...newTask,
      serviceBranches: newTask.serviceBranches.filter((branch) => branch.id !== branchId),
    })
  }

  const handleTitleChange = (title: string) => {
    const updatedServiceBranches = newTask.serviceBranches.map((branch) => ({
      ...branch,
      branchName: generateBranchName(title, branch.serviceName),
    }))

    setNewTask({
      ...newTask,
      title,
      serviceBranches: updatedServiceBranches,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    const taskToCreate = {
      ...newTask,
      assignee: newTask.assignee?.name ? newTask.assignee : undefined,
      labels: newTask.title.includes("前端") ? ["前端"] : newTask.title.includes("后端") ? ["后端"] : ["开发"],
      serviceBranches: newTask.serviceBranches.length > 0 ? newTask.serviceBranches : undefined,
      createdAt: new Date().toISOString(),
    }

    onCreateTask(taskToCreate)
    setNewTask({
      title: "",
      description: "",
      status: defaultStatus as Task["status"],
      priority: "medium",
      assignee: undefined,
      projectId: projects?.[0]?.id || "",
      serviceId: services?.[0]?.id || "",
      labels: [],
      serviceBranches: [],
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新建需求
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新需求</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">需求标题 *</Label>
            <Input
              id="title"
              value={newTask.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="输入需求标题"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">需求描述</Label>
            <Textarea
              id="description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="详细描述需求内容"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">优先级</Label>
              <Select
                value={newTask.priority}
                onValueChange={(value: "low" | "medium" | "high") => setNewTask({ ...newTask, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低优先级</SelectItem>
                  <SelectItem value="medium">中优先级</SelectItem>
                  <SelectItem value="high">高优先级</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="project">所属项目</Label>
              <Select value={newTask.projectId} onValueChange={(value) => {
                setNewTask({ 
                  ...newTask, 
                  projectId: value,
                  serviceId: services.find(s => s.projectId === value)?.id || ""
                })
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="service">主服务</Label>
              <Select value={newTask.serviceId} onValueChange={(value) => setNewTask({ ...newTask, serviceId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择服务" />
                </SelectTrigger>
                <SelectContent>
                  {services
                    ?.filter(service => service.projectId === newTask.projectId)
                    ?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                服务分支
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddServiceBranch}>
                <Plus className="h-4 w-4 mr-1" />
                添加分支
              </Button>
            </div>

            {newTask.serviceBranches.length > 0 && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                {newTask.serviceBranches.map((branch) => (
                  <div key={branch.id} className="space-y-2 border rounded p-3 bg-background">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">服务</Label>
                        <Select
                          value={branch.serviceName}
                          onValueChange={(value) => {
                            const updatedBranch = {
                              serviceName: value,
                              branchName: generateBranchName(newTask.title, value),
                            }
                            handleUpdateServiceBranch(branch.id, updatedBranch)
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {services
                              ?.map((service) => (
                                <SelectItem key={service.id} value={service.name}>
                                  {service.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">状态</Label>
                        <Select
                          value={branch.status}
                          onValueChange={(value: ServiceBranch["status"]) =>
                            handleUpdateServiceBranch(branch.id, { status: value })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">活跃</SelectItem>
                            <SelectItem value="merged">已合并</SelectItem>
                            <SelectItem value="closed">已关闭</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">分支名 (自动生成)</Label>
                        <Input
                          value={branch.branchName}
                          onChange={(e) => handleUpdateServiceBranch(branch.id, { branchName: e.target.value })}
                          className="h-8 font-mono text-xs"
                          placeholder="feature/service-task-name"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteServiceBranch(branch.id)}
                        className="mt-4 h-8 w-8 p-0 text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="assignee">负责人</Label>
            <Input
              id="assignee"
              value={newTask.assignee?.name || ""}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  assignee: e.target.value ? { name: e.target.value } : undefined,
                })
              }
              placeholder="输入负责人姓名"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              创建需求
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
