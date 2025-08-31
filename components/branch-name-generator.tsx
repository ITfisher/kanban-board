"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { generateBranchName, getBranchTemplates, validateBranchName } from "@/lib/branch-generator"
import { RefreshCw, Copy, Check, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface BranchNameGeneratorProps {
  taskTitle: string
  serviceName: string
  priority?: "low" | "medium" | "high"
  taskId?: string
  onBranchGenerated?: (branchName: string, taskType: string) => void
  initialBranchName?: string
}

export function BranchNameGenerator({
  taskTitle,
  serviceName,
  priority = "medium",
  taskId,
  onBranchGenerated,
  initialBranchName,
}: BranchNameGeneratorProps) {
  const [taskType, setTaskType] = useState<string>("feature")
  const [generatedBranch, setGeneratedBranch] = useState<string>("")
  const [customBranch, setCustomBranch] = useState<string>("")
  const [useCustom, setUseCustom] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  const templates = getBranchTemplates()

  // Generate initial branch name
  useEffect(() => {
    if (taskTitle && serviceName) {
      const branch = generateBranchName({
        taskTitle,
        serviceName,
        priority,
        taskType,
        taskId,
      })
      setGeneratedBranch(branch)

      if (!useCustom && onBranchGenerated) {
        onBranchGenerated(branch, taskType)
      }
    }
  }, [taskTitle, serviceName, priority, taskType, taskId, useCustom, onBranchGenerated])

  // Set initial custom branch if provided
  useEffect(() => {
    if (initialBranchName && !customBranch) {
      setCustomBranch(initialBranchName)
      setUseCustom(true)
    }
  }, [initialBranchName, customBranch])

  const handleRegenerateBranch = () => {
    const branch = generateBranchName({
      taskTitle,
      serviceName,
      priority,
      taskType,
      taskId: Date.now().toString(), // Use current timestamp for uniqueness
    })
    setGeneratedBranch(branch)

    if (!useCustom && onBranchGenerated) {
      onBranchGenerated(branch, taskType)
    }
  }

  const handleCustomBranchChange = (value: string) => {
    setCustomBranch(value)
    if (useCustom && onBranchGenerated) {
      onBranchGenerated(value, taskType)
    }
  }

  const handleUseCustomToggle = (custom: boolean) => {
    setUseCustom(custom)
    const branchToUse = custom ? customBranch : generatedBranch
    if (onBranchGenerated) {
      onBranchGenerated(branchToUse, taskType)
    }
  }

  const handleCopyBranch = async () => {
    const branchToCopy = useCustom ? customBranch : generatedBranch
    try {
      await navigator.clipboard.writeText(branchToCopy)
      setCopied(true)
      toast({
        title: "已复制",
        description: "分支名已复制到剪贴板",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  const currentBranch = useCustom ? customBranch : generatedBranch
  const validation = validateBranchName(currentBranch)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">分支名生成器</CardTitle>
        <CardDescription className="text-xs">根据任务信息自动生成规范的Git分支名</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task Type Selection */}
        <div>
          <Label className="text-xs">任务类型</Label>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(templates).map(([key, template]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {template.prefix}
                    </Badge>
                    <span>{template.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Generated Branch */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">自动生成</Label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleRegenerateBranch} className="h-6 w-6 p-0">
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={useCustom ? "outline" : "default"}
                onClick={() => handleUseCustomToggle(false)}
                className="h-6 text-xs px-2"
              >
                使用
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input value={generatedBranch} readOnly className="h-8 font-mono text-xs bg-muted/50" />
            <Button size="sm" variant="ghost" onClick={handleCopyBranch} className="h-8 w-8 p-0">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Custom Branch */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">自定义分支名</Label>
            <Button
              size="sm"
              variant={useCustom ? "default" : "outline"}
              onClick={() => handleUseCustomToggle(true)}
              className="h-6 text-xs px-2"
            >
              使用
            </Button>
          </div>
          <Input
            value={customBranch}
            onChange={(e) => handleCustomBranchChange(e.target.value)}
            placeholder="输入自定义分支名"
            className="h-8 font-mono text-xs"
          />
        </div>

        {/* Validation */}
        {!validation.isValid && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-xs text-destructive">
              <div className="font-medium mb-1">分支名验证失败:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Current Selection */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>当前选择:</span>
            <Badge variant={useCustom ? "secondary" : "default"} className="text-xs">
              {useCustom ? "自定义" : "自动生成"}
            </Badge>
          </div>
          <div className="mt-1 p-2 bg-muted/30 rounded text-xs font-mono break-all">{currentBranch || "未生成"}</div>
        </div>
      </CardContent>
    </Card>
  )
}
