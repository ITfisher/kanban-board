import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serviceBranches } from "@/lib/schema"
import { toClientServiceBranch } from "@/lib/task-data"

function hasOwnProperty<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const { id: taskId, branchId } = await params
    const body = await request.json()

    const existing = await db
      .select()
      .from(serviceBranches)
      .where(and(eq(serviceBranches.taskId, taskId), eq(serviceBranches.id, branchId)))

    if (existing.length === 0) {
      return NextResponse.json({ error: "服务分支不存在" }, { status: 404 })
    }

    const updateData: Partial<typeof serviceBranches.$inferInsert> = {}

    if (hasOwnProperty(body, "serviceName")) {
      if (typeof body.serviceName !== "string" || !body.serviceName.trim()) {
        return NextResponse.json({ error: "服务名称不能为空" }, { status: 400 })
      }
      updateData.serviceName = body.serviceName.trim()
    }

    if (hasOwnProperty(body, "branchName")) {
      if (typeof body.branchName !== "string" || !body.branchName.trim()) {
        return NextResponse.json({ error: "分支名称不能为空" }, { status: 400 })
      }
      updateData.branchName = body.branchName.trim()
    }

    if (hasOwnProperty(body, "pullRequestUrl")) {
      updateData.pullRequestUrl = body.pullRequestUrl ?? null
    }

    if (hasOwnProperty(body, "mergedToTest")) {
      updateData.mergedToTest = body.mergedToTest ? 1 : 0
    }

    if (hasOwnProperty(body, "mergedToMaster")) {
      updateData.mergedToMaster = body.mergedToMaster ? 1 : 0
    }

    if (hasOwnProperty(body, "testMergeDate")) {
      updateData.testMergeDate = body.testMergeDate ?? null
    }

    if (hasOwnProperty(body, "masterMergeDate")) {
      updateData.masterMergeDate = body.masterMergeDate ?? null
    }

    if (hasOwnProperty(body, "lastCommit")) {
      updateData.lastCommit = body.lastCommit ?? null
    }

    if (hasOwnProperty(body, "lastStatusCheck")) {
      updateData.lastStatusCheck = body.lastStatusCheck ?? null
    }

    if (hasOwnProperty(body, "prStatus")) {
      updateData.prStatus = body.prStatus ? JSON.stringify(body.prStatus) : null
    }

    if (hasOwnProperty(body, "diffStatus")) {
      updateData.diffStatus = body.diffStatus ? JSON.stringify(body.diffStatus) : null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 })
    }

    await db
      .update(serviceBranches)
      .set(updateData)
      .where(and(eq(serviceBranches.taskId, taskId), eq(serviceBranches.id, branchId)))

    const updated = await db
      .select()
      .from(serviceBranches)
      .where(and(eq(serviceBranches.taskId, taskId), eq(serviceBranches.id, branchId)))

    return NextResponse.json(toClientServiceBranch(updated[0]))
  } catch (error) {
    console.error("PATCH /api/tasks/[id]/branches/[branchId] error:", error)
    return NextResponse.json({ error: "更新服务分支失败" }, { status: 500 })
  }
}
