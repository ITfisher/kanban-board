"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Trash2, CheckSquare } from "lucide-react"
import { TaskCard } from "@/components/task-card"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { SearchFilter } from "@/components/search-filter"
import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { MainLayout } from "@/components/main-layout"
import { useLocalStorage } from "@/hooks/use-local-storage"

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
  jiraUrl?: string
}


const statusColumns = [
  { id: "backlog", title: "待规划", color: "bg-gray-100" },
  { id: "todo", title: "待开发", color: "bg-blue-50" },
  { id: "in-progress", title: "开发中", color: "bg-yellow-50" },
  { id: "review", title: "待审核", color: "bg-purple-50" },
  { id: "done", title: "已完成", color: "bg-green-50" },
]

export default function KanbanBoard() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [settings] = useLocalStorage<{
    notifications: boolean
    autoSave: boolean
    darkMode: boolean
    compactView: boolean
    showAssigneeAvatars: boolean
    defaultPriority: string
    autoCreateBranch: boolean
    branchPrefix: string
  }>("kanban-settings", {
    notifications: true,
    autoSave: true,
    darkMode: false,
    compactView: false,
    showAssigneeAvatars: true,
    defaultPriority: "medium",
    autoCreateBranch: true,
    branchPrefix: "feature/",
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPriority, setSelectedPriority] = useState("all")
  const [selectedAssignee, setSelectedAssignee] = useState("all")
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
    variant?: "default" | "destructive"
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  })

  const assignees = useMemo(() => {
    if (!tasks) return []
    return [...new Set(tasks.map((task) => task.assignee?.name).filter(Boolean))] as string[]
  }, [tasks])

  const filteredTasks = useMemo(() => {
    if (!tasks) return []
    
    let filtered = tasks

    if (searchTerm) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedPriority !== "all") {
      filtered = filtered.filter((task) => task.priority === selectedPriority)
    }

    if (selectedAssignee !== "all") {
      filtered = filtered.filter((task) => task.assignee?.name === selectedAssignee)
    }

    return filtered
  }, [tasks, searchTerm, selectedPriority, selectedAssignee])

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter((task) => task.status === status)
  }

  const hasActiveFilters = searchTerm !== "" || selectedPriority !== "all" || selectedAssignee !== "all"

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedPriority("all")
    setSelectedAssignee("all")
  }

  const handleCreateTask = (newTaskData: Omit<Task, "id">) => {
    const newTask: Task = {
      ...newTaskData,
      id: Date.now().toString(),
    }
    setTasks([...tasks, newTask])
    toast({
      title: "任务创建成功",
      description: `任务 "${newTask.title}" 已创建`,
    })
  }

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
    toast({
      title: "任务更新成功",
      description: `任务 "${updatedTask.title}" 已更新`,
    })
  }

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    setConfirmDialog({
      open: true,
      title: "删除任务",
      description: `确定要删除任务 "${task.title}" 吗？此操作无法撤销。`,
      variant: "destructive",
      onConfirm: () => {
        setTasks(tasks.filter((t) => t.id !== taskId))
        setSelectedTasks(selectedTasks.filter((id) => id !== taskId))
        toast({
          title: "任务删除成功",
          description: `任务 "${task.title}" 已删除`,
        })
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleBatchDelete = () => {
    if (selectedTasks.length === 0) return

    setConfirmDialog({
      open: true,
      title: "批量删除任务",
      description: `确定要删除选中的 ${selectedTasks.length} 个任务吗？此操作无法撤销。`,
      variant: "destructive",
      onConfirm: () => {
        setTasks(tasks.filter((task) => !selectedTasks.includes(task.id)))
        setSelectedTasks([])
        toast({
          title: "批量删除成功",
          description: `已删除 ${selectedTasks.length} 个任务`,
        })
        setConfirmDialog({ ...confirmDialog, open: false })
      },
    })
  }

  const handleUpdateTaskGitBranch = (taskId: string, gitBranch: string) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, gitBranch } : task)))
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

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("text/plain")

    if (taskId && taskId !== draggedTaskId) {
      return
    }

    if (draggedTaskId) {
      const task = tasks.find((t) => t.id === draggedTaskId)
      const updatedTasks = tasks.map((task) =>
        task.id === draggedTaskId ? { ...task, status: newStatus as Task["status"] } : task,
      )
      setTasks(updatedTasks)

      if (task) {
        toast({
          title: "任务状态更新",
          description: `任务 "${task.title}" 已移动到 "${statusColumns.find((col) => col.id === newStatus)?.title}"`,
        })
      }
    }

    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverColumn(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault()
            document.querySelector<HTMLInputElement>('input[placeholder="搜索任务..."]')?.focus()
            break
          case "a":
            if (e.shiftKey) {
              e.preventDefault()
              setSelectedTasks(filteredTasks.map((task) => task.id))
            }
            break
          case "d":
            if (e.shiftKey && selectedTasks.length > 0) {
              e.preventDefault()
              handleBatchDelete()
            }
            break
        }
      }
      if (e.key === "Escape") {
        setSelectedTasks([])
        clearFilters()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filteredTasks, selectedTasks])

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]))
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">任务管理</h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedTasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedTasks.length} 已选择</Badge>
                  <Button variant="outline" size="sm" onClick={handleBatchDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    批量删除
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTasks([])}>
                    取消选择
                  </Button>
                </div>
              )}
              <CreateTaskDialog
                onCreateTask={handleCreateTask}
              />
            </div>
          </div>

          <div className="px-6 pb-4">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedPriority={selectedPriority}
              onPriorityChange={setSelectedPriority}
              selectedAssignee={selectedAssignee}
              onAssigneeChange={setSelectedAssignee}
              assignees={assignees}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 p-6 overflow-auto">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="max-w-md">
                <div className="mb-4">
                  <svg className="mx-auto h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">暂无任务</h3>
                <p className="text-muted-foreground mb-6">
                  开始创建您的第一个任务来管理项目。您可以创建任务、设置优先级、分配负责人等。
                </p>
                <CreateTaskDialog
                  onCreateTask={handleCreateTask}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-6 min-h-full">
            {statusColumns.map((column) => (
              <div key={column.id} className="flex flex-col">
                <div className={`${column.color} rounded-lg p-3 mb-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {getTasksByStatus(column.id).length}
                    </Badge>
                  </div>
                </div>

                <div
                  className={`flex-1 space-y-3 min-h-[200px] rounded-lg p-2 transition-all duration-200 ${
                    dragOverColumn === column.id
                      ? "bg-primary/10 border-2 border-dashed border-primary"
                      : "border-2 border-transparent"
                  }`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {getTasksByStatus(column.id).map((task) => (
                    <div key={task.id} className="relative group">
                      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleTaskSelection(task.id)}
                          className={`h-6 w-6 p-0 ${
                            selectedTasks.includes(task.id) ? "bg-primary text-primary-foreground" : ""
                          }`}
                        >
                          <CheckSquare className="h-3 w-3" />
                        </Button>
                      </div>
                      <div
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={selectedTasks.includes(task.id) ? "ring-2 ring-primary" : ""}
                      >
                        <TaskCard
                          task={task}
                          onUpdate={handleUpdateTask}
                          onDelete={handleDeleteTask}
                          isDragging={draggedTaskId === task.id}
                          compactView={settings.compactView}
                          showAssigneeAvatars={settings.showAssigneeAvatars}
                        />
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            ))}
            </div>
          )}

          <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-card border rounded-lg p-2 shadow-sm">
            <div className="space-y-1">
              <div>Ctrl+K: 搜索</div>
              <div>Ctrl+Shift+A: 全选</div>
              <div>Ctrl+Shift+D: 批量删除</div>
              <div>Esc: 清除选择/筛选</div>
            </div>
          </div>
        </div>

        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          variant={confirmDialog.variant}
        />
      </div>
    </MainLayout>
  )
}
