"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { getActiveServiceNames } from "@/lib/task-utils"
import type { Task } from "@/lib/types"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: unknown[]) => setTasks(Array.isArray(data) ? (data as Task[]) : []))
      .catch(() => {})
  }, [])

  const taskCount = tasks.length
  const activeServices = getActiveServiceNames(tasks)

  return (
    <>
      <Sidebar taskCount={taskCount} activeServiceCount={activeServices.length} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  )
}
