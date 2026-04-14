import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { getRepositoryPayload } from "@/lib/domain-data"
import { repositories, services, taskBranches } from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const repository = await getRepositoryPayload(id)

    if (!repository) {
      return NextResponse.json({ error: "仓库不存在" }, { status: 404 })
    }

    return NextResponse.json(repository)
  } catch (error) {
    console.error("GET /api/repositories/[id] error:", error)
    return NextResponse.json({ error: "获取仓库失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await getRepositoryPayload(id)

    if (!existing) {
      return NextResponse.json({ error: "仓库不存在" }, { status: 404 })
    }

    const body = await request.json()
    await db
      .update(repositories)
      .set({
        name: body.name?.trim() ?? existing.name,
        provider: body.provider ?? existing.provider,
        domain: body.domain ?? existing.domain,
        owner: body.owner?.trim() ?? existing.owner,
        slug: body.slug?.trim() ?? existing.slug,
        defaultBranch: body.defaultBranch ?? existing.defaultBranch,
        description: body.description ?? existing.description ?? "",
        archivedAt: body.archivedAt ?? existing.archivedAt ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(repositories.id, id))

    const updated = await getRepositoryPayload(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/repositories/[id] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新仓库失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const linkedServices = await db.select().from(services).where(eq(services.repositoryId, id))
    const linkedBranches = await db.select().from(taskBranches).where(eq(taskBranches.repositoryId, id))

    if (linkedServices.length > 0 || linkedBranches.length > 0) {
      return NextResponse.json(
        { error: "仓库仍被服务或需求分支引用，无法删除" },
        { status: 409 }
      )
    }

    await db.delete(repositories).where(eq(repositories.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/repositories/[id] error:", error)
    return NextResponse.json({ error: "删除仓库失败" }, { status: 500 })
  }
}
