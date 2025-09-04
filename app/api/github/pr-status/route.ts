import { type NextRequest, NextResponse } from "next/server"

interface GitHubConfig {
  id: string
  name: string
  domain: string
  owner: string
  token: string
  isDefault?: boolean
}

interface PRStatusRequest {
  serviceName: string
  pullRequestUrl: string
  githubConfigs?: GitHubConfig[]
  configId?: string
}

interface PRStatus {
  number: number
  state: 'open' | 'closed'
  merged: boolean
  mergeable: boolean | null
  mergeable_state: string
  merged_at: string | null
  base: {
    ref: string
  }
  head: {
    ref: string
    sha: string
  }
  html_url: string
  statuses_url: string
  checks?: {
    state: 'pending' | 'success' | 'failure' | 'error'
    conclusion: string | null
    total_count: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PRStatusRequest = await request.json()
    const { serviceName, pullRequestUrl, githubConfigs = [], configId } = body

    // 从PR URL中提取PR编号
    const prMatch = pullRequestUrl.match(/\/pull\/(\d+)/)
    if (!prMatch) {
      return NextResponse.json({ 
        error: "无效的Pull Request URL" 
      }, { status: 400 })
    }
    
    const prNumber = prMatch[1]

    // 选择GitHub配置
    let selectedConfig: GitHubConfig | undefined

    if (configId) {
      selectedConfig = githubConfigs.find(config => config.id === configId)
    } else {
      selectedConfig = githubConfigs.find(config => config.isDefault) || githubConfigs[0]
    }

    // 回退到环境变量
    if (!selectedConfig) {
      const envToken = process.env.GITHUB_TOKEN
      const envOwner = process.env.GITHUB_OWNER
      
      if (envToken && envOwner) {
        selectedConfig = {
          id: "env",
          name: "Environment",
          domain: "github.com",
          owner: envOwner,
          token: envToken,
          isDefault: true,
        }
      }
    }

    if (!selectedConfig || !selectedConfig.token) {
      return NextResponse.json({ 
        error: "GitHub配置未找到或Token未设置" 
      }, { status: 400 })
    }

    const repo = serviceName.toLowerCase().replace(/\s+/g, "-")
    const apiUrl = selectedConfig.domain === "github.com" 
      ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}/pulls/${prNumber}`
      : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}/pulls/${prNumber}`

    // 获取PR基本信息
    const prResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${selectedConfig.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kanban-Board-App/1.0.0",
      },
    })

    if (!prResponse.ok) {
      const error = await prResponse.json()
      return NextResponse.json({ 
        error: "获取PR状态失败",
        details: error
      }, { status: prResponse.status })
    }

    const prData: PRStatus = await prResponse.json()

    // 获取检查状态
    let checksData = null
    try {
      const checksUrl = selectedConfig.domain === "github.com" 
        ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}/commits/${prData.head.sha}/check-runs`
        : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}/commits/${prData.head.sha}/check-runs`

      const checksResponse = await fetch(checksUrl, {
        headers: {
          Authorization: `Bearer ${selectedConfig.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Kanban-Board-App/1.0.0",
        },
      })

      if (checksResponse.ok) {
        const checks = await checksResponse.json()
        const totalCount = checks.total_count || 0
        const completedCount = checks.check_runs?.filter((run: { status: string }) => 
          run.status === 'completed'
        ).length || 0
        
        const failedCount = checks.check_runs?.filter((run: { conclusion: string }) => 
          run.conclusion === 'failure' || run.conclusion === 'error'
        ).length || 0

        checksData = {
          total_count: totalCount,
          completed_count: completedCount,
          failed_count: failedCount,
          state: totalCount === 0 ? 'success' : 
                 completedCount < totalCount ? 'pending' :
                 failedCount > 0 ? 'failure' : 'success',
          conclusion: totalCount === 0 ? 'success' : 
                     completedCount < totalCount ? null :
                     failedCount > 0 ? 'failure' : 'success'
        }
      }
    } catch (checksError) {
      console.warn("Failed to fetch checks:", checksError)
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
      checks: checksData
    })
  } catch (error) {
    console.error("Error fetching PR status:", error)
    return NextResponse.json({ 
      error: "服务器内部错误",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}