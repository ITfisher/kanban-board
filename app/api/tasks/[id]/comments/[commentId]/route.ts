import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskComments } from "@/lib/schema"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params
    const existing = await db.select().from(taskComments).where(eq(taskComments.id, commentId))
    if (existing.length === 0) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 })
    }
    await db.delete(taskComments).where(eq(taskComments.id, commentId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/tasks/[id]/comments/[commentId] error:", error)
    return NextResponse.json({ error: "删除评论失败" }, { status: 500 })
  }
}
