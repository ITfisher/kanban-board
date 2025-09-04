"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string
  repository: string
  dependencies: string[]
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
    testBranch: "develop",
    masterBranch: "main",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) return

    const newService: Service = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      repository: formData.repository,
      dependencies: [],
      testBranch: formData.testBranch,
      masterBranch: formData.masterBranch,
    }

    onAddService(newService)
    onClose()
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
