import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { taskAssignments, taskBranchDevelopers, tasks, users } from "@/lib/schema"

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : undefined
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(users).where(eq(users.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const body = await request.json()
    const name = normalizeOptionalString((body as Record<string, unknown>).name)
    if (name === null) {
      return NextResponse.json({ error: "用户名不能为空" }, { status: 400 })
    }

    const email = normalizeOptionalString((body as Record<string, unknown>).email)
    const avatarUrl = normalizeOptionalString((body as Record<string, unknown>).avatarUrl)

    const rows = await db.select().from(users)
    const duplicated = rows.find(
      (row) =>
        row.id !== id &&
        ((name && row.name.trim().toLowerCase() === name.toLowerCase()) ||
          (email && row.email?.trim().toLowerCase() === email.toLowerCase()))
    )
    if (duplicated) {
      return NextResponse.json({ error: "用户名或邮箱已存在" }, { status: 409 })
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    await db.update(users).set(updateData).where(eq(users.id, id))

    const latestUser = (await db.select().from(users).where(eq(users.id, id)))[0]
    await db
      .update(tasks)
      .set({
        assigneeName: latestUser.name,
        assigneeAvatar: latestUser.avatarUrl ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.ownerUserId, id))

    return NextResponse.json(latestUser)
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新用户失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(users).where(eq(users.id, id))
    const user = existing[0]
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const assignedTasks = await db.select().from(tasks).where(eq(tasks.ownerUserId, id))
    const affectedBranchDevelopers = await db.select().from(taskBranchDevelopers).where(eq(taskBranchDevelopers.userId, id))
    const affectedTaskBranchIds = [...new Set(affectedBranchDevelopers.map((row) => row.taskBranchId))]
    const now = new Date().toISOString()

    for (const task of assignedTasks) {
      await db
        .update(tasks)
        .set({
          ownerUserId: null,
          assigneeName: user.name,
          assigneeAvatar: user.avatarUrl ?? null,
          updatedAt: now,
        })
        .where(eq(tasks.id, task.id))
    }

    await db.delete(taskAssignments).where(eq(taskAssignments.userId, id))
    await db.delete(taskBranchDevelopers).where(eq(taskBranchDevelopers.userId, id))
    await db.delete(users).where(eq(users.id, id))

    if (affectedTaskBranchIds.length > 0) {
      await refreshServiceBranchStageSnapshots({ taskBranchIds: affectedTaskBranchIds })
    }

    return NextResponse.json({
      success: true,
      affectedTaskCount: assignedTasks.length,
      affectedTaskBranchCount: affectedTaskBranchIds.length,
    })
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error)
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 })
  }
}
