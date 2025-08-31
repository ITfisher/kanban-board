"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { 
  FolderOpen, 
  Plus, 
  Calendar,
  Users,
  Server,
  FileText,
  BarChart3,
  Trash2,
  Edit,
  Eye
} from "lucide-react"
import { AddProjectDialog } from "@/components/add-project-dialog"
import { ProjectDetailDialog } from "@/components/project-detail-dialog"

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
  services: string[] // Service IDs
  tags: string[]
  budget?: number
  progress: number // 0-100
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

export default function ProjectsPage() {
  const [projects, setProjects] = useLocalStorage<Project[]>("kanban-projects", [])
  const [services] = useLocalStorage<Service[]>("kanban-services", [])
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

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

  const getProjectStats = (project: Project) => {
    const projectServices = services.filter(service => 
      service.projectId === project.id
    )
    const projectTasks = tasks.filter(task => 
      task.projectId === project.id
    )

    return {
      servicesCount: projectServices.length,
      tasksCount: projectTasks.length,
      completedTasks: projectTasks.filter(task => task.status === "done").length,
      activeTasks: projectTasks.filter(task => 
        task.status === "in-progress" || task.status === "review"
      ).length
    }
  }

  const handleDeleteProject = (projectId: string) => {
    if (confirm("确定要删除这个项目吗？")) {
      setProjects(projects.filter(p => p.id !== projectId))
    }
  }

  const handleViewProject = (project: Project) => {
    setSelectedProject(project)
    setShowDetailDialog(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN")
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

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">项目管理</h1>
                <p className="text-sm text-muted-foreground">管理项目、服务和需求的整体规划</p>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            </div>
          </div>
        </header>

        {/* Projects Grid */}
        <div className="flex-1 p-6 overflow-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">暂无项目</h3>
              <p className="text-muted-foreground mb-4">
                开始创建第一个项目来管理你的服务和需求
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                创建项目
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => {
                const stats = getProjectStats(project)
                const completionRate = stats.tasksCount > 0 
                  ? Math.round((stats.completedTasks / stats.tasksCount) * 100)
                  : 0

                return (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {project.description}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProject(project)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Status and Priority */}
                      <div className="flex gap-2 flex-wrap">
                        <Badge className={getStatusColor(project.status)}>
                          {statusLabels[project.status]}
                        </Badge>
                        <Badge className={getPriorityColor(project.priority)}>
                          {priorityLabels[project.priority]}
                        </Badge>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span>{stats.servicesCount} 个服务</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{stats.tasksCount} 个需求</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span>{completionRate}% 完成</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{project.members.length} 人参与</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>进度</span>
                          <span>{project.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all" 
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>开始: {formatDate(project.startDate)}</span>
                        </div>
                        {project.endDate && (
                          <div>
                            <span>结束: {formatDate(project.endDate)}</span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {project.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {project.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{project.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        services={services}
        onProjectAdded={(project) => {
          setProjects([...projects, project])
          setShowAddDialog(false)
        }}
      />

      {/* Project Detail Dialog */}
      {selectedProject && (
        <ProjectDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          project={selectedProject}
          services={services}
          tasks={tasks}
          onProjectUpdated={(updatedProject) => {
            setProjects(projects.map(p => 
              p.id === updatedProject.id ? updatedProject : p
            ))
            setSelectedProject(updatedProject)
          }}
        />
      )}
    </MainLayout>
  )
}