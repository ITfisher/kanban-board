import { eq } from "drizzle-orm"
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(scmConnections).where(eq(scmConnections.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "SCM 连接不存在" }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Partial<typeof scmConnections.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.provider !== undefined) updateData.provider = body.provider
    if (body.domain !== undefined) updateData.domain = body.domain.trim()
    if (body.owner !== undefined) updateData.owner = body.owner.trim()
    if (body.token !== undefined) updateData.token = body.token.trim()
    if (body.isDefault !== undefined) {
      if (body.isDefault) {
        await db.update(scmConnections).set({ isDefault: 0 })
      }
      updateData.isDefault = body.isDefault ? 1 : 0
    }

    await db.update(scmConnections).set(updateData).where(eq(scmConnections.id, id))

    if (body.repositoryIds !== undefined) {
      const repositoryIds = Array.isArray(body.repositoryIds)
        ? body.repositoryIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
        : []

      await db.delete(repositoryConnections).where(eq(repositoryConnections.scmConnectionId, id))

      if (repositoryIds.length > 0) {
        await db.insert(repositoryConnections).values(
          repositoryIds.map((repositoryId: string) => ({
            id: crypto.randomUUID(),
            repositoryId,
            scmConnectionId: id,
            createdAt: new Date().toISOString(),
          }))
        )
      }
    }

    const [updated, mappings] = await Promise.all([
      db.select().from(scmConnections).where(eq(scmConnections.id, id)),
      db.select().from(repositoryConnections).where(eq(repositoryConnections.scmConnectionId, id)),
    ])

    return NextResponse.json(toPublicConnection(updated[0], mappings.map((mapping) => mapping.repositoryId)))
  } catch (error) {
    console.error("PUT /api/scm-connections/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新 SCM 连接失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(scmConnections).where(eq(scmConnections.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "SCM 连接不存在" }, { status: 404 })
    }

    await db.delete(repositoryConnections).where(eq(repositoryConnections.scmConnectionId, id))
    await db.delete(scmConnections).where(eq(scmConnections.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/scm-connections/[id] error:", error)
    return NextResponse.json({ error: "删除 SCM 连接失败" }, { status: 500 })
  }
}
