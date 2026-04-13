import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { services } from "@/lib/schema"

function toClientService(s: typeof services.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    repository: s.repository,
    testBranch: s.testBranch,
    masterBranch: s.masterBranch,
    dependencies: JSON.parse(s.dependencies) as string[],
  }
}

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
    const { name, description = "", repository = "", testBranch = "develop", masterBranch = "main", dependencies = [] } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "服务名称不能为空" }, { status: 400 })
    }

    // Check unique name
    const existing = await db.select().from(services).where(eq(services.name, name.trim()))
    if (existing.length > 0) {
      return NextResponse.json({ error: "服务名称已存在" }, { status: 409 })
    }

    const id = crypto.randomUUID()
    await db.insert(services).values({
      id,
      name: name.trim(),
      description,
      repository,
      testBranch,
      masterBranch,
      dependencies: JSON.stringify(dependencies),
    })

    const created = await db.select().from(services).where(eq(services.id, id))
    return NextResponse.json(toClientService(created[0]), { status: 201 })
  } catch (error) {
    console.error("POST /api/services error:", error)
    return NextResponse.json({ error: "创建服务失败" }, { status: 500 })
  }
}
