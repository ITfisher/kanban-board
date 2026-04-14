import { NextRequest, NextResponse } from "next/server"
import { getServiceStageBoard } from "@/lib/domain-data"
import { refreshServiceBranchStageSnapshots, runServicePipelineSync } from "@/lib/service-pipeline"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const shouldSync = request.nextUrl.searchParams.get("sync") === "1"

    if (shouldSync) {
      await runServicePipelineSync({
        serviceId: id,
        reason: "服务阶段看板手动同步",
      })
    } else {
      await refreshServiceBranchStageSnapshots({ serviceId: id })
    }

    const board = await getServiceStageBoard(id)

    if (!board) {
      return NextResponse.json({ error: "服务不存在" }, { status: 404 })
    }

    return NextResponse.json(board)
  } catch (error) {
    console.error("GET /api/services/[id]/stage-board error:", error)
    return NextResponse.json({ error: "获取服务阶段看板失败" }, { status: 500 })
  }
}
