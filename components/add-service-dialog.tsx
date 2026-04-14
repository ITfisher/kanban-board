"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Plus } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { Service } from "@/lib/types"

interface RepositoryOption {
  id: string
  fullName: string
  domain: string
  owner: string
  slug: string
  defaultBranch: string
}

interface AddServiceDialogProps {
  onClose: () => void
  onAddService: (service: Service) => void
  existingServices: Service[]
}

type RepoMode = "existing" | "new"

export function AddServiceDialog({ onClose, onAddService, existingServices }: AddServiceDialogProps) {
  const [repositories, setRepositories] = useState<RepositoryOption[]>([])
  const [loadingRepos, setLoadingRepos] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [repoMode, setRepoMode] = useState<RepoMode>("existing")
  const [selectedRepoId, setSelectedRepoId] = useState("")

  const [newRepo, setNewRepo] = useState({
    owner: "",
    name: "",
    domain: "github.com",
    defaultBranch: "main",
  })

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rootPath: "",
  })

  useEffect(() => {
    fetch("/api/repositories")
      .then((r) => r.json())
      .then((data: RepositoryOption[]) => {
        if (Array.isArray(data)) {
          setRepositories(data)
          // Auto-switch to "new" mode if no repos exist yet
          if (data.length === 0) setRepoMode("new")
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRepos(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return
    if (existingServices.some((s) => s.name === formData.name.trim())) {
      toast({ title: "服务名称已存在", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      let repositoryId = selectedRepoId

      // Create repository first if in "new" mode
      if (repoMode === "new") {
        if (!newRepo.owner.trim() || !newRepo.name.trim()) {
          toast({ title: "请填写仓库 owner 和名称", variant: "destructive" })
          return
        }

        const repoRes = await fetch("/api/repositories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: newRepo.owner.trim(),
            name: newRepo.name.trim(),
            slug: newRepo.name.trim(),
            domain: newRepo.domain.trim() || "github.com",
            defaultBranch: newRepo.defaultBranch.trim() || "main",
          }),
        })

        if (!repoRes.ok) {
          const err = await repoRes.json().catch(() => null)
          throw new Error(err?.error || "创建仓库失败")
        }

        const createdRepo = await repoRes.json()
        repositoryId = createdRepo.id

        // Refresh repo list in state (for display only, dialog will close)
        setRepositories((prev) => [...prev, createdRepo])
      }

      if (!repositoryId) {
        toast({ title: "请选择或创建一个仓库", variant: "destructive" })
        return
      }

      const newService = {
        id: crypto.randomUUID(),
        repositoryId,
        name: formData.name.trim(),
        description: formData.description,
        rootPath: formData.rootPath.trim() || undefined,
      } as Service

      onAddService(newService)
      onClose()
    } catch (error) {
      toast({
        title: "添加失败",
        description: error instanceof Error ? error.message : "请重试",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-auto m-4">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">添加新服务</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Service fields */}
          <div>
            <Label htmlFor="name">服务名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: user-service"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="服务的简要描述"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="rootPath">
              根路径
              <span className="ml-1 text-xs text-muted-foreground">（Monorepo 子目录，如 services/user）</span>
            </Label>
            <Input
              id="rootPath"
              value={formData.rootPath}
              onChange={(e) => setFormData({ ...formData, rootPath: e.target.value })}
              placeholder="留空则代表仓库根目录"
            />
          </div>

          {/* Repository section */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">关联仓库 *</Label>
              {repositories.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={repoMode === "existing" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setRepoMode("existing")}
                  >
                    选择已有
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={repoMode === "new" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setRepoMode("new")}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    新建仓库
                  </Button>
                </div>
              )}
            </div>

            {repoMode === "existing" ? (
              <Select
                value={selectedRepoId}
                onValueChange={setSelectedRepoId}
                disabled={loadingRepos}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingRepos ? "加载中..." : "选择仓库"} />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="repo-owner" className="text-xs">Owner *</Label>
                    <Input
                      id="repo-owner"
                      value={newRepo.owner}
                      onChange={(e) => setNewRepo({ ...newRepo, owner: e.target.value })}
                      placeholder="例如: my-org"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="repo-name" className="text-xs">仓库名 *</Label>
                    <Input
                      id="repo-name"
                      value={newRepo.name}
                      onChange={(e) => setNewRepo({ ...newRepo, name: e.target.value })}
                      placeholder="例如: my-repo"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="repo-domain" className="text-xs">域名</Label>
                    <Input
                      id="repo-domain"
                      value={newRepo.domain}
                      onChange={(e) => setNewRepo({ ...newRepo, domain: e.target.value })}
                      placeholder="github.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="repo-branch" className="text-xs">默认分支</Label>
                    <Input
                      id="repo-branch"
                      value={newRepo.defaultBranch}
                      onChange={(e) => setNewRepo({ ...newRepo, defaultBranch: e.target.value })}
                      placeholder="main"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  提交时将自动创建仓库记录，服务随即关联到该仓库。
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "添加中..." : "添加服务"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
