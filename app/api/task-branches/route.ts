import { NextRequest, NextResponse } from "next/server"
import { listTaskBranchPayloads } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots } from "@/lib/service-pipeline"
import { replaceTaskBranchesForTask } from "@/lib/task-branch-write"

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get("taskId") ?? undefined
    const serviceId = request.nextUrl.searchParams.get("serviceId") ?? undefined
    return NextResponse.json(await listTaskBranchPayloads({ taskId, serviceId }))
  } catch (error) {
    console.error("GET /api/task-branches error:", error)
    return NextResponse.json({ error: "获取需求分支失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const taskId = body.taskId

    if (typeof taskId !== "string" || !taskId.trim()) {
      return NextResponse.json({ error: "taskId 不能为空" }, { status: 400 })
    }

    const savedTaskBranches = await replaceTaskBranchesForTask(taskId, {
      taskBranches: Array.isArray(body.taskBranches) ? body.taskBranches : [body],
    })
    await refreshServiceBranchStageSnapshots({
      taskBranchIds: savedTaskBranches.map((branch) => branch.id),
    })

    const created = await listTaskBranchPayloads({ taskId })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("POST /api/task-branches error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建需求分支失败" },
      { status: 500 }
    )
  }
}
