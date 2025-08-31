"use client"

import { MainLayout } from "@/components/main-layout"
import { GitBranchManager } from "@/components/git-branch-manager"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { GitBranch } from "lucide-react"

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

export default function BranchesPage() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("kanban-tasks", [])

  const handleUpdateTaskGitBranch = (taskId: string, gitBranch: string) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, gitBranch } : task)))
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center gap-4 px-6 py-4">
            <GitBranch className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Git 分支管理</h1>
              <p className="text-sm text-muted-foreground">管理项目的所有Git分支和关联任务</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <GitBranchManager tasks={tasks} onUpdateTask={handleUpdateTaskGitBranch} />
        </div>
      </div>
    </MainLayout>
  )
}
