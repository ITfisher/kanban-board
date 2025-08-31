"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar,
  Users,
  Server,
  FileText,
  BarChart3,
  Edit,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity
} from "lucide-react"

interface Project {
  id: string
  name: string
  description: string
  status: "planning" | "active" | "paused" | "completed" | "archived"
  priority: "low" | "medium" | "high"
  startDate: string
  endDate?: string
  owner: string
  members: string[]
  services: string[]
  tags: string[]
  budget?: number
  progress: number
  createdAt: string
  updatedAt: string
}

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  projectId: string
  techStack: string[]
  dependencies: string[]
  testBranch: string
  masterBranch: string
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
  gitBranch?: string
  projectId: string
  serviceId: string
  labels: string[]
}

interface ProjectDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  services: Service[]
  tasks: Task[]
  onProjectUpdated: (project: Project) => void
}

export function ProjectDetailDialog({
  open,
  onOpenChange,
  project,
  services,
  tasks,
  onProjectUpdated
}: ProjectDetailDialogProps) {
  const projectStats = useMemo(() => {
    const projectServices = services.filter(service => 
      service.projectId === project.id
    )
    
    const projectTasks = tasks.filter(task => 
      task.projectId === project.id
    )

    const statusCounts = projectTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const priorityCounts = projectTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const memberTaskCounts = projectTasks.reduce((acc, task) => {
      if (task.assignee?.name) {
        acc[task.assignee.name] = (acc[task.assignee.name] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    return {
      services: projectServices,
      tasks: projectTasks,
      statusCounts,
      priorityCounts,
      memberTaskCounts,
      completionRate: projectTasks.length > 0 
        ? Math.round((statusCounts.done || 0) / projectTasks.length * 100)
        : 0,
      activeTasksCount: (statusCounts["in-progress"] || 0) + (statusCounts["review"] || 0)
    }
  }, [project, services, tasks])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "planning": return "bg-gray-100 text-gray-800"
      case "active": return "bg-green-100 text-green-800"
      case "paused": return "bg-yellow-100 text-yellow-800"
      case "completed": return "bg-blue-100 text-blue-800"
      case "archived": return "bg-gray-100 text-gray-600"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: Project["priority"]) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800"
      case "medium": return "bg-yellow-100 text-yellow-800"
      case "low": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getServiceStatusColor = (status: Service["status"]) => {
    switch (status) {
      case "healthy": return "bg-green-100 text-green-800"
      case "warning": return "bg-yellow-100 text-yellow-800"
      case "error": return "bg-red-100 text-red-800"
      case "maintenance": return "bg-blue-100 text-blue-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getTaskStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done": return "text-green-600"
      case "in-progress": return "text-yellow-600"
      case "review": return "text-purple-600"
      case "todo": return "text-blue-600"
      case "backlog": return "text-gray-600"
      default: return "text-gray-600"
    }
  }

  const statusLabels: Record<Project["status"], string> = {
    "planning": "规划中",
    "active": "进行中",
    "paused": "暂停",
    "completed": "已完成",
    "archived": "已归档"
  }

  const priorityLabels: Record<Project["priority"], string> = {
    "high": "高优先级",
    "medium": "中优先级",
    "low": "低优先级"
  }

  const taskStatusLabels: Record<Task["status"], string> = {
    "backlog": "待规划",
    "todo": "待开发",
    "in-progress": "开发中",
    "review": "待审核",
    "done": "已完成"
  }

  const serviceStatusLabels: Record<Service["status"], string> = {
    "healthy": "正常",
    "warning": "警告",
    "error": "错误",
    "maintenance": "维护中"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl">{project.name}</DialogTitle>
              <div className="flex gap-2">
                <Badge className={getStatusColor(project.status)}>
                  {statusLabels[project.status]}
                </Badge>
                <Badge className={getPriorityColor(project.priority)}>
                  {priorityLabels[project.priority]}
                </Badge>
              </div>
            </div>
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              编辑项目
            </Button>
          </div>
          {project.description && (
            <p className="text-muted-foreground mt-2">{project.description}</p>
          )}
        </DialogHeader>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="services">服务管理</TabsTrigger>
            <TabsTrigger value="tasks">需求管理</TabsTrigger>
            <TabsTrigger value="team">团队</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">服务数量</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projectStats.services.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">需求总数</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projectStats.tasks.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">完成率</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projectStats.completionRate}%</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">团队人数</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{project.members.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Project Progress */}
            <Card>
              <CardHeader>
                <CardTitle>项目进度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>整体进度</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="w-full" />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  {Object.entries(projectStats.statusCounts).map(([status, count]) => (
                    <div key={status} className="text-center">
                      <div className={`text-lg font-bold ${getTaskStatusColor(status as Task["status"])}`}>
                        {count}
                      </div>
                      <div className="text-muted-foreground">
                        {taskStatusLabels[status as Task["status"]]}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Project Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    项目时间线
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">开始日期</span>
                      <span>{formatDate(project.startDate)}</span>
                    </div>
                    {project.endDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">结束日期</span>
                        <span>{formatDate(project.endDate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">创建时间</span>
                      <span>{formatDate(project.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    项目信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">项目负责人</span>
                      <span>{project.owner || "未设置"}</span>
                    </div>
                    {project.budget && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">项目预算</span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {project.budget.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">活跃需求</span>
                      <span>{projectStats.activeTasksCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tags */}
            {project.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>项目标签</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectStats.services.map((service) => (
                <Card key={service.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      <Badge className={getServiceStatusColor(service.status)}>
                        {serviceStatusLabels[service.status]}
                      </Badge>
                    </div>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">相关需求</span>
                        <span>{projectStats.tasks.filter(task => task.serviceId === service.id).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">技术栈</span>
                        <div className="flex gap-1">
                          {service.techStack.slice(0, 2).map((tech) => (
                            <Badge key={tech} variant="outline" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                          {service.techStack.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{service.techStack.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {projectStats.services.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                该项目暂未关联任何服务
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            {Object.entries(projectStats.statusCounts).map(([status, count]) => (
              count > 0 && (
                <Card key={status}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getTaskStatusColor(status as Task["status"]).replace('text-', 'bg-')}`}></span>
                      {taskStatusLabels[status as Task["status"]]} ({count})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {projectStats.tasks
                        .filter(task => task.status === status)
                        .map((task) => (
                          <div key={task.id} className="flex justify-between items-center p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium">{task.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {task.description}
                              </div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {projectStats.services.find(s => s.id === task.serviceId)?.name || "未知服务"}
                                </Badge>
                                <Badge 
                                  variant={task.priority === "high" ? "destructive" : "outline"}
                                  className="text-xs"
                                >
                                  {task.priority === "high" && "高优先级"}
                                  {task.priority === "medium" && "中优先级"}
                                  {task.priority === "low" && "低优先级"}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {task.assignee?.name || "未分配"}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
            {projectStats.tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                该项目暂未关联任何需求
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>团队成员工作负载</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {project.members.map((member) => {
                    const taskCount = projectStats.memberTaskCounts[member] || 0
                    const percentage = projectStats.tasks.length > 0 
                      ? Math.round((taskCount / projectStats.tasks.length) * 100)
                      : 0
                    
                    return (
                      <div key={member} className="flex items-center justify-between">
                        <span className="font-medium">{member}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {taskCount} 个需求
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                  {project.members.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      暂无团队成员
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}