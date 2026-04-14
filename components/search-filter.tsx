"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Filter } from "lucide-react"

interface SearchFilterProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  selectedPriority: string
  onPriorityChange: (priority: string) => void
  selectedAssignee: string
  onAssigneeChange: (assignee: string) => void
  assignees: string[]
  createdDateStart: string
  createdDateEnd: string
  completedDateStart: string
  completedDateEnd: string
  onCreatedDateStartChange: (value: string) => void
  onCreatedDateEndChange: (value: string) => void
  onCompletedDateStartChange: (value: string) => void
  onCompletedDateEndChange: (value: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  selectedPriority,
  onPriorityChange,
  selectedAssignee,
  onAssigneeChange,
  assignees,
  createdDateStart,
  createdDateEnd,
  completedDateStart,
  completedDateEnd,
  onCreatedDateStartChange,
  onCreatedDateEndChange,
  onCompletedDateStartChange,
  onCompletedDateEndChange,
  onClearFilters,
  hasActiveFilters,
}: SearchFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索任务..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className={isExpanded ? "bg-muted" : ""}
        >
          <Filter className="h-4 w-4 mr-2" />
          筛选
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-2" />
            清除
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 lg:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">优先级:</span>
            <Select value={selectedPriority} onValueChange={onPriorityChange}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">负责人:</span>
            <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">创建时间:</span>
            <Input type="date" value={createdDateStart} onChange={(e) => onCreatedDateStartChange(e.target.value)} className="h-8 w-[152px]" />
            <span className="text-xs text-muted-foreground">至</span>
            <Input type="date" value={createdDateEnd} onChange={(e) => onCreatedDateEndChange(e.target.value)} className="h-8 w-[152px]" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">完成时间:</span>
            <Input type="date" value={completedDateStart} onChange={(e) => onCompletedDateStartChange(e.target.value)} className="h-8 w-[152px]" />
            <span className="text-xs text-muted-foreground">至</span>
            <Input type="date" value={completedDateEnd} onChange={(e) => onCompletedDateEndChange(e.target.value)} className="h-8 w-[152px]" />
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1 lg:col-span-2">
              {selectedPriority !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  优先级: {selectedPriority}
                </Badge>
              )}
              {selectedAssignee !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  负责人: {selectedAssignee}
                </Badge>
              )}
              {createdDateStart && (
                <Badge variant="secondary" className="text-xs">
                  创建开始: {createdDateStart}
                </Badge>
              )}
              {createdDateEnd && (
                <Badge variant="secondary" className="text-xs">
                  创建结束: {createdDateEnd}
                </Badge>
              )}
              {completedDateStart && (
                <Badge variant="secondary" className="text-xs">
                  完成开始: {completedDateStart}
                </Badge>
              )}
              {completedDateEnd && (
                <Badge variant="secondary" className="text-xs">
                  完成结束: {completedDateEnd}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
