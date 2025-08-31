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
  projectId: string
  serviceId: string
  labels: string[]
}

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [tasks] = useLocalStorage<Task[]>("kanban-tasks", [])
  const [services] = useLocalStorage<any[]>("kanban-services", [])

  const taskCounts = tasks.reduce((counts: Record<string, number>, task) => {
    const service = services.find(s => s.id === task.serviceId)
    const serviceName = service?.name || "未知服务"
    counts[serviceName] = (counts[serviceName] || 0) + 1
    return counts
  }, {})

  return (
    <>
      <Sidebar taskCounts={taskCounts} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  )
}
