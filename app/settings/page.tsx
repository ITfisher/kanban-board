"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Settings, Save, Clock3 } from "lucide-react"
import { DEFAULT_SETTINGS } from "@/lib/default-settings"
import type { SettingsData } from "@/lib/types"

export default function SettingsPage() {
  const { setTheme } = useTheme()
  const persistedDarkModeRef = useRef(DEFAULT_SETTINGS.darkMode)
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const settingsRes = await fetch("/api/settings")
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
        setOriginalSettings(data)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const hasAnyChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(hasAnyChanges)
  }, [settings, originalSettings])

  useEffect(() => {
    persistedDarkModeRef.current = originalSettings.darkMode
  }, [originalSettings.darkMode])

  useEffect(() => {
    setTheme(settings.darkMode ? "dark" : "light")
  }, [settings.darkMode, setTheme])

  useEffect(() => {
    return () => {
      setTheme(persistedDarkModeRef.current ? "dark" : "light")
    }
  }, [setTheme])

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = async () => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })

    if (res.ok) {
      setOriginalSettings(settings)
      toast({ title: "设置已保存", description: "您的设置已成功保存" })
    } else {
      toast({ title: "保存失败", description: "无法保存设置，请重试", variant: "destructive" })
    }
  }

  return (
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
                    <div className="flex items-center gap-2">
                      <Label htmlFor="notifications">桌面通知</Label>
                      <span className="text-xs rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">
                        未来支持
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">暂不支持任务提醒、状态变更提醒等桌面通知</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.notifications}
                    disabled
                    onCheckedChange={(checked) => handleSettingChange("notifications", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="darkMode">深色模式</Label>
                    <p className="text-sm text-muted-foreground">切换浅色 / 深色主题，仅保存在本机</p>
                  </div>
                  <Switch
                    id="darkMode"
                    checked={settings.darkMode}
                    onCheckedChange={(checked) => handleSettingChange("darkMode", checked)}
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
                <div className="space-y-2">
                  <Label htmlFor="branchPrefix">分支前缀</Label>
                  <Input
                    id="branchPrefix"
                    value={settings.branchPrefix}
                    onChange={(e) => handleSettingChange("branchPrefix", e.target.value)}
                    placeholder="可留空，例如 feature/"
                  />
                  <p className="text-sm text-muted-foreground">自动生成分支名时使用的前缀，可不设置；留空时直接使用分支名主体</p>
                </div>
              </CardContent>
            </Card>

            {/* 数据管理 */}
            <Card>
              <CardHeader>
                <CardTitle>数据管理</CardTitle>
                <CardDescription>新版本数据模型调整中，导入导出能力暂未开放</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button disabled variant="outline" className="flex-1 bg-transparent opacity-60">
                    <Clock3 className="h-4 w-4 mr-2" />
                    导出设置
                  </Button>
                  <Button disabled variant="outline" className="flex-1 bg-transparent opacity-60">
                    <Clock3 className="h-4 w-4 mr-2" />
                    导入设置
                  </Button>
                </div>
                <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-4">
                  <div className="text-sm font-medium text-foreground">Coming Soon</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    因为当前版本已切换到新的仓库/需求分支/阶段流水线模型，旧版导入导出逻辑已下线，后续会基于新模型重新设计完整的备份恢复方案。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  )
}
