import { asc } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/schema"

function normalizeUserInput(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("用户数据格式不正确")
  }

  const payload = body as Record<string, unknown>
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  const email = typeof payload.email === "string" ? payload.email.trim() : ""
  const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : ""
  const source = typeof payload.source === "string" && payload.source.trim() ? payload.source.trim() : "manual"

  if (!name) {
    throw new Error("用户名不能为空")
  }

  return {
    id: typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : crypto.randomUUID(),
    name,
    email: email || null,
    avatarUrl: avatarUrl || null,
    source,
  }
}

export async function GET() {
  try {
    const rows = await db.select().from(users).orderBy(asc(users.name))
    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email || undefined,
        avatarUrl: row.avatarUrl || undefined,
        source: row.source || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
    )
  } catch (error) {
    console.error("GET /api/users error:", error)
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = normalizeUserInput(await request.json())
    const existing = await db.select().from(users)
    const duplicated = existing.find(
      (row) =>
        row.name.trim().toLowerCase() === input.name.toLowerCase() ||
        (input.email && row.email?.trim().toLowerCase() === input.email.toLowerCase())
    )

    if (duplicated) {
      return NextResponse.json({ error: "用户名或邮箱已存在" }, { status: 409 })
    }

    const now = new Date().toISOString()
    await db.insert(users).values({
      id: input.id,
      name: input.name,
      email: input.email,
      avatarUrl: input.avatarUrl,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    })

    const created = await db.select().from(users).orderBy(asc(users.name))
    const row = created.find((item) => item.id === input.id)
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error("POST /api/users error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建用户失败" },
      { status: 400 }
    )
  }
}
