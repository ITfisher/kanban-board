import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getTaskBranchPayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { taskBranchDevelopers } from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    return NextResponse.json(taskBranch.developers)
  } catch (error) {
    console.error("GET /api/task-branches/[id]/developers error:", error)
    return NextResponse.json({ error: "获取需求分支开发者失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    const body = await request.json()
    const developerUserIds = Array.isArray(body.developerUserIds) ? body.developerUserIds.filter(Boolean) : []
    const now = new Date().toISOString()

    await db.delete(taskBranchDevelopers).where(eq(taskBranchDevelopers.taskBranchId, id))

    if (developerUserIds.length > 0) {
      await db.insert(taskBranchDevelopers).values(
        developerUserIds.map((userId: string) => ({
          id: crypto.randomUUID(),
          taskBranchId: id,
          userId,
          role: "developer",
          createdAt: now,
        }))
      )
    }

    await refreshServiceBranchStageSnapshots({ taskBranchId: id })

    const updated = await getTaskBranchPayload(id)
    return NextResponse.json(updated?.developers ?? [])
  } catch (error) {
    console.error("PUT /api/task-branches/[id]/developers error:", error)
    return NextResponse.json({ error: "保存需求分支开发者失败" }, { status: 500 })
  }
}
