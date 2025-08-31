"use client"

import { useState } from "react"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Eye, User, GitBranch, Server } from "lucide-react"
import Link from "next/link"

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
  service: string
  labels: string[]
}

export default function RequirementsPage() {
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [selectedPriority, setSelectedPriority] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")

  const filteredTasks = tasks.filter((task) => {
    if (selectedPriority !== "all" && task.priority !== selectedPriority) return false
    if (selectedStatus !== "all" && task.status !== selectedStatus) return false
    return true
  })

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

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">需求详情</h1>
                <p className="text-sm text-muted-foreground">查看和管理所有项目需求</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="border border-border rounded-md px-3 py-1 text-sm bg-background"
              >
                <option value="all">所有优先级</option>
                <option value="high">高优先级</option>
                <option value="medium">中优先级</option>
                <option value="low">低优先级</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-border rounded-md px-3 py-1 text-sm bg-background"
              >
                <option value="all">所有状态</option>
                <option value="backlog">待规划</option>
                <option value="todo">待开发</option>
                <option value="in-progress">开发中</option>
                <option value="review">待审核</option>
                <option value="done">已完成</option>
              </select>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无需求</h3>
              <p className="text-muted-foreground mb-4">
                {tasks.length === 0 ? "还没有创建任何需求" : "没有符合筛选条件的需求"}
              </p>
              <Link href="/requirements">
                <Button>前往看板创建需求</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{task.title}</CardTitle>
                        <CardDescription className="text-sm">{task.description}</CardDescription>
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
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      {task.assignee && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">负责人:</span>
                          <span className="font-medium">{task.assignee.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">服务:</span>
                        <span className="font-medium">{task.service}</span>
                      </div>
                      {task.gitBranch && (
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">分支:</span>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{task.gitBranch}</span>
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

                    <div className="pt-2 border-t">
                      <Link href={`/requirements/${task.id}`}>
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          <Eye className="h-4 w-4 mr-2" />
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
