import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getServicePayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { serviceStages } from "@/lib/schema"
import type { ServiceStage } from "@/lib/types"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const service = await getServicePayload(id)

    if (!service) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    return NextResponse.json(service.stages)
  } catch (error) {
    console.error("GET /api/services/[id]/stages error:", error)
    return NextResponse.json({ error: "获取服务阶段失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const service = await getServicePayload(id)

    if (!service) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    const body = await request.json()
    const stages = Array.isArray(body.stages) ? body.stages : []
    const now = new Date().toISOString()

    await db.delete(serviceStages).where(eq(serviceStages.serviceId, id))

    if (stages.length > 0) {
      await db.insert(serviceStages).values(
        stages.map((stage: Partial<ServiceStage>, index: number) => ({
          id: stage.id || crypto.randomUUID(),
          serviceId: id,
          name: stage.name,
          key: stage.key,
          description: stage.description ?? "",
          position: stage.position ?? index,
          targetBranch: stage.targetBranch,
          isActive: stage.isActive === false ? 0 : 1,
          createdAt: stage.createdAt ?? now,
          updatedAt: stage.updatedAt ?? now,
        }))
      )
    }

    await refreshServiceBranchStageSnapshots({ serviceId: id })

    const updated = await getServicePayload(id)
    return NextResponse.json(updated?.stages ?? [])
  } catch (error) {
    console.error("PUT /api/services/[id]/stages error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存服务阶段失败" },
      { status: 500 }
    )
  }
}
