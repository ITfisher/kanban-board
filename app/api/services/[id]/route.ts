import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { serviceBranches, services } from "@/lib/schema"
import { toClientService } from "@/lib/service-data"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(services).where(eq(services.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, repository, testBranch, masterBranch, dependencies } = body

    const updateData: Partial<typeof services.$inferInsert> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description
    if (repository !== undefined) updateData.repository = repository
    if (testBranch !== undefined) updateData.testBranch = testBranch
    if (masterBranch !== undefined) updateData.masterBranch = masterBranch
    if (dependencies !== undefined) updateData.dependencies = JSON.stringify(dependencies)

    await db.update(services).set(updateData).where(eq(services.id, id))
    if (updateData.name !== undefined) {
      await db
        .update(serviceBranches)
        .set({ serviceName: updateData.name })
        .where(eq(serviceBranches.serviceId, id))
    }
    const updated = await db.select().from(services).where(eq(services.id, id))
    return NextResponse.json(toClientService(updated[0]))
  } catch (error) {
    console.error("PUT /api/services/[id] error:", error)
    return NextResponse.json({ error: "更新服务失败" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.select().from(services).where(eq(services.id, id))
    if (existing.length === 0) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }
    const linkedBranches = await db.select().from(serviceBranches).where(eq(serviceBranches.serviceId, id))
    if (linkedBranches.length > 0) {
      return NextResponse.json(
        { error: "该服务仍被任务分支引用，无法删除，请先移除相关分支" },
        { status: 409 }
      )
    }
    await db.delete(services).where(eq(services.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/services/[id] error:", error)
    return NextResponse.json({ error: "删除服务失败" }, { status: 500 })
  }
}
