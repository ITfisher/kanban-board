"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { GitBranch, Save, X, GripVertical, Plus } from "lucide-react"
import { TaskDetailDialog } from "./task-detail-dialog"

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

interface TaskCardProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  services: Service[]
  projects: Project[]
  isDragging?: boolean
  compactView?: boolean
  showAssigneeAvatars?: boolean
}

export function TaskCard({ task, onUpdate, onDelete, services, projects, isDragging = false, compactView = false, showAssigneeAvatars = true }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState<Task>(task)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

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

  const handleSave = () => {
    onUpdate(editedTask)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedTask(task)
    setIsEditing(false)
  }

  const handleAddServiceBranch = () => {
    const newBranch: ServiceBranch = {
      id: Date.now().toString(),
      serviceName: services[0]?.name || "默认服务",
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
    setEditedTask({
      ...editedTask,
      serviceBranches: editedTask.serviceBranches?.map((branch) =>
        branch.id === branchId ? { ...branch, ...updates } : branch,
      ),
    })
  }

  const handleDeleteServiceBranch = (branchId: string) => {
    setEditedTask({
      ...editedTask,
      serviceBranches: editedTask.serviceBranches?.filter((branch) => branch.id !== branchId),
    })
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest("button") || e.target.closest("a"))) {
      return
    }
    setShowDetailDialog(true)
  }

  if (isEditing) {
    return (
      <Card className="border-primary/50 shadow-md">
        <CardHeader className="pb-2">
          <Input
            value={editedTask.title}
            onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
            className="font-medium"
            placeholder="任务标题"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={editedTask.description}
            onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
            placeholder="任务描述"
            rows={2}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">优先级</Label>
              <Select
                value={editedTask.priority}
                onValueChange={(value: "low" | "medium" | "high") => setEditedTask({ ...editedTask, priority: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">主服务</Label>
              <Select
                value={editedTask.serviceId}
                onValueChange={(value) => setEditedTask({ ...editedTask, serviceId: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">服务分支</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddServiceBranch}
                className="h-6 text-xs bg-transparent"
              >
                <Plus className="h-3 w-3 mr-1" />
                添加
              </Button>
            </div>

            {editedTask.serviceBranches && editedTask.serviceBranches.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {editedTask.serviceBranches.map((branch) => (
                  <div key={branch.id} className="border rounded p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={branch.serviceName}
                        onValueChange={(value) => handleUpdateServiceBranch(branch.id, { serviceName: value })}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.name}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={branch.status}
                        onValueChange={(value: ServiceBranch["status"]) =>
                          handleUpdateServiceBranch(branch.id, { status: value })
                        }
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">活跃</SelectItem>
                          <SelectItem value="merged">已合并</SelectItem>
                          <SelectItem value="closed">已关闭</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={branch.branchName}
                        onChange={(e) => handleUpdateServiceBranch(branch.id, { branchName: e.target.value })}
                        placeholder="分支名"
                        className="h-6 text-xs font-mono flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteServiceBranch(branch.id)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">负责人</Label>
            <Input
              value={editedTask.assignee?.name || ""}
              onChange={(e) =>
                setEditedTask({
                  ...editedTask,
                  assignee: e.target.value ? { name: e.target.value } : undefined,
                })
              }
              placeholder="负责人姓名"
              className="h-8"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} className="flex-1">
              <Save className="h-3 w-3 mr-1" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1 bg-transparent">
              <X className="h-3 w-3 mr-1" />
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card
        className={`cursor-pointer hover:shadow-md transition-all duration-200 group ${
          isDragging ? "opacity-50 rotate-1 scale-105 shadow-lg" : ""
        }`}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onClick={handleCardClick}
      >
        <CardHeader className={compactView ? "pb-1 px-3 pt-3" : "pb-2"}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <GripVertical className={`${compactView ? "h-3 w-3" : "h-4 w-4"} text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab`} />
              <CardTitle className={`${compactView ? "text-xs" : "text-sm"} font-medium text-balance leading-tight flex-1 hover:text-primary transition-colors`}>
                {task.title}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className={compactView ? "pt-0 px-3 pb-3" : "pt-0"}>
          {!compactView && (
            <p className="text-xs text-muted-foreground mb-3 text-pretty leading-relaxed">{task.description}</p>
          )}

          <div className={compactView ? "space-y-1" : "space-y-2"}>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={compactView ? "text-xs px-1 py-0 h-4" : "text-xs"}>
                {services.find(s => s.id === task.serviceId)?.name || "未知服务"}
              </Badge>
              <Badge className={`${compactView ? "text-xs px-1 py-0 h-4" : "text-xs"} ${getPriorityColor(task.priority)}`}>
                {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
              </Badge>
            </div>

            {task.serviceBranches && task.serviceBranches.length > 0 && !compactView && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">服务分支:</div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {task.serviceBranches.slice(0, 2).map((branch) => (
                    <div key={branch.id} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">{branch.serviceName}:</span>
                      <span className="font-mono flex-1 truncate">{branch.branchName}</span>
                      <Badge className={`text-xs ${getBranchStatusColor(branch.status)}`}>
                        {branch.status === "active" ? "活跃" : branch.status === "merged" ? "已合并" : "已关闭"}
                      </Badge>
                    </div>
                  ))}
                  {task.serviceBranches.length > 2 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{task.serviceBranches.length - 2} 个分支
                    </div>
                  )}
                </div>
              </div>
            )}

            {task.serviceBranches && task.serviceBranches.length > 0 && compactView && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{task.serviceBranches.length} 个分支</span>
              </div>
            )}


            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {!compactView && task.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
                {compactView && task.labels.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                    {task.labels.length} 标签
                  </Badge>
                )}
              </div>

              {task.assignee && showAssigneeAvatars && (
                <div className="flex items-center gap-1">
                  <Avatar className={compactView ? "h-4 w-4" : "h-5 w-5"}>
                    <AvatarImage src={task.assignee.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="text-xs">{task.assignee.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {!compactView && (
                    <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <TaskDetailDialog 
        task={task} 
        open={showDetailDialog} 
        onOpenChange={setShowDetailDialog}
        services={services}
        projects={projects}
      />
    </>
  )
}
