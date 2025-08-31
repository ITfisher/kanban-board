"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Plus, Server, Edit, Trash2, ExternalLink, Code, Activity } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  techStack: string[]
  dependencies: string[]
  taskCount: number
  testBranch: string
  masterBranch: string
}

interface ServiceManagerProps {
  services: Service[]
  onUpdateServices: (services: Service[]) => void
  taskCounts: Record<string, number>
}


export function ServiceManager({ services: initialServices, onUpdateServices, taskCounts }: ServiceManagerProps) {
  const [services, setServices] = useState<Service[]>(initialServices)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [newService, setNewService] = useState<Partial<Service>>({
    name: "",
    description: "",
    repository: "",
    status: "healthy",
    techStack: [],
    dependencies: [],
    testBranch: "test",
    masterBranch: "main",
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 border-green-200"
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      case "maintenance":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "healthy":
        return "正常"
      case "warning":
        return "警告"
      case "error":
        return "错误"
      case "maintenance":
        return "维护中"
      default:
        return "未知"
    }
  }

  const handleCreateService = () => {
    if (!newService.name?.trim()) return

    const service: Service = {
      id: newService.name.toLowerCase().replace(/\s+/g, "-"),
      name: newService.name,
      description: newService.description || "",
      repository: newService.repository || "",
      status: (newService.status as Service["status"]) || "healthy",
      techStack: newService.techStack || [],
      dependencies: newService.dependencies || [],
      taskCount: taskCounts[newService.name] || 0,
      testBranch: newService.testBranch || "test",
      masterBranch: newService.masterBranch || "main",
    }

    const updatedServices = [...services, service]
    setServices(updatedServices)
    onUpdateServices(updatedServices)

    setNewService({
      name: "",
      description: "",
      repository: "",
      status: "healthy",
      techStack: [],
      dependencies: [],
      testBranch: "test",
      masterBranch: "main",
    })
    setIsCreateDialogOpen(false)
  }

  const handleUpdateService = (updatedService: Service) => {
    const updatedServices = services.map((service) => (service.id === updatedService.id ? updatedService : service))
    setServices(updatedServices)
    onUpdateServices(updatedServices)
    setEditingService(null)
  }

  const handleDeleteService = (serviceId: string) => {
    const updatedServices = services.filter((service) => service.id !== serviceId)
    setServices(updatedServices)
    onUpdateServices(updatedServices)
  }

  const ServiceForm = ({
    service,
    onSave,
    onCancel,
  }: { service: Partial<Service>; onSave: (service: Service) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState(service)

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">服务名称 *</Label>
          <Input
            id="name"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="输入服务名称"
          />
        </div>

        <div>
          <Label htmlFor="description">服务描述</Label>
          <Textarea
            id="description"
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="描述服务的功能和用途"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="testBranch">测试分支</Label>
            <Input
              id="testBranch"
              value={formData.testBranch || ""}
              onChange={(e) => setFormData({ ...formData, testBranch: e.target.value })}
              placeholder="test"
            />
          </div>

          <div>
            <Label htmlFor="masterBranch">Master 分支</Label>
            <Input
              id="masterBranch"
              value={formData.masterBranch || ""}
              onChange={(e) => setFormData({ ...formData, masterBranch: e.target.value })}
              placeholder="main"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="status">服务状态</Label>
          <Select
            value={formData.status || "healthy"}
            onValueChange={(value: Service["status"]) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="healthy">正常</SelectItem>
              <SelectItem value="warning">警告</SelectItem>
              <SelectItem value="error">错误</SelectItem>
              <SelectItem value="maintenance">维护中</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="repository">代码仓库</Label>
          <Input
            id="repository"
            value={formData.repository || ""}
            onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
            placeholder="https://github.com/company/service-name"
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={() => {
              if (formData.name) {
                onSave(formData as Service)
              }
            }}
            className="flex-1"
          >
            保存
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
            取消
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5" />
          服务管理
        </h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              添加服务
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>添加新服务</DialogTitle>
            </DialogHeader>
            <ServiceForm
              service={newService}
              onSave={handleCreateService}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.id} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${getStatusColor(service.status)}`}>
                    <Activity className="h-3 w-3 mr-1" />
                    {getStatusText(service.status)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingService(service)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteService(service.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">测试分支:</span>
                    <Badge variant="outline" className="text-xs">
                      {service.testBranch}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Master分支:</span>
                    <Badge variant="outline" className="text-xs">
                      {service.masterBranch}
                    </Badge>
                  </div>
                  {service.repository && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={service.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        查看代码仓库
                      </a>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground text-xs">任务数量:</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {taskCounts[service.name] || 0}
                    </Badge>
                  </div>
                </div>
              </div>

              {service.techStack.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">技术栈:</div>
                    <div className="flex flex-wrap gap-1">
                      {service.techStack.map((tech) => (
                        <Badge key={tech} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {service.dependencies.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">依赖服务:</div>
                    <div className="flex flex-wrap gap-1">
                      {service.dependencies.map((dep) => (
                        <Badge key={dep} variant="secondary" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {editingService && (
        <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>编辑服务</DialogTitle>
            </DialogHeader>
            <ServiceForm
              service={editingService}
              onSave={handleUpdateService}
              onCancel={() => setEditingService(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
