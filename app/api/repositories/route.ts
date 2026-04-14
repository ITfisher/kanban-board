import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listRepositoryPayloads } from "@/lib/domain-data"
import { repositories } from "@/lib/schema"

export async function GET() {
  try {
    return NextResponse.json(await listRepositoryPayloads())
  } catch (error) {
    console.error("GET /api/repositories error:", error)
    return NextResponse.json({ error: "获取仓库列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const now = new Date().toISOString()
    const repositoryId = body.id || crypto.randomUUID()
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : typeof body.name === "string"
          ? body.name.trim()
          : ""

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "仓库名称不能为空" }, { status: 400 })
    }

    if (!body.owner?.trim()) {
      return NextResponse.json({ error: "仓库 owner 不能为空" }, { status: 400 })
    }

    await db.insert(repositories).values({
      id: repositoryId,
      name: body.name.trim(),
      provider: body.provider ?? "github",
      domain: body.domain ?? "github.com",
      owner: body.owner.trim(),
      slug,
      defaultBranch: body.defaultBranch ?? "main",
      description: body.description ?? "",
      createdAt: body.createdAt ?? now,
      updatedAt: body.updatedAt ?? now,
      archivedAt: body.archivedAt ?? null,
    })

    const created = await listRepositoryPayloads(repositoryId)
    return NextResponse.json(created[0], { status: 201 })
  } catch (error) {
    console.error("POST /api/repositories error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建仓库失败" },
      { status: 500 }
    )
  }
}
