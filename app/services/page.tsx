"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AddServiceDialog } from "@/components/add-service-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { getServiceTaskCount } from "@/lib/task-utils"
import type { Service, Task } from "@/lib/types"
import { Activity, Check, Edit2, GitBranch, Loader2, Plus, Server, Trash2, X } from "lucide-react"

type ServiceListItem = Service & {
  repositoryEntity?: {
    id: string
    fullName: string
  }
  stages?: Array<{
    id: string
    isActive: boolean
  }>
}

type ServiceEditForm = Pick<Service, "name" | "description" | "rootPath">

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceListItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingService, setEditingService] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ServiceEditForm>>({})
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

    void fetchData()
  }, [])

  const handleAddService = async (newService: Service) => {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newService),
    })

    if (res.ok) {
      const created = await res.json()
      setServices((prev) => [...prev, created])
      toast({ title: "服务已添加", description: `服务"${created.name}"已成功添加` })
      return
    }

    toast({ title: "添加失败", description: "无法添加服务，请重试", variant: "destructive" })
  }

  const handleEditStart = (service: ServiceListItem) => {
    setEditingService(service.id)
    setEditForm({
      name: service.name,
      description: service.description,
      rootPath: service.rootPath,
    })
  }

  const handleEditSave = async (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId)
    if (!service) return

    const payload: Partial<ServiceEditForm> = {
      name: editForm.name ?? service.name,
      description: editForm.description ?? service.description,
      rootPath: editForm.rootPath ?? service.rootPath,
    }

    const res = await fetch(`/api/services/${serviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const saved = await res.json()
      setServices((prev) => prev.map((item) => (item.id === serviceId ? saved : item)))
      setEditingService(null)
      setEditForm({})
      toast({ title: "服务已更新", description: `服务"${saved.name}"已成功更新` })
      return
    }

    toast({ title: "更新失败", description: "无法更新服务，请重试", variant: "destructive" })
  }

  const handleEditCancel = () => {
    setEditingService(null)
    setEditForm({})
  }

  const handleDeleteConfirm = async (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId)
    if (!service) return

    const res = await fetch(`/api/services/${serviceId}`, { method: "DELETE" })
    if (res.ok) {
      setServices((prev) => prev.filter((item) => item.id !== serviceId))
      setDeletingService(null)
      toast({ title: "服务已删除", description: `服务"${service.name}"已被删除` })
      return
    }

    toast({ title: "删除失败", description: "无法删除服务，请重试", variant: "destructive" })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Server className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">服务管理</h1>
              <p className="text-sm text-muted-foreground">管理项目中的服务、仓库归属和流水线入口</p>
            </div>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加服务
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Server className="mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">暂无服务</h3>
            <p className="mb-4 text-muted-foreground">开始添加服务来管理你的项目</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              添加第一个服务
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const repositoryLabel = service.repositoryEntity?.fullName || service.repository || "未关联仓库"
              const activeStageCount = (service.stages ?? []).filter((stage) => stage.isActive).length
              const relatedTaskCount = getServiceTaskCount(tasks, service.id)

              return (
                <Card key={service.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{service.name}</CardTitle>
                          <CardDescription className="text-sm">{service.description}</CardDescription>
                        </div>
                      </div>
                      <div className="ml-2 flex flex-shrink-0 items-center gap-1">
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
                    {deletingService === service.id && (
                      <div className="rounded-lg border border-destructive bg-destructive/5 p-3">
                        <p className="mb-2 text-sm font-medium text-destructive">确定要删除此服务吗？</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteConfirm(service.id)}>
                            确认删除
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeletingService(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    )}

                    {editingService === service.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">服务名称</Label>
                          <Input
                            value={editForm.name || ""}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">描述</Label>
                          <Textarea
                            value={editForm.description || ""}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">根路径</Label>
                          <Input
                            value={editForm.rootPath || ""}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, rootPath: event.target.value }))}
                            placeholder="例如 services/order"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={handleEditCancel}>
                            <X className="mr-1 h-3 w-3" />
                            取消
                          </Button>
                          <Button size="sm" onClick={() => handleEditSave(service.id)}>
                            <Check className="mr-1 h-3 w-3" />
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">仓库:</span>
                            <span className="truncate font-medium text-xs">{repositoryLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">根路径:</span>
                            <span className="font-medium font-mono text-xs">{service.rootPath || "/"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">关联任务:</span>
                            <span className="font-medium">{relatedTaskCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">启用阶段:</span>
                            <span className="font-medium">{activeStageCount}</span>
                          </div>
                        </div>

                        <Button variant="outline" className="w-full" asChild>
                          <Link href={`/services/${service.id}`}>查看流水线详情</Link>
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {showAddDialog && (
        <AddServiceDialog
          onClose={() => setShowAddDialog(false)}
          onAddService={handleAddService}
          existingServices={services}
        />
      )}
    </div>
  )
}
