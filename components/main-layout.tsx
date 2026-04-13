"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [taskCount, setTaskCount] = useState(0)

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((tasks: unknown[]) => setTaskCount(Array.isArray(tasks) ? tasks.length : 0))
      .catch(() => {})
  }, [])

  const taskCounts = { "全部任务": taskCount }

  return (
    <>
      <Sidebar taskCounts={taskCounts} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  )
}
