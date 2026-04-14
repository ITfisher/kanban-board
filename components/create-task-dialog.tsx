"use client"

import type React from "react"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { Service, Task, TaskBranch, User } from "@/lib/types"

type CreateTaskInput = Omit<Task, "id" | "taskBranches"> & {
  taskBranches?: Array<
    Pick<TaskBranch, "id" | "repositoryId" | "createdAt"> & {
      name: string
      serviceIds: string[]
    }
  >
}

interface CreateTaskDialogProps {
  onCreateTask: (task: CreateTaskInput) => Promise<void>
  defaultStatus?: string
  defaultPriority?: Task["priority"]
}

interface ServicePayload extends Service {
  repositoryEntity?: {
    id: string
    fullName: string
  }
}

interface TaskBranchDraft {
  id: string
  repositoryId: string
  serviceIds: string[]
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
    ownerUserId: undefined as string | undefined,
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
  const [services, setServices] = useState<ServicePayload[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [dialogDataError, setDialogDataError] = useState<string | null>(null)
  const [branchDrafts, setBranchDrafts] = useState<TaskBranchDraft[]>([])
  const [submitting, setSubmitting] = useState(false)

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

    const loadDialogData = async () => {
      try {
        setDialogDataError(null)
        const [servicesResponse, usersResponse] = await Promise.all([fetch("/api/services"), fetch("/api/users")])
        if (!servicesResponse.ok) {
          throw new Error("加载服务列表失败")
        }
        if (!usersResponse.ok) {
          throw new Error("加载用户列表失败")
        }

        const [servicesData, usersData] = await Promise.all([servicesResponse.json(), usersResponse.json()])
        if (!cancelled) {
          setServices(Array.isArray(servicesData) ? servicesData : [])
          setUsers(Array.isArray(usersData) ? usersData : [])
        }
      } catch (error) {
        if (!cancelled) {
          setServices([])
          setUsers([])
          setDialogDataError(error instanceof Error ? error.message : "加载创建任务所需数据失败")
          toast({
            title: "加载失败",
            description: error instanceof Error ? error.message : "加载创建任务所需数据失败",
            variant: "destructive",
          })
        }
      }
    }

    void loadDialogData()

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
        repositoryId: "",
        serviceIds: [],
        branchName: buildTaskBranchName(settings.branchPrefix, newTask.title || "task", seed),
        branchNameTouched: false,
        seed,
      },
    ])
  }

  const handleUpdateBranchDraft = (draftId: string, updates: Partial<TaskBranchDraft>) => {
    setBranchDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== draftId) {
          return draft
        }
        return { ...draft, ...updates }
      })
    )
  }

  const handleDeleteBranchDraft = (draftId: string) => {
    setBranchDrafts((prev) => prev.filter((draft) => draft.id !== draftId))
  }

  const toggleDraftService = (draftId: string, serviceId: string, checked: boolean) => {
    setBranchDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== draftId) {
          return draft
        }

        if (checked) {
          // Lock to this service's repository when the first service is selected
          const service = services.find((s) => s.id === serviceId)
          const repositoryId = draft.serviceIds.length === 0
            ? (service?.repositoryId ?? "")
            : draft.repositoryId
          return {
            ...draft,
            repositoryId,
            serviceIds: [...new Set([...draft.serviceIds, serviceId])],
          }
        } else {
          const newServiceIds = draft.serviceIds.filter((current) => current !== serviceId)
          // Release repo lock when all services are deselected
          return {
            ...draft,
            repositoryId: newServiceIds.length === 0 ? "" : draft.repositoryId,
            serviceIds: newServiceIds,
          }
        }
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.title.trim() || submitting) return

    for (const draft of branchDrafts) {
      if (draft.serviceIds.length === 0) {
        toast({
          title: "请选择服务",
          description: "每条需求分支至少需要关联一个服务",
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
      ownerUserId: newTask.ownerUserId || undefined,
      assignee: newTask.assignee?.name ? newTask.assignee : undefined,
      jiraUrl: newTask.jiraUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
      taskBranches:
        branchDrafts.length > 0
          ? branchDrafts
              .map((draft) => {
                const selectedServices = services.filter(
                  (service) => service.repositoryId === draft.repositoryId && draft.serviceIds.includes(service.id)
                )

                if (selectedServices.length === 0) {
                  return null
                }

                return {
                  id: crypto.randomUUID(),
                  repositoryId: draft.repositoryId,
                  name: draft.branchName.trim(),
                  serviceIds: selectedServices.map((service) => service.id),
                  createdAt: new Date().toISOString(),
                }
              })
              .filter((branch): branch is NonNullable<typeof branch> => branch !== null)
          : undefined,
    }

    try {
      setSubmitting(true)
      await onCreateTask(taskToCreate)
      setNewTask(createInitialTask(defaultStatus as Task["status"], defaultPriority))
      setBranchDrafts([])
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
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
              <Label htmlFor="assignee">负责人</Label>
              <Select
                value={newTask.ownerUserId || "unassigned"}
                onValueChange={(value) => {
                  const ownerUserId = value === "unassigned" ? undefined : value
                  const selectedUser = users.find((user) => user.id === ownerUserId)
                  setNewTask({
                    ...newTask,
                    ownerUserId,
                    assignee: selectedUser
                      ? { name: selectedUser.name, avatar: selectedUser.avatarUrl }
                      : undefined,
                  })
                }}
              >
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="未分配" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">未分配</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                      {user.email ? ` (${user.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {users.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  当前还没有用户，可先在
                  {" "}
                  <Link href="/users" className="text-primary underline underline-offset-4">
                    用户管理
                  </Link>
                  {" "}
                  中创建；也可以先保持未分配。
                </p>
              )}
              {dialogDataError && <p className="mt-2 text-xs text-destructive">{dialogDataError}</p>}
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
                  需求分支
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
                {branchDrafts.map((draft, index) => {
                  // Services visible for this draft: all (with repo) if none selected yet,
                  // or only same-repo services once the first service is picked.
                  const visibleServices = draft.repositoryId
                    ? services.filter((s) => s.repositoryId === draft.repositoryId)
                    : services.filter((s) => s.repositoryId)

                  return (
                    <div
                      key={draft.id}
                      className="grid grid-cols-1 gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_auto]"
                    >
                      <div className="space-y-2">
                        <Label>
                          关联服务 {index + 1}
                          {draft.repositoryId && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              （已锁定同仓库）
                            </span>
                          )}
                        </Label>
                        {visibleServices.length === 0 ? (
                          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            暂无可用服务，请先在服务管理页配置。
                          </p>
                        ) : (
                          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                            {visibleServices.map((service) => (
                              <label key={service.id} className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                  checked={draft.serviceIds.includes(service.id)}
                                  onCheckedChange={(checked) =>
                                    toggleDraftService(draft.id, service.id, checked === true)
                                  }
                                />
                                <span>{service.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
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

                        <p className="text-xs text-muted-foreground">
                          {draft.serviceIds.length > 0
                            ? `当前需求分支将挂靠 ${draft.serviceIds.length} 个服务`
                            : "请至少选择一个服务"}
                        </p>
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
                  )
                })}
              </div>
            )}

            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">当前还没有服务配置，先创建任务也没关系，后续可以在任务详情里补充服务分支。</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "创建中..." : "创建任务"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" disabled={submitting}>
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
