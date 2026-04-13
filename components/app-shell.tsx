"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { getActiveServiceNames } from "@/lib/task-utils"
import type { Task } from "@/lib/types"

interface ShellStats {
  taskCount: number
  activeServiceCount: number
}

interface AppShellProps {
  children: React.ReactNode
}

const shellRouteMatchers = [/^\/dashboard$/, /^\/services(?:\/|$)/, /^\/branches(?:\/|$)/, /^\/tasks(?:\/|$)/, /^\/settings(?:\/|$)/]

const emptyStats: ShellStats = {
  taskCount: 0,
  activeServiceCount: 0,
}

function shouldRenderShell(pathname: string) {
  return shellRouteMatchers.some((matcher) => matcher.test(pathname))
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [stats, setStats] = useState<ShellStats>(emptyStats)
  const [hasLoadedStats, setHasLoadedStats] = useState(false)

  const shellEnabled = useMemo(() => shouldRenderShell(pathname), [pathname])

  useEffect(() => {
    if (!shellEnabled) {
      return
    }

    let cancelled = false

    const loadShellStats = async () => {
      try {
        const response = await fetch("/api/tasks", { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to load shell stats")
        }

        const data: Task[] = await response.json()
        if (cancelled) {
          return
        }

        setStats({
          taskCount: data.length,
          activeServiceCount: getActiveServiceNames(data).length,
        })
      } catch {
        if (!cancelled) {
          setStats(emptyStats)
        }
      } finally {
        if (!cancelled) {
          setHasLoadedStats(true)
        }
      }
    }

    const handleWindowFocus = () => {
      void loadShellStats()
    }

    void loadShellStats()
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      cancelled = true
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [shellEnabled, pathname])

  if (!shellEnabled) {
    return children
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        taskCount={hasLoadedStats ? stats.taskCount : 0}
        activeServiceCount={hasLoadedStats ? stats.activeServiceCount : 0}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
