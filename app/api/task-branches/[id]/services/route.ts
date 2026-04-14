import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getTaskBranchPayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { services, taskBranchServices } from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    return NextResponse.json(taskBranch.services)
  } catch (error) {
    console.error("GET /api/task-branches/[id]/services error:", error)
    return NextResponse.json({ error: "获取需求分支服务失败" }, { status: 500 })
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
    const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.filter(Boolean) : []
    const serviceRows = await db.select().from(services)

    for (const serviceId of serviceIds) {
      const service = serviceRows.find((row) => row.id === serviceId)
      if (!service) {
        return NextResponse.json({ error: "存在无效服务 ID" }, { status: 400 })
      }

      if (service.repositoryId !== taskBranch.repositoryId) {
        return NextResponse.json({ error: "服务与需求分支必须属于同一仓库" }, { status: 400 })
      }
    }

    await db.delete(taskBranchServices).where(eq(taskBranchServices.taskBranchId, id))

    if (serviceIds.length > 0) {
      const now = new Date().toISOString()
      await db.insert(taskBranchServices).values(
        serviceIds.map((serviceId: string) => ({
          id: crypto.randomUUID(),
          taskBranchId: id,
          serviceId,
          repositoryId: taskBranch.repositoryId,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }))
      )
    }

    await refreshServiceBranchStageSnapshots({ taskBranchId: id })

    const updated = await getTaskBranchPayload(id)
    return NextResponse.json(updated?.services ?? [])
  } catch (error) {
    console.error("PUT /api/task-branches/[id]/services error:", error)
    return NextResponse.json({ error: "保存需求分支服务失败" }, { status: 500 })
  }
}
