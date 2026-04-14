import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serviceBranches, services, tasks } from "@/lib/schema"
import { requireBranchService } from "@/lib/service-branch-utils"
import { toClientServiceBranch } from "@/lib/task-data"

type BranchInput = {
  id?: string
  serviceId?: string
  serviceName?: string
  branchName: string
  pullRequestUrl?: string
  testPullRequestUrl?: string
  masterPullRequestUrl?: string
  createdAt?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params
    const body = await request.json()
    const incomingBranches = body.serviceBranches

    if (!Array.isArray(incomingBranches)) {
      return NextResponse.json({ error: "serviceBranches 必须是数组" }, { status: 400 })
    }

    const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    const existingServices = (await db.select().from(services)).map((service) => ({
      id: service.id,
      name: service.name,
    }))
    const existingBranches = await db.select().from(serviceBranches).where(eq(serviceBranches.taskId, taskId))
    const existingBranchMap = new Map(existingBranches.map((branch) => [branch.id, branch]))

    await db.delete(serviceBranches).where(eq(serviceBranches.taskId, taskId))

    if (incomingBranches.length > 0) {
      const now = new Date().toISOString()

      await db.insert(serviceBranches).values(
        incomingBranches.map((branch: BranchInput) => {
          const normalizedService = requireBranchService(existingServices, {
            serviceId: branch.serviceId,
          })
          const existingBranch = branch.id ? existingBranchMap.get(branch.id) : undefined

          return {
            id: branch.id ?? crypto.randomUUID(),
            taskId,
            serviceId: normalizedService.serviceId,
            serviceName: normalizedService.serviceName,
            branchName: branch.branchName.trim(),
            pullRequestUrl:
              branch.pullRequestUrl !== undefined
                ? branch.pullRequestUrl ?? null
                : existingBranch?.pullRequestUrl ?? null,
            testPullRequestUrl:
              branch.testPullRequestUrl !== undefined
                ? branch.testPullRequestUrl ?? null
                : existingBranch?.testPullRequestUrl ?? null,
            masterPullRequestUrl:
              branch.masterPullRequestUrl !== undefined
                ? branch.masterPullRequestUrl ?? null
                : existingBranch?.masterPullRequestUrl ?? null,
            mergedToTest: existingBranch?.mergedToTest ?? 0,
            mergedToMaster: existingBranch?.mergedToMaster ?? 0,
            testMergeDate: existingBranch?.testMergeDate ?? null,
            masterMergeDate: existingBranch?.masterMergeDate ?? null,
            lastCommit: existingBranch?.lastCommit ?? null,
            lastStatusCheck: existingBranch?.lastStatusCheck ?? null,
            prStatus: existingBranch?.prStatus ?? null,
            diffStatus: existingBranch?.diffStatus ?? null,
            createdAt: existingBranch?.createdAt ?? branch.createdAt ?? now,
          }
        })
      )
    }

    const updatedBranches = await db.select().from(serviceBranches).where(eq(serviceBranches.taskId, taskId))
    return NextResponse.json(updatedBranches.map(toClientServiceBranch))
  } catch (error) {
    console.error("PUT /api/tasks/[id]/branches error:", error)
    return NextResponse.json({ error: "保存任务分支失败" }, { status: 500 })
  }
}
