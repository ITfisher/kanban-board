import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getServicePayload } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { serviceStages, services, taskBranchServices } from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const service = await getServicePayload(id)

    if (!service) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error("GET /api/services/[id] error:", error)
    return NextResponse.json({ error: "获取服务失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(services).where(eq(services.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    const body = await request.json()
    const { repositoryId, name, description, rootPath, dependencies, isActive, stages } = body

    const updateData: Partial<typeof services.$inferInsert> = {}
    if (repositoryId !== undefined) updateData.repositoryId = repositoryId
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description
    if (rootPath !== undefined) updateData.rootPath = rootPath
    if (dependencies !== undefined) updateData.dependencies = JSON.stringify(dependencies)
    if (isActive !== undefined) updateData.isActive = isActive ? 1 : 0
    updateData.updatedAt = new Date().toISOString()

    await db.update(services).set(updateData).where(eq(services.id, id))

    if (Array.isArray(stages)) {
      await db.delete(serviceStages).where(eq(serviceStages.serviceId, id))

      if (stages.length > 0) {
        const now = new Date().toISOString()
        await db.insert(serviceStages).values(
          stages.map((stage, index) => ({
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
    }

    await refreshServiceBranchStageSnapshots({ serviceId: id })

    const updated = await getServicePayload(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/services/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新服务失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(services).where(eq(services.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }
    const linkedBranches = await db.select().from(taskBranchServices).where(eq(taskBranchServices.serviceId, id))
    if (linkedBranches.length > 0) {
      return NextResponse.json(
        { error: "该服务仍被任务分支引用，无法删除，请先移除相关分支" },
        { status: 409 }
      )
    }
    await db.delete(serviceStages).where(eq(serviceStages.serviceId, id))
    await db.delete(services).where(eq(services.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/services/[id] error:", error)
    return NextResponse.json({ error: "删除服务失败" }, { status: 500 })
  }
}
