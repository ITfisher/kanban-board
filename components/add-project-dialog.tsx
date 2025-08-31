"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, X } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string
  repository: string
  status: "healthy" | "warning" | "error" | "maintenance"
  projectId: string
  techStack: string[]
  dependencies: string[]
  testBranch: string
  masterBranch: string
}

interface Project {
  id: string
  name: string
  description: string
  status: "planning" | "active" | "paused" | "completed" | "archived"
  priority: "low" | "medium" | "high"
  startDate: string
  endDate?: string
  owner: string
  members: string[]
  services: string[]
  tags: string[]
  budget?: number
  progress: number
  createdAt: string
  updatedAt: string
}

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  onProjectAdded: (project: Project) => void
}

export function AddProjectDialog({
  open,
  onOpenChange,
  services,
  onProjectAdded
}: AddProjectDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning" as Project["status"],
    priority: "medium" as Project["priority"],
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    owner: "",
    budget: ""
  })
  
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [members, setMembers] = useState<string[]>([])
  const [newMember, setNewMember] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) return

    const newProject: Project = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      owner: formData.owner,
      members,
      services: selectedServices,
      tags,
      budget: formData.budget ? Number(formData.budget) : undefined,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    onProjectAdded(newProject)
    handleReset()
  }

  const handleReset = () => {
    setFormData({
      name: "",
      description: "",
      status: "planning",
      priority: "medium",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      owner: "",
      budget: ""
    })
    setSelectedServices([])
    setMembers([])
    setNewMember("")
    setTags([])
    setNewTag("")
  }

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, serviceId])
    } else {
      setSelectedServices(selectedServices.filter(id => id !== serviceId))
    }
  }

  const handleAddMember = () => {
    if (newMember.trim() && !members.includes(newMember.trim())) {
      setMembers([...members, newMember.trim()])
      setNewMember("")
    }
  }

  const handleRemoveMember = (member: string) => {
    setMembers(members.filter(m => m !== member))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault()
      action()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              创建一个新的项目来管理相关的服务和需求
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">项目名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入项目名称"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">项目描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="输入项目描述"
                  rows={3}
                />
              </div>
            </div>

            {/* Status and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">项目状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Project["status"]) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">规划中</SelectItem>
                    <SelectItem value="active">进行中</SelectItem>
                    <SelectItem value="paused">暂停</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">优先级</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: Project["priority"]) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低优先级</SelectItem>
                    <SelectItem value="medium">中优先级</SelectItem>
                    <SelectItem value="high">高优先级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">开始日期</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Owner and Budget */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="owner">项目负责人</Label>
                <Input
                  id="owner"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  placeholder="输入负责人姓名"
                />
              </div>
              <div>
                <Label htmlFor="budget">预算</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder="输入预算金额"
                />
              </div>
            </div>

            {/* Services Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">关联服务</CardTitle>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无可用服务，请先创建服务
                  </p>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={service.id}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={(checked) =>
                            handleServiceToggle(service.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={service.id}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          <div className="flex justify-between items-center">
                            <span>{service.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {service.status === "healthy" && "正常"}
                              {service.status === "warning" && "警告"}
                              {service.status === "error" && "错误"}
                              {service.status === "maintenance" && "维护"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <div>
              <Label>团队成员</Label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    placeholder="输入成员姓名"
                    onKeyDown={(e) => handleKeyDown(e, handleAddMember)}
                  />
                  <Button type="button" variant="outline" onClick={handleAddMember}>
                    添加
                  </Button>
                </div>
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => (
                      <Badge key={member} variant="secondary" className="gap-1">
                        {member}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => handleRemoveMember(member)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <Label>标签</Label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="输入标签"
                    onKeyDown={(e) => handleKeyDown(e, handleAddTag)}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        {tag}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">
              创建项目
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}