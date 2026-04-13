"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { validateBackupData } from "@/lib/import-export"
import { Settings, Save, Download, Upload, Trash2, Key, Plus, Edit2, Check, X } from "lucide-react"
import type { GitHubConfigMeta, SettingsData } from "@/lib/types"

interface EditingConfig {
  name: string
  domain: string
  owner: string
  token: string
  isDefault?: boolean
}

const DEFAULT_SETTINGS: SettingsData = {
  notifications: true,
  autoSave: true,
  darkMode: false,
  compactView: false,
  showAssigneeAvatars: true,
  defaultPriority: "medium",
  autoCreateBranch: true,
  branchPrefix: "feature/",
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)
  const [githubConfigs, setGithubConfigs] = useState<GitHubConfigMeta[]>([])
  const [editingGithub, setEditingGithub] = useState<string | null>(null)
  const [editingConfigForm, setEditingConfigForm] = useState<EditingConfig>({ name: "", domain: "", owner: "", token: "" })
  const [newGithubConfig, setNewGithubConfig] = useState<EditingConfig>({
    name: "",
    domain: "github.com",
    owner: "",
    token: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, configsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/github/configs"),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        // Extract only non-github fields for settings state
        const { githubConfigs: _ignored, ...rest } = data
        void _ignored
        setSettings(rest)
        setOriginalSettings(rest)
      }
      if (configsRes.ok) {
        setGithubConfigs(await configsRes.json())
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const hasAnyChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(hasAnyChanges)
  }, [settings, originalSettings])

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleAddGithubConfig = async () => {
    if (!newGithubConfig.name || !newGithubConfig.domain || !newGithubConfig.owner || !newGithubConfig.token) {
      toast({
        title: "配置不完整",
        description: "请填写所有必填字段",
        variant: "destructive",
      })
      return
    }

    const res = await fetch("/api/github/configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGithubConfig.name,
        domain: newGithubConfig.domain,
        owner: newGithubConfig.owner,
        token: newGithubConfig.token,
        isDefault: githubConfigs.length === 0,
      }),
    })

    if (res.ok) {
      const created = await res.json()
      setGithubConfigs(prev => [...prev, created])
      setNewGithubConfig({ name: "", domain: "github.com", owner: "", token: "" })
      setEditingGithub(null)
      toast({ title: "GitHub配置已添加", description: `配置"${created.name}"已成功添加` })
    } else {
      toast({ title: "添加失败", description: "无法添加配置，请重试", variant: "destructive" })
    }
  }

  const handleEditGithubStart = (config: GitHubConfigMeta) => {
    setEditingGithub(config.id)
    setEditingConfigForm({ name: config.name, domain: config.domain, owner: config.owner, token: "" })
  }

  const handleUpdateGithubConfig = async (id: string) => {
    const updates: Partial<EditingConfig> = {
      name: editingConfigForm.name,
      domain: editingConfigForm.domain,
      owner: editingConfigForm.owner,
    }
    if (editingConfigForm.token) {
      updates.token = editingConfigForm.token
    }

    const res = await fetch(`/api/github/configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    if (res.ok) {
      const updated = await res.json()
      setGithubConfigs(prev => prev.map(c => c.id === id ? updated : c))
      setEditingGithub(null)
      setEditingConfigForm({ name: "", domain: "", owner: "", token: "" })
      toast({ title: "配置已更新", description: `GitHub配置"${updated.name}"已更新` })
    } else {
      toast({ title: "更新失败", description: "无法更新配置，请重试", variant: "destructive" })
    }
  }

  const handleDeleteGithubConfig = async (id: string) => {
    const config = githubConfigs.find((c) => c.id === id)
    if (!config) return

    if (confirm(`确定要删除GitHub配置"${config.name}"吗？`)) {
      const res = await fetch(`/api/github/configs/${id}`, { method: "DELETE" })
      if (res.ok) {
        setGithubConfigs(prev => prev.filter(c => c.id !== id))
        toast({ title: "配置已删除", description: `GitHub配置"${config.name}"已被删除` })
      } else {
        toast({ title: "删除失败", description: "无法删除配置，请重试", variant: "destructive" })
      }
    }
  }

  const handleSetDefaultGithubConfig = async (id: string) => {
    const res = await fetch(`/api/github/configs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })

    if (res.ok) {
      // Refresh configs list since multiple configs get updated (isDefault toggled)
      const configsRes = await fetch("/api/github/configs")
      if (configsRes.ok) setGithubConfigs(await configsRes.json())
      toast({ title: "默认配置已更新", description: "默认GitHub配置已设置" })
    } else {
      toast({ title: "更新失败", description: "无法设置默认配置", variant: "destructive" })
    }
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

  const handleExportData = async () => {
    const [tasksRes, servicesRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/services"),
    ])

    if (!tasksRes.ok || !servicesRes.ok) {
      toast({
        title: "导出失败",
        description: "无法读取任务或服务数据，请稍后重试",
        variant: "destructive",
      })
      return
    }

    const exportData = {
      tasks: await tasksRes.json(),
      services: await servicesRes.json(),
      settings,
      exportDate: new Date().toISOString(),
      version: "1.0.0",
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
      description: "备份文件已下载（GitHub Token未导出，请手动配置）",
    })
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const importData = validateBackupData(parsed)
        const importResponse = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(importData),
        })

        if (!importResponse.ok) {
          const error = await importResponse.json().catch(() => null)
          throw new Error(error?.error || "导入失败")
        }

        const settingsResponse = await fetch("/api/settings")
        if (settingsResponse.ok) {
          const importedSettings = await settingsResponse.json()
          setSettings(importedSettings)
          setOriginalSettings(importedSettings)
        }

        toast({
          title: "数据导入成功",
          description: "数据已成功导入，GitHub配置需要手动重新设置",
        })
      } catch (error) {
        toast({
          title: "导入失败",
          description: error instanceof Error ? error.message : "文件格式不正确，请检查后重试",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)

    // 清空文件输入
    event.target.value = ""
  }

  const handleClearData = () => {
    if (confirm("确定要清除所有数据吗？此操作无法撤销。")) {
      toast({
        title: "数据已清除",
        description: "请通过API重新初始化数据，或刷新页面",
      })
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

            {/* GitHub配置 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      GitHub配置
                    </CardTitle>
                    <CardDescription>配置多个GitHub域名和访问令牌</CardDescription>
                  </div>
                  <Button
                    onClick={() => setEditingGithub("new")}
                    size="sm"
                    disabled={editingGithub !== null}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加配置
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 新增配置表单 */}
                {editingGithub === "new" && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="new-config-name">配置名称 *</Label>
                          <Input
                            id="new-config-name"
                            value={newGithubConfig.name}
                            onChange={(e) =>
                              setNewGithubConfig((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="公司GitHub / 个人GitHub"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-config-domain">GitHub域名 *</Label>
                          <Input
                            id="new-config-domain"
                            value={newGithubConfig.domain}
                            onChange={(e) =>
                              setNewGithubConfig((prev) => ({ ...prev, domain: e.target.value }))
                            }
                            placeholder="github.com 或企业版域名"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-config-owner">组织/用户名 *</Label>
                          <Input
                            id="new-config-owner"
                            value={newGithubConfig.owner}
                            onChange={(e) =>
                              setNewGithubConfig((prev) => ({ ...prev, owner: e.target.value }))
                            }
                            placeholder="your-org 或 username"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-config-token">访问令牌 *</Label>
                          <Input
                            id="new-config-token"
                            type="password"
                            value={newGithubConfig.token}
                            onChange={(e) =>
                              setNewGithubConfig((prev) => ({ ...prev, token: e.target.value }))
                            }
                            placeholder="ghp_xxxxxxxxxxxx"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingGithub(null)
                            setNewGithubConfig({ name: "", domain: "github.com", owner: "", token: "" })
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          取消
                        </Button>
                        <Button size="sm" onClick={handleAddGithubConfig}>
                          <Check className="h-4 w-4 mr-1" />
                          保存配置
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 现有配置列表 */}
                {githubConfigs.length === 0 && editingGithub !== "new" ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>暂未配置GitHub访问令牌</p>
                    <p className="text-xs">需要配置后才能使用Pull Request功能</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {githubConfigs.map((config) => (
                      <div
                        key={config.id}
                        className={`border rounded-lg p-4 ${
                          config.isDefault ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        {editingGithub === config.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>配置名称 *</Label>
                                <Input
                                  value={editingConfigForm.name}
                                  onChange={(e) =>
                                    setEditingConfigForm(prev => ({ ...prev, name: e.target.value }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>GitHub域名 *</Label>
                                <Input
                                  value={editingConfigForm.domain}
                                  onChange={(e) =>
                                    setEditingConfigForm(prev => ({ ...prev, domain: e.target.value }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>组织/用户名 *</Label>
                                <Input
                                  value={editingConfigForm.owner}
                                  onChange={(e) =>
                                    setEditingConfigForm(prev => ({ ...prev, owner: e.target.value }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>访问令牌（留空则不更改）</Label>
                                <Input
                                  type="password"
                                  value={editingConfigForm.token}
                                  onChange={(e) =>
                                    setEditingConfigForm(prev => ({ ...prev, token: e.target.value }))
                                  }
                                  placeholder="留空则不更改令牌"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingGithub(null)
                                  setEditingConfigForm({ name: "", domain: "", owner: "", token: "" })
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                取消
                              </Button>
                              <Button size="sm" onClick={() => handleUpdateGithubConfig(config.id)}>
                                <Check className="h-4 w-4 mr-1" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{config.name}</h4>
                                {config.isDefault && (
                                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                    默认
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>域名: {config.domain}</div>
                                <div>组织: {config.owner}</div>
                                <div>令牌: ••••••••</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!config.isDefault && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetDefaultGithubConfig(config.id)}
                                >
                                  设为默认
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditGithubStart(config)}
                                disabled={editingGithub !== null}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteGithubConfig(config.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>使用说明：</strong>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• 访问令牌需要 <code className="bg-blue-100 px-1 rounded">repo</code> 权限才能创建Pull Request</li>
                      <li>• 支持GitHub.com和GitHub Enterprise Server</li>
                      <li>• 多个配置可以管理不同组织的仓库</li>
                      <li>• 默认配置会用于新创建的服务分支</li>
                    </ul>
                  </div>
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
  )
}
