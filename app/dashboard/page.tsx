"use client"

import type React from "react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Activity,
  GitBranch
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
  gitBranch?: string
  serviceId: string
  labels: string[]
}

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  owner: string
  techStack: string[]
  dependencies: string[]
  lastDeployment: string
  version: string
}

export default function Dashboard() {
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [services] = useLocalStorage<Service[]>("kanban-services", [])

  const stats = useMemo(() => {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const priorityCounts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const serviceCounts = tasks.reduce((acc, task) => {
      const service = services.find(s => s.id === task.serviceId)
      const serviceName = service?.name || "未知服务"
      acc[serviceName] = (acc[serviceName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const assigneeCounts = tasks.reduce((acc, task) => {
      if (task.assignee?.name) {
        acc[task.assignee.name] = (acc[task.assignee.name] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const completionRate = tasks.length > 0 ? 
      Math.round((statusCounts.done || 0) / tasks.length * 100) : 0

    const activeTasksCount = (statusCounts["in-progress"] || 0) + (statusCounts["review"] || 0)

    return {
      total: tasks.length,
      statusCounts,
      priorityCounts,
      serviceCounts,
      assigneeCounts,
      completionRate,
      activeTasksCount,
      servicesCount: Object.keys(serviceCounts).length
    }
  }, [tasks])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "text-green-600 bg-green-50"
      case "in-progress": return "text-yellow-600 bg-yellow-50"
      case "review": return "text-purple-600 bg-purple-50"
      case "todo": return "text-blue-600 bg-blue-50"
      case "backlog": return "text-gray-600 bg-gray-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 bg-red-50"
      case "medium": return "text-yellow-600 bg-yellow-50"
      case "low": return "text-green-600 bg-green-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-foreground">仪表盘</h1>
            <p className="text-sm text-muted-foreground">项目数据统计与分析</p>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总任务数</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  分布在 {stats.servicesCount} 个服务中
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">完成率</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.statusCounts.done || 0} 个任务已完成
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">进行中任务</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeTasksCount}</div>
                <p className="text-xs text-muted-foreground">
                  开发中 + 待审核
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">参与人数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(stats.assigneeCounts).length}</div>
                <p className="text-xs text-muted-foreground">
                  活跃开发者
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  任务状态分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.statusCounts).map(([status, count]) => {
                  const statusLabels: Record<string, string> = {
                    "backlog": "待规划",
                    "todo": "待开发", 
                    "in-progress": "开发中",
                    "review": "待审核",
                    "done": "已完成"
                  }
                  const percentage = Math.round((count / stats.total) * 100)
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(status)}>
                          {statusLabels[status]}
                        </Badge>
                        <span className="text-sm">{count} 个任务</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  优先级分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.priorityCounts).map(([priority, count]) => {
                  const priorityLabels: Record<string, string> = {
                    "high": "高优先级",
                    "medium": "中优先级",
                    "low": "低优先级"
                  }
                  const percentage = Math.round((count / stats.total) * 100)
                  
                  return (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(priority)}>
                          {priorityLabels[priority]}
                        </Badge>
                        <span className="text-sm">{count} 个任务</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Service and Team Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  服务任务分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(stats.serviceCounts)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([service, count]) => {
                    const percentage = Math.round((count / stats.total) * 100)
                    
                    return (
                      <div key={service} className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate flex-1 mr-2">
                          {service}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>

            {/* Team Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  团队工作负载
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(stats.assigneeCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([assignee, count]) => {
                    const percentage = Math.round((count / stats.total) * 100)
                    
                    return (
                      <div key={assignee} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{assignee}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(stats.assigneeCounts).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    暂无分配的任务
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