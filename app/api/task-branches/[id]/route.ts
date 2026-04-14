import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getTaskBranchPayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import {
  events,
  mergeOperations,
  pullRequests,
  serviceBranchStageSnapshots,
  syncRuns,
  taskBranchDevelopers,
  taskBranchServices,
  taskBranches,
} from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    return NextResponse.json(taskBranch)
  } catch (error) {
    console.error("GET /api/task-branches/[id] error:", error)
    return NextResponse.json({ error: "获取需求分支失败" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await getTaskBranchPayload(id)

    if (!existing) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    const body = await request.json()
    const nextRepositoryId = body.repositoryId ?? existing.repositoryId

    if (nextRepositoryId !== existing.repositoryId) {
      const crossRepositoryServices = existing.services.filter((service) => service.repositoryId !== nextRepositoryId)

      if (crossRepositoryServices.length > 0) {
        return NextResponse.json(
          {
            error: `无法修改仓库归属，当前需求分支仍关联了其他仓库的服务：${crossRepositoryServices
              .map((service) => service.name)
              .join("、")}`,
          },
          { status: 400 }
        )
      }
    }

    await db
      .update(taskBranches)
      .set({
        repositoryId: nextRepositoryId,
        name: body.name?.trim() ?? body.branchName?.trim() ?? existing.name,
        title: body.title ?? existing.title ?? "",
        description: body.description ?? existing.description ?? "",
        status: body.status ?? existing.status,
        createdByUserId: body.createdByUserId ?? existing.createdByUserId ?? null,
        updatedAt: new Date().toISOString(),
        closedAt: body.closedAt ?? existing.closedAt ?? null,
        lastSyncedAt: body.lastSyncedAt ?? existing.lastSyncedAt ?? null,
      })
      .where(eq(taskBranches.id, id))

    await refreshServiceBranchStageSnapshots({ taskBranchId: id })

    const updated = await getTaskBranchPayload(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/task-branches/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新需求分支失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(taskBranchServices).where(eq(taskBranchServices.taskBranchId, id))
    await db.delete(taskBranchDevelopers).where(eq(taskBranchDevelopers.taskBranchId, id))
    await db.delete(pullRequests).where(eq(pullRequests.taskBranchId, id))
    await db.delete(events).where(eq(events.taskBranchId, id))
    await db.delete(mergeOperations).where(eq(mergeOperations.taskBranchId, id))
    await db.delete(syncRuns).where(eq(syncRuns.taskBranchId, id))
    await db.delete(serviceBranchStageSnapshots).where(eq(serviceBranchStageSnapshots.taskBranchId, id))
    await db.delete(taskBranches).where(eq(taskBranches.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/task-branches/[id] error:", error)
    return NextResponse.json({ error: "删除需求分支失败" }, { status: 500 })
  }
}
