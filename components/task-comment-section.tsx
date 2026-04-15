"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react"

type TaskComment = {
  id: string
  taskId: string
  content: string
  authorName: string
  createdAt: string
  updatedAt: string
}

interface TaskCommentSectionProps {
  taskId: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TaskCommentSection({ taskId }: TaskCommentSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "提交失败")
      }
      const created: TaskComment = await res.json()
      setComments((prev) => [...prev, created])
      setContent("")
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    } catch (error) {
      toast({ title: "添加备注失败", description: error instanceof Error ? error.message : "请重试", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("删除失败")
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (error) {
      toast({ title: "删除备注失败", description: error instanceof Error ? error.message : "请重试", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        备注
        {comments.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{comments.length}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          暂无备注，在下方输入第一条备注
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="group rounded-md border bg-muted/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.content}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(comment.id)}
                  disabled={deletingId === comment.id}
                >
                  {deletingId === comment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{formatTime(comment.createdAt)}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入备注内容… (Ctrl+Enter 提交)"
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !content.trim()}>
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            添加备注
          </Button>
        </div>
      </div>
    </div>
  )
}
