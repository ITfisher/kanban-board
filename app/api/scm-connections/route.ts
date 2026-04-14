import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { repositoryConnections, scmConnections } from "@/lib/schema"

function toPublicConnection(
  connection: typeof scmConnections.$inferSelect,
  repositoryIds: string[] = []
) {
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    domain: connection.domain,
    owner: connection.owner,
    isDefault: connection.isDefault === 1,
    repositoryIds,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }
}

export async function GET() {
  try {
    const [connections, mappings] = await Promise.all([
      db.select().from(scmConnections),
      db.select().from(repositoryConnections),
    ])

    return NextResponse.json(
      connections.map((connection) =>
        toPublicConnection(
          connection,
          mappings
            .filter((mapping) => mapping.scmConnectionId === connection.id)
            .map((mapping) => mapping.repositoryId)
        )
      )
    )
  } catch (error) {
    console.error("GET /api/scm-connections error:", error)
    return NextResponse.json({ error: "获取 SCM 连接失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const now = new Date().toISOString()
    const id = body.id || crypto.randomUUID()
    const repositoryIds = Array.isArray(body.repositoryIds)
      ? body.repositoryIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      : []

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "连接名称不能为空" }, { status: 400 })
    }

    if (!body.owner?.trim()) {
      return NextResponse.json({ error: "owner 不能为空" }, { status: 400 })
    }

    if (!body.token?.trim()) {
      return NextResponse.json({ error: "Token 不能为空" }, { status: 400 })
    }

    if (body.isDefault) {
      await db.update(scmConnections).set({ isDefault: 0 })
    }

    await db.insert(scmConnections).values({
      id,
      name: body.name.trim(),
      provider: body.provider ?? "github",
      domain: body.domain?.trim() || "github.com",
      owner: body.owner.trim(),
      token: body.token.trim(),
      isDefault: body.isDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })

    if (repositoryIds.length > 0) {
      await db.insert(repositoryConnections).values(
        repositoryIds.map((repositoryId: string) => ({
          id: crypto.randomUUID(),
          repositoryId,
          scmConnectionId: id,
          createdAt: now,
        }))
      )
    }

    const created = (await db.select().from(scmConnections)).find((connection) => connection.id === id)
    return NextResponse.json(toPublicConnection(created!, repositoryIds), { status: 201 })
  } catch (error) {
    console.error("POST /api/scm-connections error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建 SCM 连接失败" },
      { status: 500 }
    )
  }
}
