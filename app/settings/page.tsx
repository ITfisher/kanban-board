"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Settings, Save, Download, Upload, Trash2 } from "lucide-react"

export default function SettingsPage() {
  const defaultSettings = {
    notifications: true,
    autoSave: true,
    darkMode: false,
    compactView: false,
    showAssigneeAvatars: true,
    defaultPriority: "medium",
    autoCreateBranch: true,
    branchPrefix: "feature/",
  }

  const [settings, setSettings] = useState(defaultSettings)
  const [originalSettings, setOriginalSettings] = useState(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const savedSettings = localStorage.getItem("kanban-settings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(parsed)
        setOriginalSettings(parsed)
      } catch (error) {
        console.error("Failed to parse saved settings:", error)
      }
    } else {
      setOriginalSettings(defaultSettings)
    }
  }, [])

  useEffect(() => {
    const hasAnyChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(hasAnyChanges)
  }, [settings, originalSettings])

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    localStorage.setItem("kanban-settings", JSON.stringify(settings))
    setOriginalSettings(settings)
    toast({
      title: "设置已保存",
      description: "您的设置已成功保存",
    })
  }

  const handleExportData = () => {
    const tasks = localStorage.getItem("kanban-tasks")
    const services = localStorage.getItem("kanban-services")
    const exportData = {
      tasks: tasks ? JSON.parse(tasks) : [],
      services: services ? JSON.parse(services) : [],
      settings,
      exportDate: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `kanban-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "数据导出成功",
      description: "备份文件已下载到您的设备",
    })
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string)
        if (importData.tasks) localStorage.setItem("kanban-tasks", JSON.stringify(importData.tasks))
        if (importData.services) localStorage.setItem("kanban-services", JSON.stringify(importData.services))
        if (importData.settings) setSettings(importData.settings)

        toast({
          title: "数据导入成功",
          description: "数据已成功导入，请刷新页面查看",
        })
      } catch (error) {
        toast({
          title: "导入失败",
          description: "文件格式不正确，请检查后重试",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
  }

  const handleClearData = () => {
    if (confirm("确定要清除所有数据吗？此操作无法撤销。")) {
      localStorage.removeItem("kanban-tasks")
      localStorage.removeItem("kanban-services")
      localStorage.removeItem("kanban-selected-service")
      toast({
        title: "数据已清除",
        description: "所有数据已被清除，请刷新页面",
      })
    }
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="border-b bg-card flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Settings className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">系统设置</h1>
                <p className="text-sm text-muted-foreground">配置看板系统的各项设置</p>
              </div>
            </div>
            <Button onClick={handleSaveSettings} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              保存设置
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 界面设置 */}
            <Card>
              <CardHeader>
                <CardTitle>界面设置</CardTitle>
                <CardDescription>自定义看板的显示和交互方式</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications">桌面通知</Label>
                    <p className="text-sm text-muted-foreground">接收任务更新和提醒通知</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.notifications}
                    onCheckedChange={(checked) => handleSettingChange("notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoSave">自动保存</Label>
                    <p className="text-sm text-muted-foreground">自动保存更改到本地存储</p>
                  </div>
                  <Switch
                    id="autoSave"
                    checked={settings.autoSave}
                    onCheckedChange={(checked) => handleSettingChange("autoSave", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="compactView">紧凑视图</Label>
                    <p className="text-sm text-muted-foreground">使用更紧凑的卡片布局</p>
                  </div>
                  <Switch
                    id="compactView"
                    checked={settings.compactView}
                    onCheckedChange={(checked) => handleSettingChange("compactView", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showAssigneeAvatars">显示头像</Label>
                    <p className="text-sm text-muted-foreground">在任务卡片中显示负责人头像</p>
                  </div>
                  <Switch
                    id="showAssigneeAvatars"
                    checked={settings.showAssigneeAvatars}
                    onCheckedChange={(checked) => handleSettingChange("showAssigneeAvatars", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 任务设置 */}
            <Card>
              <CardHeader>
                <CardTitle>任务设置</CardTitle>
                <CardDescription>配置任务创建和管理的默认行为</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultPriority">默认优先级</Label>
                  <select
                    id="defaultPriority"
                    value={settings.defaultPriority}
                    onChange={(e) => handleSettingChange("defaultPriority", e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="low">低优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="high">高优先级</option>
                  </select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoCreateBranch">自动创建分支</Label>
                    <p className="text-sm text-muted-foreground">创建任务时自动生成Git分支名</p>
                  </div>
                  <Switch
                    id="autoCreateBranch"
                    checked={settings.autoCreateBranch}
                    onCheckedChange={(checked) => handleSettingChange("autoCreateBranch", checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchPrefix">分支前缀</Label>
                  <Input
                    id="branchPrefix"
                    value={settings.branchPrefix}
                    onChange={(e) => handleSettingChange("branchPrefix", e.target.value)}
                    placeholder="feature/"
                  />
                  <p className="text-sm text-muted-foreground">自动生成分支名时使用的前缀</p>
                </div>
              </CardContent>
            </Card>

            {/* 数据管理 */}
            <Card>
              <CardHeader>
                <CardTitle>数据管理</CardTitle>
                <CardDescription>备份、导入和清除数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={handleExportData} variant="outline" className="flex-1 bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    导出数据
                  </Button>
                  <div className="flex-1">
                    <input type="file" accept=".json" onChange={handleImportData} className="hidden" id="import-file" />
                    <Button asChild variant="outline" className="w-full bg-transparent">
                      <label htmlFor="import-file" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        导入数据
                      </label>
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>清除所有数据</Label>
                    <p className="text-sm text-muted-foreground">删除所有任务、服务和设置数据</p>
                  </div>
                  <Button onClick={handleClearData} variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    清除数据
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
