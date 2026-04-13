import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { githubConfigs } from "@/lib/schema"

function toPublicConfig(c: typeof githubConfigs.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    owner: c.owner,
    isDefault: c.isDefault === 1,
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(githubConfigs).where(eq(githubConfigs.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 })
    }

    const body = await request.json()
    const { name, domain, owner, token, isDefault } = body

    const updateData: Partial<typeof githubConfigs.$inferInsert> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (domain !== undefined) updateData.domain = domain.trim()
    if (owner !== undefined) updateData.owner = owner.trim()
    if (token !== undefined && token.trim()) updateData.token = token.trim()
    if (isDefault !== undefined) {
      if (isDefault) {
        // Clear other defaults first
        await db.update(githubConfigs).set({ isDefault: 0 })
      }
      updateData.isDefault = isDefault ? 1 : 0
    }

    await db.update(githubConfigs).set(updateData).where(eq(githubConfigs.id, id))
    const updated = await db.select().from(githubConfigs).where(eq(githubConfigs.id, id))
    return NextResponse.json(toPublicConfig(updated[0]))
  } catch (error) {
    console.error("PUT /api/github/configs/[id] error:", error)
    return NextResponse.json({ error: "更新配置失败" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(githubConfigs).where(eq(githubConfigs.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 })
    }
    await db.delete(githubConfigs).where(eq(githubConfigs.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/github/configs/[id] error:", error)
    return NextResponse.json({ error: "删除配置失败" }, { status: 500 })
  }
}
