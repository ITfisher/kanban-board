import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getTaskPayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { taskAssignments, tasks } from "@/lib/schema"
import { resolveTaskOwnerPersistence, syncTaskOwnerAssignment } from "@/lib/task-assignment-write"
import { getCompletedAtForTaskStatus, replaceTaskBranchesForTask } from "@/lib/task-branch-write"
import { normalizeTaskStatus } from "@/lib/task-status"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const task = await getTaskPayload(id)
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }
    return NextResponse.json(task)
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error)
    return NextResponse.json({ error: "获取任务失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const taskRows = await db.select().from(tasks).where(eq(tasks.id, id))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    const {
      title,
      description,
      status,
      priority,
      ownerUserId,
      assignee,
      jiraUrl,
      taskBranches: incomingTaskBranches,
    } = body

    const updateData: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description
    if (status !== undefined) {
      updateData.status = normalizeTaskStatus(status)
      updateData.completedAt = getCompletedAtForTaskStatus(normalizeTaskStatus(status), taskRows[0].completedAt)
    }
    if (priority !== undefined) updateData.priority = priority
    if (ownerUserId !== undefined || assignee !== undefined) {
      const ownerPersistence = await resolveTaskOwnerPersistence({
        ownerUserId: ownerUserId !== undefined ? ownerUserId : taskRows[0].ownerUserId,
        assignee,
      })
      updateData.ownerUserId = ownerPersistence.ownerUserId
      updateData.assigneeName = ownerPersistence.assigneeName
      updateData.assigneeAvatar = ownerPersistence.assigneeAvatar
      await syncTaskOwnerAssignment(id, ownerPersistence.ownerUserId)
    }
    if (jiraUrl !== undefined) updateData.jiraUrl = jiraUrl ?? null

    await db.update(tasks).set(updateData).where(eq(tasks.id, id))

    if (incomingTaskBranches !== undefined) {
      const savedTaskBranches = await replaceTaskBranchesForTask(id, {
        taskBranches: incomingTaskBranches,
      })
      await refreshServiceBranchStageSnapshots({
        taskBranchIds: savedTaskBranches.map((branch) => branch.id),
      })
    }

    const updated = await getTaskPayload(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/tasks/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新任务失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, id))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }
    await replaceTaskBranchesForTask(id, { taskBranches: [] })
    await db.delete(taskAssignments).where(eq(taskAssignments.taskId, id))
    await db.delete(tasks).where(eq(tasks.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error)
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 })
  }
}
