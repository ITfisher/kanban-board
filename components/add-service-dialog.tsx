"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  techStack: string[]
  testBranch: string
  masterBranch: string
}

interface AddServiceDialogProps {
  onClose: () => void
  onAddService: (service: Service) => void
  existingServices: Service[]
}

export function AddServiceDialog({ onClose, onAddService, existingServices }: AddServiceDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    repository: "",
    status: "healthy" as Service["status"],
    testBranch: "develop",
    masterBranch: "main",
  })
  const [techStack, setTechStack] = useState<string[]>([])
  const [newTech, setNewTech] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) return

    const newService: Service = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      repository: formData.repository,
      status: formData.status,
      techStack,
      testBranch: formData.testBranch,
      masterBranch: formData.masterBranch,
    }

    onAddService(newService)
    onClose()
  }

  const addTech = () => {
    if (newTech.trim() && !techStack.includes(newTech.trim())) {
      setTechStack([...techStack, newTech.trim()])
      setNewTech("")
    }
  }

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">添加新服务</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="status">状态</Label>
              <Select
                value={formData.status}
                onValueChange={(value: Service["status"]) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">🟢 健康</SelectItem>
                  <SelectItem value="warning">🟡 警告</SelectItem>
                  <SelectItem value="error">🔴 错误</SelectItem>
                  <SelectItem value="maintenance">🔵 维护中</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="服务的简要描述"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="repository">仓库地址</Label>
            <Input
              id="repository"
              value={formData.repository}
              onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
              placeholder="例如: https://github.com/user/repo"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="testBranch">测试分支</Label>
              <Input
                id="testBranch"
                value={formData.testBranch}
                onChange={(e) => setFormData({ ...formData, testBranch: e.target.value })}
                placeholder="develop"
              />
            </div>
            <div>
              <Label htmlFor="masterBranch">主分支</Label>
              <Input
                id="masterBranch"
                value={formData.masterBranch}
                onChange={(e) => setFormData({ ...formData, masterBranch: e.target.value })}
                placeholder="main"
              />
            </div>
          </div>

          <div>
            <Label>技术栈</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                placeholder="添加技术栈"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTech())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTech}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <Badge key={tech} variant="outline" className="flex items-center gap-1">
                  {tech}
                  <button type="button" onClick={() => removeTech(tech)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">添加服务</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
