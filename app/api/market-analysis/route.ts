import { NextResponse } from "next/server"
import { getMarketAnalysisPayload } from "@/lib/market-analysis"

export async function GET() {
  try {
    return NextResponse.json(await getMarketAnalysisPayload(), {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("GET /api/market-analysis error:", error)
    return NextResponse.json({ error: "获取行情分析数据失败" }, { status: 500 })
  }
}
