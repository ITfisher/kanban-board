import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { tasks, serviceBranches, services } from "@/lib/schema"
import { requireBranchService } from "@/lib/service-branch-utils"
import { toClientTask } from "@/lib/task-data"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, id))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }
    const branches = await db.select().from(serviceBranches).where(eq(serviceBranches.taskId, id))
    return NextResponse.json(toClientTask(taskRows[0], branches))
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

    const { title, description, status, priority, assignee, jiraUrl, serviceBranches: incomingBranches } = body

    const updateData: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (assignee !== undefined) {
      updateData.assigneeName = assignee?.name ?? null
      updateData.assigneeAvatar = assignee?.avatar ?? null
    }
    if (jiraUrl !== undefined) updateData.jiraUrl = jiraUrl ?? null

    await db.update(tasks).set(updateData).where(eq(tasks.id, id))

    if (incomingBranches !== undefined) {
      const existingServices = (await db.select().from(services)).map((service) => ({
        id: service.id,
        name: service.name,
      }))

      await db.delete(serviceBranches).where(eq(serviceBranches.taskId, id))

      if (Array.isArray(incomingBranches) && incomingBranches.length > 0) {
        const now = new Date().toISOString()
        await db.insert(serviceBranches).values(
          incomingBranches.map((b: {
            id?: string
            serviceId?: string
            serviceName: string
            branchName: string
            pullRequestUrl?: string
            mergedToTest?: boolean
            mergedToMaster?: boolean
            testMergeDate?: string
            masterMergeDate?: string
            lastCommit?: string
            lastStatusCheck?: string
            prStatus?: unknown
            diffStatus?: unknown
            createdAt?: string
          }) => ({
            ...requireBranchService(existingServices, b),
            id: b.id ?? crypto.randomUUID(),
            taskId: id,
            branchName: b.branchName,
            pullRequestUrl: b.pullRequestUrl ?? null,
            mergedToTest: b.mergedToTest ? 1 : 0,
            mergedToMaster: b.mergedToMaster ? 1 : 0,
            testMergeDate: b.testMergeDate ?? null,
            masterMergeDate: b.masterMergeDate ?? null,
            lastCommit: b.lastCommit ?? null,
            lastStatusCheck: b.lastStatusCheck ?? null,
            prStatus: b.prStatus ? JSON.stringify(b.prStatus) : null,
            diffStatus: b.diffStatus ? JSON.stringify(b.diffStatus) : null,
            createdAt: b.createdAt ?? now,
          }))
        )
      }
    }

    const updated = await db.select().from(tasks).where(eq(tasks.id, id))
    const branches = await db.select().from(serviceBranches).where(eq(serviceBranches.taskId, id))
    return NextResponse.json(toClientTask(updated[0], branches))
  } catch (error) {
    console.error("PUT /api/tasks/[id] error:", error)
    return NextResponse.json({ error: "更新任务失败" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, id))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }
    // Branches cascade delete via FK
    await db.delete(tasks).where(eq(tasks.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error)
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 })
  }
}
