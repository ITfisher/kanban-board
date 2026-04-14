import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listServicePayloads } from "@/lib/domain-data"
import { validateServiceList } from "@/lib/import-export"
import { serviceStages, services } from "@/lib/schema"
import type { Service } from "@/lib/types"

export async function GET() {
  try {
    return NextResponse.json(await listServicePayloads())
  } catch (error) {
    console.error("GET /api/services error:", error)
    return NextResponse.json({ error: "获取服务列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      const importedServices = validateServiceList(body)

      await db.delete(serviceStages)
      await db.delete(services)

      if (importedServices.length > 0) {
        const now = new Date().toISOString()
        const normalizedServices = importedServices.map((service) => ({
          source: service,
          id: service.id || crypto.randomUUID(),
        }))
        await db.insert(services).values(
          normalizedServices.map(({ source, id }) => ({
            id,
            repositoryId: source.repositoryId ?? "",
            name: source.name.trim(),
            description: source.description ?? "",
            rootPath: source.rootPath ?? "",
            dependencies: JSON.stringify(source.dependencies ?? []),
            isActive: source.isActive === false ? 0 : 1,
            createdAt: source.createdAt ?? now,
            updatedAt: source.updatedAt ?? now,
          }))
        )

        const stageRows = normalizedServices.flatMap(({ source, id }) =>
          (source.stages ?? []).map((stage, index) => ({
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
        ).filter((stage) => stage.serviceId)

        if (stageRows.length > 0) {
          await db.insert(serviceStages).values(stageRows)
        }
      }

      return NextResponse.json(await listServicePayloads(), { status: 201 })
    }

    const {
      id,
      repositoryId,
      name,
      description = "",
      rootPath = "",
      dependencies = [],
      isActive = true,
      stages = [],
    } = body as Service

    if (!name?.trim()) {
      return NextResponse.json({ error: "服务名称不能为空" }, { status: 400 })
    }

    if (!repositoryId?.trim()) {
      return NextResponse.json({ error: "repositoryId 不能为空" }, { status: 400 })
    }

    const existing = (await db.select().from(services)).filter(
      (service) => service.repositoryId === repositoryId.trim() && service.name === name.trim()
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: "同一仓库下服务名称已存在" }, { status: 409 })
    }

    const serviceId = id || crypto.randomUUID()
    const now = new Date().toISOString()
    await db.insert(services).values({
      id: serviceId,
      repositoryId: repositoryId.trim(),
      name: name.trim(),
      description,
      rootPath,
      dependencies: JSON.stringify(dependencies),
      isActive: isActive ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })

    if (Array.isArray(stages) && stages.length > 0) {
      const now = new Date().toISOString()
      await db.insert(serviceStages).values(
        stages.map((stage, index) => ({
          id: stage.id || crypto.randomUUID(),
          serviceId,
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

    const created = await listServicePayloads(serviceId)
    return NextResponse.json(created[0], { status: 201 })
  } catch (error) {
    console.error("POST /api/services error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建服务失败" },
      { status: 500 }
    )
  }
}
