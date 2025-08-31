"use client"

import type React from "react"
import { Sidebar } from "@/components/sidebar"
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
  gitBranch?: string
  labels: string[]
}

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])

  const taskCounts = { "全部任务": tasks.length }

  return (
    <>
      <Sidebar taskCounts={taskCounts} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  )
}
