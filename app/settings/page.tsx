"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Check, Clock3, Edit2, Key, Loader2, Plus, Save, Settings, Trash2, X } from "lucide-react"
import { DEFAULT_SETTINGS } from "@/lib/default-settings"
import type { SettingsData } from "@/lib/types"

type ScmConnection = {
  id: string
  name: string
  provider: string
  domain: string
  owner: string
  isDefault: boolean
}

type ScmConnectionForm = {
  name: string
  domain: string
  owner: string
  token: string
  isDefault: boolean
}

const emptyScmForm: ScmConnectionForm = {
  name: "",
  domain: "github.com",
  owner: "",
  token: "",
  isDefault: false,
}

export default function SettingsPage() {
  const { setTheme } = useTheme()
  const persistedDarkModeRef = useRef(DEFAULT_SETTINGS.darkMode)
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)
  const [scmConnections, setScmConnections] = useState<ScmConnection[]>([])
  const [showScmForm, setShowScmForm] = useState(false)
  const [editingScmId, setEditingScmId] = useState<string | null>(null)
  const [scmForm, setScmForm] = useState<ScmConnectionForm>(emptyScmForm)
  const [scmSubmitting, setScmSubmitting] = useState(false)
  const [deletingScmId, setDeletingScmId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, connectionsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/scm-connections"),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
        setOriginalSettings(data)
      }
      if (connectionsRes.ok) {
        const data = await connectionsRes.json()
        if (Array.isArray(data)) setScmConnections(data)
      }
    }
    fetchData()
  }, [])

  function startCreateScm() {
    setScmForm(emptyScmForm)
    setEditingScmId(null)
    setShowScmForm(true)
  }

  function startEditScm(connection: ScmConnection) {
    setScmForm({ name: connection.name, domain: connection.domain, owner: connection.owner, token: "", isDefault: connection.isDefault })
    setEditingScmId(connection.id)
    setShowScmForm(false)
  }

  function resetScmForm() {
    setScmForm(emptyScmForm)
    setEditingScmId(null)
    setShowScmForm(false)
  }

  async function handleScmSubmit() {
    if (!scmForm.name.trim() || !scmForm.owner.trim()) {
      toast({ title: "名称和 Owner 不能为空", variant: "destructive" })
      return
    }
    if (!editingScmId && !scmForm.token.trim()) {
      toast({ title: "Token 不能为空", variant: "destructive" })
      return
    }
    setScmSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        name: scmForm.name.trim(),
        domain: scmForm.domain.trim() || "github.com",
        owner: scmForm.owner.trim(),
        isDefault: scmForm.isDefault,
      }
      if (scmForm.token.trim()) payload.token = scmForm.token.trim()

      const res = await fetch(editingScmId ? `/api/scm-connections/${editingScmId}` : "/api/scm-connections", {
        method: editingScmId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "保存失败")
      }
      const refreshed = await fetch("/api/scm-connections")
      if (refreshed.ok) setScmConnections(await refreshed.json())
      resetScmForm()
      toast({ title: editingScmId ? "SCM 连接已更新" : "SCM 连接已创建" })
    } catch (error) {
      toast({ title: "操作失败", description: error instanceof Error ? error.message : "请重试", variant: "destructive" })
    } finally {
      setScmSubmitting(false)
    }
  }

  async function handleScmDelete(id: string) {
    setScmSubmitting(true)
    try {
      const res = await fetch(`/api/scm-connections/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("删除失败")
      setScmConnections((prev) => prev.filter((c) => c.id !== id))
      setDeletingScmId(null)
      toast({ title: "SCM 连接已删除" })
    } catch (error) {
      toast({ title: "删除失败", description: error instanceof Error ? error.message : "请重试", variant: "destructive" })
    } finally {
      setScmSubmitting(false)
    }
  }

  async function handleSetDefaultScm(id: string) {
    try {
      const res = await fetch(`/api/scm-connections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error("设置失败")
      const refreshed = await fetch("/api/scm-connections")
      if (refreshed.ok) setScmConnections(await refreshed.json())
      toast({ title: "默认 SCM 连接已更新" })
    } catch (error) {
      toast({ title: "操作失败", description: error instanceof Error ? error.message : "请重试", variant: "destructive" })
    }
  }

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

            {/* SCM 连接管理 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>SCM 连接</CardTitle>
                    <CardDescription>配置 GitHub / GitHub Enterprise 访问凭证，供仓库绑定使用</CardDescription>
                  </div>
                  <Button size="sm" onClick={startCreateScm} disabled={showScmForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加连接
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showScmForm && (
                  <div className="space-y-3 rounded-lg border border-primary/20 p-4">
                    <div className="text-sm font-medium">新建 SCM 连接</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor="scm-name">名称 *</Label>
                        <Input
                          id="scm-name"
                          value={scmForm.name}
                          onChange={(e) => setScmForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="例如：公司 GitHub"
                        />
                      </div>
                      <div>
                        <Label htmlFor="scm-domain">域名</Label>
                        <Input
                          id="scm-domain"
                          value={scmForm.domain}
                          onChange={(e) => setScmForm((prev) => ({ ...prev, domain: e.target.value }))}
                          placeholder="github.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="scm-owner">Owner *</Label>
                        <Input
                          id="scm-owner"
                          value={scmForm.owner}
                          onChange={(e) => setScmForm((prev) => ({ ...prev, owner: e.target.value }))}
                          placeholder="组织或用户名"
                        />
                      </div>
                      <div>
                        <Label htmlFor="scm-token">Personal Access Token *</Label>
                        <Input
                          id="scm-token"
                          type="password"
                          value={scmForm.token}
                          onChange={(e) => setScmForm((prev) => ({ ...prev, token: e.target.value }))}
                          placeholder="ghp_xxxxxxxxxxxx"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={resetScmForm} disabled={scmSubmitting}>
                        <X className="mr-2 h-4 w-4" />取消
                      </Button>
                      <Button size="sm" onClick={handleScmSubmit} disabled={scmSubmitting}>
                        {scmSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        保存
                      </Button>
                    </div>
                  </div>
                )}

                {scmConnections.length === 0 && !showScmForm ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    <Key className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    暂无 SCM 连接，点击右上角“添加连接”开始配置
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scmConnections.map((connection) => (
                      <div key={connection.id} className="rounded-lg border p-4">
                        {editingScmId === connection.id ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <Label>名称 *</Label>
                                <Input value={scmForm.name} onChange={(e) => setScmForm((prev) => ({ ...prev, name: e.target.value }))} />
                              </div>
                              <div>
                                <Label>域名</Label>
                                <Input value={scmForm.domain} onChange={(e) => setScmForm((prev) => ({ ...prev, domain: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Owner *</Label>
                                <Input value={scmForm.owner} onChange={(e) => setScmForm((prev) => ({ ...prev, owner: e.target.value }))} />
                              </div>
                              <div>
                                <Label>新 Token（留空则不更新）</Label>
                                <Input type="password" value={scmForm.token} placeholder="留空保持不变" onChange={(e) => setScmForm((prev) => ({ ...prev, token: e.target.value }))} />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={resetScmForm} disabled={scmSubmitting}>
                                <X className="mr-2 h-4 w-4" />取消
                              </Button>
                              <Button size="sm" onClick={handleScmSubmit} disabled={scmSubmitting}>
                                {scmSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{connection.name}</span>
                                {connection.isDefault && <Badge variant="secondary">默认</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {connection.provider} · {connection.domain} / {connection.owner}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!connection.isDefault && (
                                <Button variant="ghost" size="sm" onClick={() => handleSetDefaultScm(connection.id)}>
                                  设为默认
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => startEditScm(connection)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {deletingScmId === connection.id ? (
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="destructive" onClick={() => handleScmDelete(connection.id)} disabled={scmSubmitting}>确认删除</Button>
                                  <Button size="sm" variant="outline" onClick={() => setDeletingScmId(null)} disabled={scmSubmitting}>取消</Button>
                                </div>
                              ) : (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingScmId(connection.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
