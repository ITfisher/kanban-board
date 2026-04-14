"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, ExternalLink, GitBranch, Trash2 } from "lucide-react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { toast } from "@/hooks/use-toast"
import { useAppSettings } from "@/hooks/use-app-settings"
import { buildTaskBranchName } from "@/lib/branch-name"
import type { Service, Task } from "@/lib/types"

interface CreateTaskDialogProps {
  onCreateTask: (task: Omit<Task, "id">) => void
  defaultStatus?: string
  defaultPriority?: Task["priority"]
}

interface ServiceBranchDraft {
  id: string
  serviceId: string
  branchName: string
  branchNameTouched: boolean
  seed: number
}

function createInitialTask(defaultStatus: Task["status"], defaultPriority: Task["priority"]) {
  return {
    title: "",
    description: "",
    status: defaultStatus,
    priority: defaultPriority,
    assignee: undefined as Task["assignee"],
    jiraUrl: "",
  }
}

export function CreateTaskDialog({
  onCreateTask,
  defaultStatus = "backlog",
  defaultPriority = "medium",
}: CreateTaskDialogProps) {
  const { resolvedTheme } = useTheme()
  const { settings } = useAppSettings()
  const [open, setOpen] = useState(false)
  const [newTask, setNewTask] = useState(() => createInitialTask(defaultStatus as Task["status"], defaultPriority))
  const [services, setServices] = useState<Service[]>([])
  const [branchDrafts, setBranchDrafts] = useState<ServiceBranchDraft[]>([])

  useEffect(() => {
    if (!open) {
      setNewTask(createInitialTask(defaultStatus as Task["status"], defaultPriority))
      setBranchDrafts([])
    }
  }, [defaultPriority, defaultStatus, open])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const loadServices = async () => {
      try {
        const response = await fetch("/api/services")
        if (!response.ok) {
          throw new Error("Failed to load services")
        }

        const data: Service[] = await response.json()
        if (!cancelled) {
          setServices(Array.isArray(data) ? data : [])
        }
      } catch {
        if (!cancelled) {
          setServices([])
        }
      }
    }

    void loadServices()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    setBranchDrafts((prev) =>
      prev.map((draft) =>
        draft.branchNameTouched
          ? draft
          : {
              ...draft,
              branchName: buildTaskBranchName(settings.branchPrefix, newTask.title || "task", draft.seed),
            },
      ),
    )
  }, [newTask.title, settings.branchPrefix])

  const handleAddBranchDraft = () => {
    const seed = Date.now()
    setBranchDrafts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        serviceId: "",
        branchName: buildTaskBranchName(settings.branchPrefix, newTask.title || "task", seed),
        branchNameTouched: false,
        seed,
      },
    ])
  }

  const handleUpdateBranchDraft = (draftId: string, updates: Partial<ServiceBranchDraft>) => {
    setBranchDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, ...updates } : draft)))
  }

  const handleDeleteBranchDraft = (draftId: string) => {
    setBranchDrafts((prev) => prev.filter((draft) => draft.id !== draftId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    if (!newTask.assignee?.name?.trim()) {
      toast({
        title: "请填写负责人",
        description: "负责人不能为空",
        variant: "destructive",
      })
      return
    }

    for (const draft of branchDrafts) {
      if (!draft.serviceId) {
        toast({
          title: "请选择服务",
          description: "每条服务分支都需要选择所属服务",
          variant: "destructive",
        })
        return
      }

      if (!draft.branchName.trim()) {
        toast({
          title: "请输入分支名",
          description: "每条服务分支都需要填写分支名",
          variant: "destructive",
        })
        return
      }
    }

    const taskToCreate = {
      ...newTask,
      assignee: newTask.assignee?.name ? newTask.assignee : undefined,
      jiraUrl: newTask.jiraUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
      serviceBranches:
        branchDrafts.length > 0
          ? branchDrafts
              .map((draft) => {
                const selectedService = services.find((service) => service.id === draft.serviceId)
                if (!selectedService) {
                  return null
                }

                return {
                  id: crypto.randomUUID(),
                  serviceId: selectedService.id,
                  serviceName: selectedService.name,
                  branchName: draft.branchName.trim(),
                  createdAt: new Date().toISOString(),
                }
              })
              .filter((branch): branch is NonNullable<typeof branch> => branch !== null)
          : undefined,
    }

    onCreateTask(taskToCreate)
    setNewTask(createInitialTask(defaultStatus as Task["status"], defaultPriority))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新建任务
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">任务标题 *</Label>
            <Input
              id="title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="输入任务标题"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">
              任务描述
              <span className="text-xs text-muted-foreground ml-2">
                支持 Markdown 格式
              </span>
            </Label>
            <div className="mt-2">
              <MDEditor
                value={newTask.description}
                onChange={(value) => setNewTask({ ...newTask, description: value || "" })}
                height={250}
                data-color-mode={resolvedTheme === "dark" ? "dark" : "light"}
                visibleDragbar={false}
                preview="edit"
                hideToolbar={false}
                textareaProps={{
                  placeholder: "详细描述任务内容，支持 Markdown 格式...\n\n示例:\n## 功能需求\n- [ ] 任务1\n- [ ] 任务2\n\n### 技术要求\n```javascript\n// 代码示例\n```",
                  style: {
                    fontSize: "13px",
                    lineHeight: "1.5",
                    fontFamily: "inherit",
                  },
                }}
              />
            </div>
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
              <Label htmlFor="assignee">负责人 *</Label>
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
          </div>

          <div>
            <Label htmlFor="jiraUrl" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              JIRA需求链接 (可选)
            </Label>
            <Input
              id="jiraUrl"
              value={newTask.jiraUrl}
              onChange={(e) => setNewTask({ ...newTask, jiraUrl: e.target.value })}
              placeholder="https://jira.company.com/browse/PROJ-123"
              type="url"
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  服务分支
                  <span className="text-xs text-muted-foreground">可选</span>
                </Label>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddBranchDraft}>
                <Plus className="h-4 w-4 mr-1" />
                添加分支
              </Button>
            </div>

            {branchDrafts.length > 0 && (
              <div className="space-y-3">
                {branchDrafts.map((draft, index) => (
                  <div key={draft.id} className="grid grid-cols-1 gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                    <div>
                      <Label htmlFor={`serviceId-${draft.id}`}>所属服务 {index + 1}</Label>
                      <Select
                        value={draft.serviceId}
                        onValueChange={(value) => handleUpdateBranchDraft(draft.id, { serviceId: value })}
                      >
                        <SelectTrigger id={`serviceId-${draft.id}`} disabled={services.length === 0}>
                          <SelectValue placeholder={services.length > 0 ? "请选择服务" : "暂无可选服务"} />
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

                    <div>
                      <Label htmlFor={`branchName-${draft.id}`}>分支名</Label>
                      <Input
                        id={`branchName-${draft.id}`}
                        value={draft.branchName}
                        onChange={(e) =>
                          handleUpdateBranchDraft(draft.id, {
                            branchName: e.target.value,
                            branchNameTouched: true,
                          })
                        }
                        placeholder={buildTaskBranchName(settings.branchPrefix, newTask.title || "task", draft.seed)}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBranchDraft(draft.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">当前还没有服务配置，先创建任务也没关系，后续可以在任务详情里补充服务分支。</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              创建任务
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
