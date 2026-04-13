"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MainLayout } from "@/components/main-layout"
import { toast } from "@/hooks/use-toast"
import { Server, Plus, Activity, GitBranch, Loader2, Edit2, Trash2, X, Check } from "lucide-react"
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
  const [services, setServices] = useState<Service[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingService, setEditingService] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Service>>({})
  const [deletingService, setDeletingService] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, tasksRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/tasks"),
        ])
        if (servicesRes.ok) setServices(await servicesRes.json())
        if (tasksRes.ok) setTasks(await tasksRes.json())
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getServiceTaskCount = (serviceId: string) => {
    return tasks.filter(task => task.serviceId === serviceId).length
  }

  const handleAddService = async (newService: Service) => {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newService),
    })
    if (res.ok) {
      const created = await res.json()
      setServices(prev => [...prev, created])
      toast({ title: "服务已添加", description: `服务"${created.name}"已成功添加` })
    } else {
      toast({ title: "添加失败", description: "无法添加服务，请重试", variant: "destructive" })
    }
  }

  const handleEditStart = (service: Service) => {
    setEditingService(service.id)
    setEditForm({
      name: service.name,
      description: service.description,
      repository: service.repository,
      testBranch: service.testBranch,
      masterBranch: service.masterBranch,
    })
  }

  const handleEditSave = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (!service) return

    const updated = { ...service, ...editForm }
    const res = await fetch(`/api/services/${serviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    })

    if (res.ok) {
      const saved = await res.json()
      setServices(prev => prev.map(s => s.id === serviceId ? saved : s))
      setEditingService(null)
      setEditForm({})
      toast({ title: "服务已更新", description: `服务"${saved.name}"已成功更新` })
    } else {
      toast({ title: "更新失败", description: "无法更新服务，请重试", variant: "destructive" })
    }
  }

  const handleEditCancel = () => {
    setEditingService(null)
    setEditForm({})
  }

  const handleDeleteConfirm = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (!service) return

    const res = await fetch(`/api/services/${serviceId}`, { method: "DELETE" })
    if (res.ok) {
      setServices(prev => prev.filter(s => s.id !== serviceId))
      setDeletingService(null)
      toast({ title: "服务已删除", description: `服务"${service.name}"已被删除` })
    } else {
      toast({ title: "删除失败", description: "无法删除服务，请重试", variant: "destructive" })
    }
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
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
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
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditStart(service)}
                          disabled={editingService !== null || deletingService !== null}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingService(service.id)}
                          disabled={editingService !== null || deletingService !== null}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Delete confirmation */}
                    {deletingService === service.id && (
                      <div className="border border-destructive rounded-lg p-3 bg-destructive/5">
                        <p className="text-sm text-destructive font-medium mb-2">确定要删除此服务吗？</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteConfirm(service.id)}
                          >
                            确认删除
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingService(null)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Edit form */}
                    {editingService === service.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">服务名称</Label>
                          <Input
                            value={editForm.name || ""}
                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">描述</Label>
                          <Textarea
                            value={editForm.description || ""}
                            onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">仓库地址</Label>
                          <Input
                            value={editForm.repository || ""}
                            onChange={e => setEditForm(prev => ({ ...prev, repository: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">测试分支</Label>
                            <Input
                              value={editForm.testBranch || ""}
                              onChange={e => setEditForm(prev => ({ ...prev, testBranch: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">主分支</Label>
                            <Input
                              value={editForm.masterBranch || ""}
                              onChange={e => setEditForm(prev => ({ ...prev, masterBranch: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={handleEditCancel}>
                            <X className="h-3 w-3 mr-1" />
                            取消
                          </Button>
                          <Button size="sm" onClick={() => handleEditSave(service.id)}>
                            <Check className="h-3 w-3 mr-1" />
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
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
