import { type NextRequest, NextResponse } from "next/server"
import { getGitHubConfig, buildRepoApiUrl, toRepoSlug, githubHeaders } from "@/lib/github-utils"

interface PRStatusRequest {
  serviceName: string
  pullRequestUrl: string
  configId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: PRStatusRequest = await request.json()
    const { serviceName, pullRequestUrl, configId } = body

    const prMatch = pullRequestUrl.match(/\/pull\/(\d+)/)
    if (!prMatch) {
      return NextResponse.json({ error: "无效的Pull Request URL" }, { status: 400 })
    }
    const prNumber = prMatch[1]

    const selectedConfig = await getGitHubConfig(configId)
    if (!selectedConfig) {
      return NextResponse.json({ error: "GitHub配置未找到或Token未设置" }, { status: 400 })
    }

    const repo = toRepoSlug(serviceName)
    const baseUrl = buildRepoApiUrl(selectedConfig, repo)
    const headers = githubHeaders(selectedConfig.token)

    const prResponse = await fetch(`${baseUrl}/pulls/${prNumber}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      return NextResponse.json({ error: "获取PR状态失败", details: error }, { status: prResponse.status })
    }

    const prData = await prResponse.json()

    // Fetch CI check runs
    let checksData = null
    try {
      const checksResponse = await fetch(`${baseUrl}/commits/${prData.head.sha}/check-runs`, {
        headers,
        signal: AbortSignal.timeout(10000),
      })

      if (checksResponse.ok) {
        const checks = await checksResponse.json()
        const totalCount = checks.total_count || 0
        const completedCount = checks.check_runs?.filter((r: { status: string }) => r.status === "completed").length || 0
        const failedCount = checks.check_runs?.filter((r: { conclusion: string }) =>
          r.conclusion === "failure" || r.conclusion === "error"
        ).length || 0

        checksData = {
          total_count: totalCount,
          completed_count: completedCount,
          failed_count: failedCount,
          state:
            totalCount === 0 ? "success" :
            completedCount < totalCount ? "pending" :
            failedCount > 0 ? "failure" : "success",
          conclusion:
            totalCount === 0 ? "success" :
            completedCount < totalCount ? null :
            failedCount > 0 ? "failure" : "success",
        }
      }
    } catch {
      // Check runs are optional — swallow the error
    }

    return NextResponse.json({
      number: prData.number,
      state: prData.state,
      merged: prData.merged,
      mergeable: prData.mergeable,
      mergeable_state: prData.mergeable_state,
      merged_at: prData.merged_at,
      base_ref: prData.base.ref,
      head_ref: prData.head.ref,
      head_sha: prData.head.sha,
      html_url: prData.html_url,
      checks: checksData,
    })
  } catch (error) {
    console.error("Error fetching PR status:", error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
