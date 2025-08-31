"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { Server, Plus, Activity, GitBranch } from "lucide-react"
import { AddServiceDialog } from "@/components/add-service-dialog"

interface Service {
  id: string
  name: string
  description: string
  repository: string
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
  serviceId: string
}

export default function ServicesPage() {
  const [services, setServices] = useLocalStorage<Service[]>("kanban-services", [])
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [showAddDialog, setShowAddDialog] = useState(false)

  const getServiceTaskCount = (serviceId: string) => {
    return tasks.filter(task => task.serviceId === serviceId).length
  }


  const handleAddService = (newService: Service) => {
    setServices([...services, newService])
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Server className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">服务管理</h1>
                <p className="text-sm text-muted-foreground">管理项目中的所有服务和配置</p>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加服务
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Server className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无服务</h3>
              <p className="text-muted-foreground mb-4">开始添加服务来管理你的项目</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一个服务
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{service.name}</CardTitle>
                          <CardDescription className="text-sm">{service.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">测试分支:</span>
                        <span className="font-medium font-mono text-xs">{service.testBranch}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">任务:</span>
                        <span className="font-medium">{getServiceTaskCount(service.id)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Master分支:</span>
                        <span className="font-medium font-mono text-xs">{service.masterBranch}</span>
                      </div>
                    </div>


                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        仓库: <span className="font-mono">{service.repository}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Service Dialog */}
        {showAddDialog && (
          <AddServiceDialog
            onClose={() => setShowAddDialog(false)}
            onAddService={handleAddService}
            existingServices={services}
          />
        )}
      </div>
    </MainLayout>
  )
}
