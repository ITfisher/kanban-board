import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getTaskBranchPayload } from "@/lib/domain-data"
import { recordPullRequestCreated, refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { pullRequests } from "@/lib/schema"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    return NextResponse.json(taskBranch.pullRequests)
  } catch (error) {
    console.error("GET /api/task-branches/[id]/pull-requests error:", error)
    return NextResponse.json({ error: "获取需求分支 PR 失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const taskBranch = await getTaskBranchPayload(id)

    if (!taskBranch) {
      return NextResponse.json({ error: "需求分支不存在" }, { status: 404 })
    }

    const body = await request.json()
    const now = new Date().toISOString()
    const pullRequestId = body.id || crypto.randomUUID()

    await db.insert(pullRequests).values({
      id: pullRequestId,
      repositoryId: body.repositoryId ?? taskBranch.repositoryId,
      taskBranchId: id,
      serviceId: body.serviceId,
      serviceStageId: body.serviceStageId,
      provider: body.provider ?? "github",
      providerDomain: body.providerDomain ?? taskBranch.repository?.domain ?? "github.com",
      externalNumber: body.externalNumber ?? null,
      title: body.title ?? "",
      htmlUrl: body.htmlUrl ?? null,
      sourceBranch: body.sourceBranch ?? taskBranch.name,
      targetBranch: body.targetBranch,
      state: body.state ?? "open",
      merged: body.merged ? 1 : 0,
      mergeable: body.mergeable === null || body.mergeable === undefined ? null : body.mergeable ? 1 : 0,
      mergeableState: body.mergeableState ?? null,
      headSha: body.headSha ?? null,
      baseSha: body.baseSha ?? null,
      draft: body.draft ? 1 : 0,
      authorUserId: body.authorUserId ?? null,
      rawPayload: body.rawPayload ? JSON.stringify(body.rawPayload) : null,
      createdAt: body.createdAt ?? now,
      updatedAt: body.updatedAt ?? now,
      closedAt: body.closedAt ?? null,
      mergedAt: body.mergedAt ?? null,
      lastSyncedAt: body.lastSyncedAt ?? null,
    })

    await recordPullRequestCreated({
      repositoryId: body.repositoryId ?? taskBranch.repositoryId,
      taskId: taskBranch.taskId,
      taskBranchId: id,
      serviceId: body.serviceId,
      serviceStageId: body.serviceStageId,
      pullRequestId,
      title: body.title,
      targetBranch: body.targetBranch,
    })
    await refreshServiceBranchStageSnapshots({ taskBranchId: id })

    const updated = await getTaskBranchPayload(id)
    return NextResponse.json(updated?.pullRequests ?? [], { status: 201 })
  } catch (error) {
    console.error("POST /api/task-branches/[id]/pull-requests error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建需求分支 PR 失败" },
      { status: 500 }
    )
  }
}
