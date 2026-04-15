import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskComments, tasks } from "@/lib/schema"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, id))
    return NextResponse.json(rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  } catch (error) {
    console.error("GET /api/tasks/[id]/comments error:", error)
    return NextResponse.json({ error: "获取评论失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, id))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    const body = await request.json()
    const content = (body.content ?? "").trim()
    if (!content) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const commentId = crypto.randomUUID()

    await db.insert(taskComments).values({
      id: commentId,
      taskId: id,
      content,
      authorName: (body.authorName ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db.select().from(taskComments).where(eq(taskComments.id, commentId))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("POST /api/tasks/[id]/comments error:", error)
    return NextResponse.json({ error: "创建评论失败" }, { status: 500 })
  }
}
