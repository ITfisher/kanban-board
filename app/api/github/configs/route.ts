import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { githubConfigs } from "@/lib/schema"

// Never return token to client
function toPublicConfig(c: typeof githubConfigs.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    owner: c.owner,
    isDefault: c.isDefault === 1,
  }
}

export async function GET() {
  try {
    const configs = await db.select().from(githubConfigs)
    return NextResponse.json(configs.map(toPublicConfig))
  } catch (error) {
    console.error("GET /api/github/configs error:", error)
    return NextResponse.json({ error: "获取配置列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, domain, owner, token, isDefault = false } = body

    if (!name?.trim() || !domain?.trim() || !owner?.trim() || !token?.trim()) {
      return NextResponse.json({ error: "name、domain、owner、token 均为必填项" }, { status: 400 })
    }

    const id = crypto.randomUUID()

    // If this will be default, clear existing defaults first
    if (isDefault) {
      await db.update(githubConfigs).set({ isDefault: 0 })
    }

    await db.insert(githubConfigs).values({
      id,
      name: name.trim(),
      domain: domain.trim(),
      owner: owner.trim(),
      token: token.trim(),
      isDefault: isDefault ? 1 : 0,
    })

    const created = await db.select().from(githubConfigs).where(eq(githubConfigs.id, id))
    return NextResponse.json(toPublicConfig(created[0]), { status: 201 })
  } catch (error) {
    console.error("POST /api/github/configs error:", error)
    return NextResponse.json({ error: "创建配置失败" }, { status: 500 })
  }
}
