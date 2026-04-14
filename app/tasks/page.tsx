"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { SearchFilter } from "@/components/search-filter"
import { TaskCard } from "@/components/task-card"
import { toast } from "@/hooks/use-toast"
import { DEFAULT_SETTINGS } from "@/lib/default-settings"
import { isCompletedTaskStatus, TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from "@/lib/task-status"
import type { SettingsData, Task, TaskBranch, TaskStatus } from "@/lib/types"
import { Eye, EyeOff } from "lucide-react"

type CreateTaskInput = Omit<Task, "id" | "taskBranches"> & {
  taskBranches?: Array<
    Pick<TaskBranch, "id" | "repositoryId" | "createdAt"> & {
      name: string
      serviceIds: string[]
    }
  >
}

const COLUMN_VISIBILITY_STORAGE_KEY = "kanban-board:task-column-visibility"

function getDateRangeBoundary(value: string, boundary: "start" | "end") {
  if (!value) return null
  const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999"
  const date = new Date(`${value}${suffix}`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function matchesDateRange(value: string | undefined, start: string, end: string) {
  if (!start && !end) return true
  if (!value) return false

  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return false

  const startBoundary = getDateRangeBoundary(start, "start")
  const endBoundary = getDateRangeBoundary(end, "end")

  if (startBoundary !== null && target < startBoundary) {
    return false
  }

  if (endBoundary !== null && target > endBoundary) {
    return false
  }

  return true
}

function getCompletedAtForStatus(status: TaskStatus, previousCompletedAt?: string) {
  if (isCompletedTaskStatus(status)) {
    return previousCompletedAt ?? new Date().toISOString()
  }
  return undefined
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPriority, setSelectedPriority] = useState("all")
  const [selectedAssignee, setSelectedAssignee] = useState("all")
  const [createdDateStart, setCreatedDateStart] = useState("")
  const [createdDateEnd, setCreatedDateEnd] = useState("")
  const [completedDateStart, setCompletedDateStart] = useState("")
  const [completedDateEnd, setCompletedDateEnd] = useState("")
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<Record<TaskStatus, boolean>>({
    backlog: true,
    todo: true,
    "in-progress": true,
    testing: true,
    done: true,
    closed: true,
  })
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as Partial<Record<TaskStatus, boolean>>
      setColumnVisibility((prev) => ({
        ...prev,
        ...parsed,
      }))
    } catch {
      // Ignore malformed localStorage values.
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks")
      if (!res.ok) throw new Error("Failed to fetch tasks")
      const data = await res.json()
      setTasks(data)
    } catch {
      toast({ title: "加载任务失败", description: "无法从服务器加载任务", variant: "destructive" })
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [tasksRes, settingsRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/settings")])
        if (tasksRes.ok) {
          setTasks(await tasksRes.json())
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json()
          setSettings((prev) => ({ ...prev, ...s }))
        }
      } catch {
        toast({ title: "加载数据失败", description: "无法从服务器加载数据", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const assignees = useMemo(() => {
    return [...new Set(tasks.map((task) => task.assignee?.name).filter(Boolean))] as string[]
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let filtered = tasks

    if (searchTerm) {
      const normalized = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(normalized) ||
          task.description.toLowerCase().includes(normalized),
      )
    }

    if (selectedPriority !== "all") {
      filtered = filtered.filter((task) => task.priority === selectedPriority)
    }

    if (selectedAssignee !== "all") {
      filtered = filtered.filter((task) => task.assignee?.name === selectedAssignee)
    }

    filtered = filtered.filter((task) => matchesDateRange(task.createdAt, createdDateStart, createdDateEnd))
    filtered = filtered.filter((task) => matchesDateRange(task.completedAt, completedDateStart, completedDateEnd))

    return filtered
  }, [
    tasks,
    searchTerm,
    selectedPriority,
    selectedAssignee,
    createdDateStart,
    createdDateEnd,
    completedDateStart,
    completedDateEnd,
  ])

  const visibleColumns = useMemo(
    () => TASK_STATUS_COLUMNS.filter((column) => columnVisibility[column.id]),
    [columnVisibility],
  )

  const getTasksByStatus = useCallback(
    (status: TaskStatus) => filteredTasks.filter((task) => task.status === status),
    [filteredTasks],
  )

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedPriority !== "all" ||
    selectedAssignee !== "all" ||
    createdDateStart !== "" ||
    createdDateEnd !== "" ||
    completedDateStart !== "" ||
    completedDateEnd !== ""

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedPriority("all")
    setSelectedAssignee("all")
    setCreatedDateStart("")
    setCreatedDateEnd("")
    setCompletedDateStart("")
    setCompletedDateEnd("")
  }

  const handleCreateTask = async (newTaskData: CreateTaskInput) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTaskData),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || "创建任务失败")
      }
      const created = await res.json()
      setTasks((prev) => [...prev, created])
      toast({
        title: "任务创建成功",
        description: `任务 "${created.title}" 已创建`,
      })
    } catch (error) {
      toast({
        title: "创建任务失败",
        description: error instanceof Error ? error.message : "无法创建任务，请重试",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      const res = await fetch(`/api/tasks/${updatedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      })
      if (!res.ok) throw new Error("Failed to update task")
      const saved = await res.json()
      setTasks((prev) => prev.map((task) => (task.id === saved.id ? saved : task)))
      toast({
        title: "任务更新成功",
        description: `任务 "${saved.title}" 已更新`,
      })
    } catch {
      toast({ title: "更新任务失败", description: "无法更新任务，请重试", variant: "destructive" })
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverColumn(columnId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("text/plain")

    if (!taskId || taskId !== draggedTaskId) {
      return
    }

    const task = tasks.find((item) => item.id === draggedTaskId)
    if (!task) {
      setDraggedTaskId(null)
      setDragOverColumn(null)
      return
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === draggedTaskId
          ? { ...item, status: newStatus, completedAt: getCompletedAtForStatus(newStatus, item.completedAt) }
          : item,
      ),
    )

    try {
      const res = await fetch(`/api/tasks/${draggedTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")

      toast({
        title: "任务状态更新",
        description: `任务 "${task.title}" 已移动到 "${TASK_STATUS_LABELS[newStatus]}"`,
      })
    } catch {
      await fetchTasks()
      toast({ title: "状态更新失败", description: "无法更新任务状态，请重试", variant: "destructive" })
    }

    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  const toggleColumnVisibility = (status: TaskStatus) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [status]: !prev[status],
    }))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault()
            document.querySelector<HTMLInputElement>('input[placeholder="搜索任务..."]')?.focus()
            break
        }
      }

      if (e.key === "Escape") {
        clearFilters()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filteredTasks])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex-shrink-0 border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">任务管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <CreateTaskDialog onCreateTask={handleCreateTask} defaultPriority={settings.defaultPriority} />
          </div>
        </div>

        <div className="space-y-4 px-6 pb-4">
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            selectedAssignee={selectedAssignee}
            onAssigneeChange={setSelectedAssignee}
            assignees={assignees}
            createdDateStart={createdDateStart}
            createdDateEnd={createdDateEnd}
            completedDateStart={completedDateStart}
            completedDateEnd={completedDateEnd}
            onCreatedDateStartChange={setCreatedDateStart}
            onCreatedDateEndChange={setCreatedDateEnd}
            onCompletedDateStartChange={setCompletedDateStart}
            onCompletedDateEndChange={setCompletedDateEnd}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">栏目显示:</span>
            {TASK_STATUS_COLUMNS.map((column) => {
              const visible = columnVisibility[column.id]
              return (
                <Button
                  key={column.id}
                  variant={visible ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => toggleColumnVisibility(column.id)}
                  className="h-8"
                >
                  {visible ? <Eye className="mr-2 h-3.5 w-3.5" /> : <EyeOff className="mr-2 h-3.5 w-3.5" />}
                  {column.title}
                </Button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <svg className="h-8 w-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">加载任务中...</span>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="max-w-md">
              <div className="mb-4">
                <svg className="mx-auto h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-medium text-foreground">暂无任务</h3>
              <p className="mb-6 text-muted-foreground">开始创建您的第一个任务来管理项目。您可以创建任务、设置优先级、分配负责人等。</p>
              <CreateTaskDialog onCreateTask={handleCreateTask} defaultPriority={settings.defaultPriority} />
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="max-w-md">
              <h3 className="mb-2 text-lg font-medium text-foreground">没有符合条件的任务</h3>
              <p className="mb-6 text-muted-foreground">当前筛选条件下没有匹配结果，可以尝试放宽时间、负责人或优先级条件。</p>
              <Button variant="outline" onClick={clearFilters}>
                清除筛选
              </Button>
            </div>
          </div>
        ) : visibleColumns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="max-w-md">
              <h3 className="mb-2 text-lg font-medium text-foreground">当前没有显示中的栏目</h3>
              <p className="text-muted-foreground">请在上方“栏目显示”里打开至少一个状态栏目。</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-x-auto pb-4">
            <div className="flex h-full min-w-max gap-6">
              {visibleColumns.map((column) => (
                <div key={column.id} className="flex h-full w-[320px] shrink-0 flex-col">
                  <div className={`${column.color} mb-4 rounded-lg p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold text-sm text-foreground">{column.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {getTasksByStatus(column.id).length}
                      </Badge>
                    </div>
                  </div>

                  <div
                    className={`hide-scrollbar min-h-0 flex-1 overflow-y-auto space-y-3 rounded-lg p-2 transition-all duration-200 ${
                      dragOverColumn === column.id
                        ? "border-2 border-dashed border-primary bg-primary/10"
                        : "border-2 border-transparent"
                    }`}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    {getTasksByStatus(column.id).map((task) => (
                      <div
                        key={task.id}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <TaskCard
                          task={task}
                          onUpdate={handleUpdateTask}
                          isDragging={draggedTaskId === task.id}
                          compactView={settings.compactView}
                          showAssigneeAvatars={settings.showAssigneeAvatars}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 rounded-lg border bg-card p-2 text-xs text-muted-foreground shadow-sm">
          <div className="space-y-1">
            <div>Ctrl+K: 搜索</div>
            <div>Esc: 清除筛选</div>
          </div>
        </div>
      </div>
    </div>
  )
}
