import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { services } from "@/lib/schema"
import { toClientService } from "@/lib/service-data"
import type { Service } from "@/lib/types"

export async function GET() {
  try {
    const all = await db.select().from(services).orderBy(services.name)
    return NextResponse.json(all.map(toClientService))
  } catch (error) {
    console.error("GET /api/services error:", error)
    return NextResponse.json({ error: "获取服务列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      const importedServices = body as Service[]
      const hasInvalidService = importedServices.some((service) => !service.name?.trim())

      if (hasInvalidService) {
        return NextResponse.json({ error: "导入数据中存在空服务名称" }, { status: 400 })
      }

      await db.delete(services)

      if (importedServices.length > 0) {
        await db.insert(services).values(
          importedServices.map((service) => ({
            id: service.id || crypto.randomUUID(),
            name: service.name.trim(),
            description: service.description ?? "",
            repository: service.repository ?? "",
            testBranch: service.testBranch ?? "develop",
            masterBranch: service.masterBranch ?? "main",
            dependencies: JSON.stringify(service.dependencies ?? []),
          }))
        )
      }

      const all = await db.select().from(services).orderBy(services.name)
      return NextResponse.json(all.map(toClientService), { status: 201 })
    }

    const {
      id,
      name,
      description = "",
      repository = "",
      testBranch = "develop",
      masterBranch = "main",
      dependencies = [],
    } = body as Service

    if (!name?.trim()) {
      return NextResponse.json({ error: "服务名称不能为空" }, { status: 400 })
    }

    // Check unique name
    const existing = await db.select().from(services).where(eq(services.name, name.trim()))
    if (existing.length > 0) {
      return NextResponse.json({ error: "服务名称已存在" }, { status: 409 })
    }

    const serviceId = id || crypto.randomUUID()
    await db.insert(services).values({
      id: serviceId,
      name: name.trim(),
      description,
      repository,
      testBranch,
      masterBranch,
      dependencies: JSON.stringify(dependencies),
    })

    const created = await db.select().from(services).where(eq(services.id, serviceId))
    return NextResponse.json(toClientService(created[0]), { status: 201 })
  } catch (error) {
    console.error("POST /api/services error:", error)
    return NextResponse.json({ error: "创建服务失败" }, { status: 500 })
  }
}
