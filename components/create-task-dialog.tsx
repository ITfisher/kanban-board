"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, ExternalLink } from "lucide-react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"

interface Task {
  id: string
  title: string
  description: string
  status: "backlog" | "todo" | "in-progress" | "review" | "done"
  priority: "low" | "medium" | "high"
  assignee?: {
    name: string
    avatar?: string
  }
  jiraUrl?: string
}

interface CreateTaskDialogProps {
  onCreateTask: (task: Omit<Task, "id">) => void
  defaultStatus?: string
}

export function CreateTaskDialog({ onCreateTask, defaultStatus = "backlog" }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: defaultStatus as Task["status"],
    priority: "medium" as Task["priority"],
    assignee: undefined as Task["assignee"],
    jiraUrl: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.title.trim()) return

    const taskToCreate = {
      ...newTask,
      assignee: newTask.assignee?.name ? newTask.assignee : undefined,
      jiraUrl: newTask.jiraUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    onCreateTask(taskToCreate)
    setNewTask({
      title: "",
      description: "",
      status: defaultStatus as Task["status"],
      priority: "medium",
      assignee: undefined,
      jiraUrl: "",
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新建任务
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">任务标题 *</Label>
            <Input
              id="title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="输入任务标题"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">
              任务描述
              <span className="text-xs text-muted-foreground ml-2">
                支持 Markdown 格式
              </span>
            </Label>
            <div className="mt-2">
              <MDEditor
                value={newTask.description}
                onChange={(value) => setNewTask({ ...newTask, description: value || "" })}
                height={250}
                data-color-mode="light"
                visibleDragBar={false}
                preview="edit"
                hideToolbar={false}
                toolbarHeight={35}
                textareaProps={{
                  placeholder: "详细描述任务内容，支持 Markdown 格式...\n\n示例:\n## 功能需求\n- [ ] 任务1\n- [ ] 任务2\n\n### 技术要求\n```javascript\n// 代码示例\n```",
                  style: {
                    fontSize: "13px",
                    lineHeight: "1.5",
                    fontFamily: "inherit",
                  },
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">优先级</Label>
              <Select
                value={newTask.priority}
                onValueChange={(value: "low" | "medium" | "high") => setNewTask({ ...newTask, priority: value })}
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

            <div>
              <Label htmlFor="assignee">负责人</Label>
              <Input
                id="assignee"
                value={newTask.assignee?.name || ""}
                onChange={(e) =>
                  setNewTask({
                    ...newTask,
                    assignee: e.target.value ? { name: e.target.value } : undefined,
                  })
                }
                placeholder="输入负责人姓名"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="jiraUrl" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              JIRA需求链接 (可选)
            </Label>
            <Input
              id="jiraUrl"
              value={newTask.jiraUrl}
              onChange={(e) => setNewTask({ ...newTask, jiraUrl: e.target.value })}
              placeholder="https://jira.company.com/browse/PROJ-123"
              type="url"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              创建任务
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}