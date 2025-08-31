"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Plus, GitMerge, Trash2, Eye, GitCommit } from "lucide-react"

interface Branch {
  name: string
  status: "active" | "merged" | "stale"
  lastCommit: string
  author: string
  createdAt: string
  associatedTasks: string[]
  commits: number
}

interface Task {
  id: string
  title: string
  gitBranch?: string
}

interface GitBranchManagerProps {
  tasks: Task[]
  onUpdateTask: (taskId: string, gitBranch: string) => void
}


export function GitBranchManager({ tasks, onUpdateTask }: GitBranchManagerProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [newBranchName, setNewBranchName] = useState("")
  const [selectedTask, setSelectedTask] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "merged":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "stale":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "活跃"
      case "merged":
        return "已合并"
      case "stale":
        return "过期"
      default:
        return "未知"
    }
  }

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return

    const newBranch: Branch = {
      name: newBranchName,
      status: "active",
      lastCommit: "feat: initial commit",
      author: "当前用户",
      createdAt: new Date().toISOString().split("T")[0],
      associatedTasks: selectedTask ? [selectedTask] : [],
      commits: 1,
    }

    setBranches([...branches, newBranch])

    if (selectedTask) {
      onUpdateTask(selectedTask, newBranchName)
    }

    setNewBranchName("")
    setSelectedTask("")
    setIsCreateDialogOpen(false)
  }

  const handleDeleteBranch = (branchName: string) => {
    if (branchName === "main") return
    setBranches(branches.filter((branch) => branch.name !== branchName))
  }

  const handleAssociateTask = (branchName: string, taskId: string) => {
    setBranches(
      branches.map((branch) =>
        branch.name === branchName
          ? { ...branch, associatedTasks: [...branch.associatedTasks.filter((id) => id !== taskId), taskId] }
          : { ...branch, associatedTasks: branch.associatedTasks.filter((id) => id !== taskId) },
      ),
    )
    onUpdateTask(taskId, branchName)
  }

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    return task ? task.title : "未知任务"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <GitCommit className="h-5 w-5" />
          Git 分支管理
        </h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              创建分支
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新分支</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="branchName">分支名称</Label>
                <Input
                  id="branchName"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/new-feature"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="associatedTask">关联任务（可选）</Label>
                <Select value={selectedTask} onValueChange={setSelectedTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要关联的任务" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无关联任务</SelectItem>
                    {tasks
                      .filter((task) => !task.gitBranch)
                      .map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateBranch} className="flex-1">
                  创建分支
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">
                  取消
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {branches.map((branch) => (
          <Card key={branch.name} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-mono">{branch.name}</CardTitle>
                  <Badge className={`text-xs ${getStatusColor(branch.status)}`}>{getStatusText(branch.status)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {branch.name !== "main" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <GitMerge className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBranch(branch.name)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitCommit className="h-3 w-3" />
                  <span>{branch.lastCommit}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>作者: {branch.author}</span>
                  <span>{branch.commits} 次提交</span>
                  <span>{branch.createdAt}</span>
                </div>

                {branch.associatedTasks.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">关联任务:</div>
                      <div className="flex flex-wrap gap-1">
                        {branch.associatedTasks.map((taskId) => (
                          <Badge key={taskId} variant="outline" className="text-xs">
                            {getTaskTitle(taskId)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {branch.name !== "main" && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <Label className="text-xs">关联新任务:</Label>
                      <Select onValueChange={(taskId) => handleAssociateTask(branch.name, taskId)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="选择任务" />
                        </SelectTrigger>
                        <SelectContent>
                          {tasks
                            .filter((task) => !task.gitBranch || task.gitBranch === branch.name)
                            .map((task) => (
                              <SelectItem key={task.id} value={task.id}>
                                {task.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
