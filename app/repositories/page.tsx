"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { parseRepositoryUrl } from "@/lib/repository-url"
import { Check, Edit2, GitBranch, GitMerge, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"

type RepositoryItem = {
  id: string
  name: string
  provider: "github" | "github-enterprise"
  domain: string
  owner: string
  slug: string
  fullName: string
  defaultBranch: string
  description?: string
  serviceCount: number
  taskBranchCount: number
}

type ConnectionItem = {
  id: string
  name: string
  provider: "github" | "github-enterprise"
  domain: string
  owner: string
  isDefault?: boolean
  repositoryIds: string[]
}

type ServiceItem = {
  id: string
  name: string
  repositoryId?: string
}

type TaskBranchItem = {
  id: string
  name: string
  repositoryId: string
}

type RepositoryForm = {
  repoUrl: string
  owner: string
  name: string
  slug: string
  domain: string
  defaultBranch: string
  description: string
}

const emptyForm: RepositoryForm = {
  repoUrl: "",
  owner: "",
  name: "",
  slug: "",
  domain: "github.com",
  defaultBranch: "main",
  description: "",
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<RepositoryItem[]>([])
  const [connections, setConnections] = useState<ConnectionItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [taskBranches, setTaskBranches] = useState<TaskBranchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRepository, setEditingRepository] = useState<string | null>(null)
  const [deletingRepository, setDeletingRepository] = useState<string | null>(null)
  const [form, setForm] = useState<RepositoryForm>(emptyForm)
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([])
  const parsedRepoUrl = useMemo(() => parseRepositoryUrl(form.repoUrl), [form.repoUrl])

  const refreshData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [repositoriesRes, connectionsRes, servicesRes, taskBranchesRes] = await Promise.all([
        fetch("/api/repositories", { cache: "no-store" }),
        fetch("/api/scm-connections", { cache: "no-store" }),
        fetch("/api/services", { cache: "no-store" }),
        fetch("/api/task-branches", { cache: "no-store" }),
      ])

      if (!repositoriesRes.ok) {
        throw new Error(`获取仓库列表失败（${repositoriesRes.status}）`)
      }
      if (!connectionsRes.ok) {
        throw new Error(`获取 SCM 连接失败（${connectionsRes.status}）`)
      }
      if (!servicesRes.ok) {
        throw new Error(`获取服务列表失败（${servicesRes.status}）`)
      }
      if (!taskBranchesRes.ok) {
        throw new Error(`获取需求分支列表失败（${taskBranchesRes.status}）`)
      }

      const [repositoriesData, connectionsData, servicesData, taskBranchesData] = await Promise.all([
        repositoriesRes.json(),
        connectionsRes.json(),
        servicesRes.json(),
        taskBranchesRes.json(),
      ])

      if (!Array.isArray(repositoriesData)) {
        throw new Error("仓库接口返回的数据格式不正确")
      }
      if (!Array.isArray(connectionsData)) {
        throw new Error("SCM 连接接口返回的数据格式不正确")
      }
      if (!Array.isArray(servicesData)) {
        throw new Error("服务接口返回的数据格式不正确")
      }
      if (!Array.isArray(taskBranchesData)) {
        throw new Error("需求分支接口返回的数据格式不正确")
      }

      setRepositories(repositoriesData as RepositoryItem[])
      setConnections(
        (connectionsData as ConnectionItem[]).map((connection) => ({
          ...connection,
          repositoryIds: Array.isArray(connection?.repositoryIds) ? connection.repositoryIds : [],
        }))
      )
      setServices(servicesData as ServiceItem[])
      setTaskBranches(taskBranchesData as TaskBranchItem[])
    } catch (error) {
      console.error("Failed to load repository page data:", error)
      const message = error instanceof Error ? error.message : "加载仓库页面失败"
      setLoadError(message)
      setRepositories([])
      setConnections([])
      setServices([])
      setTaskBranches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const repositoryStats = useMemo(() => {
    return {
      repositoryCount: repositories.length,
      boundConnectionCount: repositories.filter((repository) =>
        connections.some((connection) => connection.repositoryIds.includes(repository.id))
      ).length,
      branchCount: taskBranches.length,
    }
  }, [connections, repositories, taskBranches.length])

  function resetForm() {
    setForm(emptyForm)
    setSelectedConnectionIds([])
    setEditingRepository(null)
    setShowCreateForm(false)
  }

  function startCreate() {
    setForm(emptyForm)
    setSelectedConnectionIds([])
    setEditingRepository(null)
    setShowCreateForm(true)
  }

  function startEdit(repository: RepositoryItem) {
    setForm({
      repoUrl: `https://${repository.domain}/${repository.owner}/${repository.slug}.git`,
      owner: repository.owner,
      name: repository.name,
      slug: repository.slug,
      domain: repository.domain,
      defaultBranch: repository.defaultBranch,
      description: repository.description ?? "",
    })
    setSelectedConnectionIds(
      connections.filter((connection) => connection.repositoryIds.includes(repository.id)).map((connection) => connection.id)
    )
    setEditingRepository(repository.id)
    setShowCreateForm(false)
  }

  function suggestConnectionIds(domain: string) {
    const sameDomainConnections = connections.filter((connection) => connection.domain === domain)
    const defaultConnection = sameDomainConnections.find((connection) => connection.isDefault)

    if (defaultConnection) {
      return [defaultConnection.id]
    }

    if (sameDomainConnections.length === 1) {
      return [sameDomainConnections[0].id]
    }

    return []
  }

  function applyParsedRepository(options?: { autoSelectConnections?: boolean; silent?: boolean }) {
    const autoSelectConnections = options?.autoSelectConnections ?? true
    if (!parsedRepoUrl) {
      if (!options?.silent) {
        toast({
          title: "仓库地址无法解析",
          description: "请填写类似 https://github.com/owner/repo.git 或 git@github.com:owner/repo.git 的地址",
          variant: "destructive",
        })
      }
      return
    }

    setForm((prev) => ({
      ...prev,
      owner: parsedRepoUrl.owner,
      name: parsedRepoUrl.name,
      slug: parsedRepoUrl.slug,
      domain: parsedRepoUrl.domain,
    }))

    if (autoSelectConnections) {
      setSelectedConnectionIds((prev) => (prev.length > 0 ? prev : suggestConnectionIds(parsedRepoUrl.domain)))
    }
  }

  async function syncRepositoryConnections(repositoryId: string, nextConnectionIds: string[]) {
    const currentConnectionIds = new Set(
      connections.filter((connection) => connection.repositoryIds.includes(repositoryId)).map((connection) => connection.id)
    )
    const targetConnectionIds = new Set(nextConnectionIds)

    const changedConnections = connections.filter((connection) => {
      const hasRepo = connection.repositoryIds.includes(repositoryId)
      const shouldHaveRepo = targetConnectionIds.has(connection.id)
      return hasRepo !== shouldHaveRepo
    })

    await Promise.all(
      changedConnections.map(async (connection) => {
        const repositoryIds = connection.repositoryIds.filter((value) => value !== repositoryId)
        if (targetConnectionIds.has(connection.id)) {
          repositoryIds.push(repositoryId)
        }

        const response = await fetch(`/api/scm-connections/${connection.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryIds }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || `更新 SCM 绑定失败：${connection.name}`)
        }
      })
    )

    if (currentConnectionIds.size > 0 || targetConnectionIds.size > 0) {
      await refreshData()
    }
  }

  async function handleSubmit() {
    if (form.repoUrl.trim() && parsedRepoUrl) {
      const parsedConnectionSuggestion = suggestConnectionIds(parsedRepoUrl.domain)
      if (selectedConnectionIds.length === 0 && parsedConnectionSuggestion.length > 0) {
        setSelectedConnectionIds(parsedConnectionSuggestion)
      }
    }

    if (!form.repoUrl.trim() && (!form.owner.trim() || !form.name.trim())) {
      toast({ title: "请先填写仓库地址，或补全 owner 和仓库名称", variant: "destructive" })
      return
    }

    if (form.repoUrl.trim() && !parsedRepoUrl && (!form.owner.trim() || !form.name.trim())) {
      toast({ title: "仓库地址解析失败，请检查 URL 或手动补全 owner 和仓库名称", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        repoUrl: form.repoUrl.trim() || undefined,
        owner: form.owner.trim(),
        name: form.name.trim(),
        slug: form.slug.trim() || form.name.trim(),
        domain: form.domain.trim() || parsedRepoUrl?.domain || "github.com",
        provider: parsedRepoUrl?.provider,
        defaultBranch: form.defaultBranch.trim() || "main",
        description: form.description.trim(),
      }

      const response = await fetch(editingRepository ? `/api/repositories/${editingRepository}` : "/api/repositories", {
        method: editingRepository ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "保存仓库失败")
      }

      const savedRepository: RepositoryItem = await response.json()
      await syncRepositoryConnections(savedRepository.id, selectedConnectionIds)
      await refreshData()
      resetForm()

      toast({
        title: editingRepository ? "仓库已更新" : "仓库已创建",
        description: `${savedRepository.fullName} 已保存`,
      })
    } catch (error) {
      toast({
        title: editingRepository ? "更新失败" : "创建失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(repositoryId: string) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/repositories/${repositoryId}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "删除仓库失败")
      }

      await refreshData()
      setDeletingRepository(null)
      toast({ title: "仓库已删除" })
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

  function toggleConnection(connectionId: string, checked: boolean) {
    setSelectedConnectionIds((prev) =>
      checked ? Array.from(new Set([...prev, connectionId])) : prev.filter((value) => value !== connectionId)
    )
  }

  function getRepositoryConnections(repositoryId: string) {
    return connections.filter((connection) => connection.repositoryIds.includes(repositoryId))
  }

  function getRepositoryServices(repositoryId: string) {
    return services.filter((service) => service.repositoryId === repositoryId)
  }

  function getRepositoryBranches(repositoryId: string) {
    return taskBranches.filter((branch) => branch.repositoryId === repositoryId)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <GitMerge className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">仓库管理</h1>
              <p className="text-sm text-muted-foreground">维护仓库根实体、SCM 绑定以及仓库下的服务与需求分支概览</p>
            </div>
          </div>
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            添加仓库
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>仓库数</CardDescription>
              <CardTitle>{repositoryStats.repositoryCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已绑定 SCM</CardDescription>
              <CardTitle>{repositoryStats.boundConnectionCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>需求分支总数</CardDescription>
              <CardTitle>{repositoryStats.branchCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {(showCreateForm || editingRepository) && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle>{editingRepository ? "编辑仓库" : "新建仓库"}</CardTitle>
              <CardDescription>仓库是需求分支、服务和 SCM 绑定的根实体。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="repo-url">仓库地址</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => applyParsedRepository()} disabled={!form.repoUrl.trim()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      从 URL 解析
                    </Button>
                  </div>
                  <Input
                    id="repo-url"
                    value={form.repoUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, repoUrl: event.target.value }))}
                    onBlur={() => {
                      if (form.repoUrl.trim()) {
                        applyParsedRepository({ silent: true })
                      }
                    }}
                    placeholder="例如 https://github.com/ITfisher/kanban-board.git"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    支持 `https://github.com/owner/repo.git`、`https://域名/owner/repo`、`git@域名:owner/repo.git`
                  </div>
                  {parsedRepoUrl ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{parsedRepoUrl.provider}</Badge>
                      <Badge variant="outline">{parsedRepoUrl.domain}</Badge>
                      <Badge variant="outline">{parsedRepoUrl.fullName}</Badge>
                    </div>
                  ) : form.repoUrl.trim() ? (
                    <p className="mt-2 text-xs text-destructive">当前地址无法自动解析，请检查格式或手动补全字段。</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="repo-owner">Owner</Label>
                  <Input
                    id="repo-owner"
                    value={form.owner}
                    onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))}
                    placeholder="例如 my-org"
                  />
                </div>
                <div>
                  <Label htmlFor="repo-name">仓库名称</Label>
                  <Input
                    id="repo-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="例如 kanban-board"
                  />
                </div>
                <div>
                  <Label htmlFor="repo-slug">Slug</Label>
                  <Input
                    id="repo-slug"
                    value={form.slug}
                    onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="默认使用仓库名称"
                  />
                </div>
                <div>
                  <Label htmlFor="repo-domain">域名</Label>
                  <Input
                    id="repo-domain"
                    value={form.domain}
                    onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
                    placeholder="github.com"
                  />
                </div>
                <div>
                  <Label htmlFor="repo-default-branch">默认分支</Label>
                  <Input
                    id="repo-default-branch"
                    value={form.defaultBranch}
                    onChange={(event) => setForm((prev) => ({ ...prev, defaultBranch: event.target.value }))}
                    placeholder="main"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="repo-description">描述</Label>
                <Textarea
                  id="repo-description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  placeholder="仓库说明，可选"
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <div className="text-sm font-medium">SCM 绑定</div>
                  <div className="text-xs text-muted-foreground">
                    系统会优先按仓库地址里的域名自动推荐连接；如果同域有多套凭证，你也可以手动改绑。
                  </div>
                </div>
                {connections.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无 SCM 连接，可先去设置页创建。</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {connections.map((connection) => {
                      const checked = selectedConnectionIds.includes(connection.id)
                      const isRecommended = parsedRepoUrl?.domain === connection.domain

                      return (
                        <label
                          key={connection.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                        >
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleConnection(connection.id, value === true)} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{connection.name}</span>
                              {connection.isDefault && <Badge variant="secondary">默认</Badge>}
                              {isRecommended && <Badge variant="outline">同域推荐</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {connection.provider} · {connection.domain}/{connection.owner}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm} disabled={submitting}>
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  保存仓库
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
            <GitMerge className="mb-3 h-10 w-10 text-destructive" />
            <h3 className="text-base font-medium text-destructive">加载失败</h3>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <Button className="mt-4" variant="outline" onClick={() => void refreshData()}>
              重新加载
            </Button>
          </div>
        ) : repositories.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <GitMerge className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-base font-medium">暂无仓库</h3>
            <p className="mt-2 text-sm text-muted-foreground">先创建仓库，再把服务、需求分支和 SCM 连接挂到仓库根实体上。</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {repositories.map((repository) => {
              const boundConnections = getRepositoryConnections(repository.id)
              const linkedServices = getRepositoryServices(repository.id)
              const linkedBranches = getRepositoryBranches(repository.id)

              return (
                <Card key={repository.id} className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{repository.fullName}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {repository.description || `${repository.domain} · 默认分支 ${repository.defaultBranch}`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(repository)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingRepository(repository.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {deletingRepository === repository.id && (
                      <div className="rounded-lg border border-destructive bg-destructive/5 p-3">
                        <p className="mb-2 text-sm font-medium text-destructive">确认删除这个仓库？</p>
                        <p className="mb-3 text-xs text-muted-foreground">如果该仓库仍被服务或需求分支引用，接口会阻止删除。</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(repository.id)} disabled={submitting}>
                            确认删除
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeletingRepository(null)} disabled={submitting}>
                            取消
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">服务数</div>
                        <div className="mt-1 font-medium">{repository.serviceCount}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">需求分支</div>
                        <div className="mt-1 font-medium">{repository.taskBranchCount}</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">SCM 绑定</div>
                        <div className="flex flex-wrap gap-2">
                          {boundConnections.length > 0 ? (
                            boundConnections.map((connection) => (
                              <Badge key={connection.id} variant="outline">
                                {connection.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">未绑定</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">仓库下服务</div>
                        <div className="flex flex-wrap gap-2">
                          {linkedServices.length > 0 ? (
                            linkedServices.slice(0, 4).map((service) => (
                              <Badge key={service.id} variant="secondary">
                                {service.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无服务</span>
                          )}
                          {linkedServices.length > 4 && <Badge variant="secondary">+{linkedServices.length - 4}</Badge>}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">最近需求分支</div>
                        <div className="space-y-1">
                          {linkedBranches.length > 0 ? (
                            linkedBranches.slice(0, 3).map((branch) => (
                              <div key={branch.id} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <GitBranch className="h-3 w-3" />
                                <span className="font-mono text-foreground">{branch.name}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">暂无需求分支</span>
                          )}
                        </div>
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
