"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Server, GitBranch, Settings, ChevronLeft, ChevronRight, Kanban, BarChart3 } from "lucide-react"

interface SidebarProps {
  taskCounts?: Record<string, number>
}

const navigation = [
  {
    name: "仪表盘",
    href: "/dashboard",
    icon: BarChart3,
    description: "数据统计与分析",
  },
  {
    name: "服务管理",
    href: "/services",
    icon: Server,
    description: "管理项目服务和配置",
  },
  {
    name: "Git 分支",
    href: "/branches",
    icon: GitBranch,
    description: "管理代码分支",
  },
  {
    name: "任务管理",
    href: "/tasks",
    icon: Kanban,
    description: "管理项目任务和进度",
  },
  {
    name: "设置",
    href: "/settings",
    icon: Settings,
    description: "系统设置和配置",
  },
]

export function Sidebar({ taskCounts = {} }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const totalTasks = Object.values(taskCounts).reduce((sum, count) => sum + count, 0)

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">项目管理</h1>
              <p className="text-xs text-muted-foreground">看板系统</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} className="h-8 w-8 p-0">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.name === "任务管理" && totalTasks > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {totalTasks}
                        </Badge>
                      )}
                    </>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-muted-foreground">{item.description}</div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>总任务数:</span>
              <span className="font-medium">{totalTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>活跃服务:</span>
              <span className="font-medium">{Object.keys(taskCounts).length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
