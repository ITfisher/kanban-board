"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import type { Task, User } from "@/lib/types"
import { Check, Edit2, Loader2, Mail, Plus, Trash2, UserCircle2, X } from "lucide-react"

type UserForm = {
  name: string
  email: string
  avatarUrl: string
}

const emptyForm: UserForm = {
  name: "",
  email: "",
  avatarUrl: "",
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)

  const refreshData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const [usersRes, tasksRes] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ])

      if (!usersRes.ok) throw new Error(`获取用户列表失败（${usersRes.status}）`)
      if (!tasksRes.ok) throw new Error(`获取任务列表失败（${tasksRes.status}）`)

      const [usersData, tasksData] = await Promise.all([usersRes.json(), tasksRes.json()])
      if (!Array.isArray(usersData)) throw new Error("用户接口返回的数据格式不正确")
      if (!Array.isArray(tasksData)) throw new Error("任务接口返回的数据格式不正确")

      setUsers(usersData as User[])
      setTasks(tasksData as Task[])
    } catch (error) {
      console.error("Failed to load users page data:", error)
      const message = error instanceof Error ? error.message : "加载用户页面失败"
      setLoadError(message)
      setUsers([])
      setTasks([])
      toast({
        title: "加载失败",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const taskCountByUserId = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks) {
      if (!task.ownerUserId) continue
      map.set(task.ownerUserId, (map.get(task.ownerUserId) ?? 0) + 1)
    }
    return map
  }, [tasks])

  const stats = useMemo(() => {
    const assignedUsers = users.filter((user) => (taskCountByUserId.get(user.id) ?? 0) > 0).length
    return {
      userCount: users.length,
      assignedUsers,
      assignedTaskCount: tasks.filter((task) => task.ownerUserId).length,
    }
  }, [taskCountByUserId, tasks, users])

  function resetForm() {
    setForm(emptyForm)
    setShowCreateForm(false)
    setEditingUserId(null)
  }

  function startCreate() {
    setForm(emptyForm)
    setEditingUserId(null)
    setShowCreateForm(true)
  }

  function startEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email ?? "",
      avatarUrl: user.avatarUrl ?? "",
    })
    setEditingUserId(user.id)
    setShowCreateForm(false)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "请输入用户名", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(editingUserId ? `/api/users/${editingUserId}` : "/api/users", {
        method: editingUserId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          avatarUrl: form.avatarUrl.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "保存用户失败")
      }

      await refreshData()
      resetForm()
      toast({
        title: editingUserId ? "用户已更新" : "用户已创建",
        description: `${form.name.trim()} 已保存`,
      })
    } catch (error) {
      toast({
        title: editingUserId ? "更新失败" : "创建失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(user: User) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "删除用户失败")
      }

      await refreshData()
      setDeletingUserId(null)
      toast({
        title: "用户已删除",
        description: `${user.name} 已删除；原负责人任务已转为未分配`,
      })
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <UserCircle2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">用户管理</h1>
              <p className="text-sm text-muted-foreground">维护任务负责人和需求分支开发者的用户档案</p>
            </div>
          </div>
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            添加用户
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>用户数</CardDescription>
              <CardTitle>{stats.userCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>有任务负责人身份的用户</CardDescription>
              <CardTitle>{stats.assignedUsers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已分配负责人任务</CardDescription>
              <CardTitle>{stats.assignedTaskCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {(showCreateForm || editingUserId) && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle>{editingUserId ? "编辑用户" : "新建用户"}</CardTitle>
              <CardDescription>任务负责人和分支开发者都从这里维护。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">用户名</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例如 张三"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">邮箱</Label>
                <Input
                  id="user-email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="例如 zhangsan@example.com"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="user-avatar">头像 URL</Label>
                <Input
                  id="user-avatar"
                  value={form.avatarUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button variant="outline" onClick={resetForm} disabled={submitting}>
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  保存用户
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-center">
            <UserCircle2 className="mb-3 h-10 w-10 text-destructive" />
            <h3 className="text-base font-medium text-destructive">加载失败</h3>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <Button className="mt-4" variant="outline" onClick={() => void refreshData()}>
              重新加载
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <UserCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">暂无用户</h3>
            <p className="mt-2 text-sm text-muted-foreground">先创建用户，任务创建和编辑页才能直接选择负责人。</p>
            <Button className="mt-4" onClick={startCreate}>
              <Plus className="mr-2 h-4 w-4" />
              添加第一个用户
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => {
              const assignedTaskCount = taskCountByUserId.get(user.id) ?? 0
              return (
                <Card key={user.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="truncate">{user.name}</CardTitle>
                          <CardDescription className="truncate">{user.email || "未填写邮箱"}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(user)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {deletingUserId === user.id && (
                      <div className="rounded-lg border border-destructive bg-destructive/5 p-3">
                        <p className="mb-2 text-sm font-medium text-destructive">确认删除该用户？</p>
                        <p className="mb-3 text-xs text-muted-foreground">
                          删除后会移除负责人绑定，并从需求分支开发者中清除。
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(user)} disabled={submitting}>
                            确认删除
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeletingUserId(null)} disabled={submitting}>
                            取消
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">负责人任务</div>
                        <div className="mt-1 font-medium">{assignedTaskCount}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">来源</div>
                        <div className="mt-1 font-medium">{user.source || "manual"}</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{user.email || "暂无邮箱"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {assignedTaskCount > 0 ? <Badge variant="secondary">负责人中</Badge> : <Badge variant="outline">未分配任务</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
