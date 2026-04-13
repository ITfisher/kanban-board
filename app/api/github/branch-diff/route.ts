import { type NextRequest, NextResponse } from "next/server"
import { getGitHubConfig, buildRepoApiUrl, toRepoSlug, githubHeaders } from "@/lib/github-utils"

interface BranchDiffBody {
  serviceName: string
  baseBranch: string
  headBranch: string
  configId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BranchDiffBody = await request.json()
    const { serviceName, baseBranch, headBranch, configId } = body

    const config = await getGitHubConfig(configId)
    if (!config) {
      return NextResponse.json({ error: "GitHub配置未找到或Token未设置" }, { status: 400 })
    }

    const repo = toRepoSlug(serviceName)
    const apiUrl = `${buildRepoApiUrl(config, repo)}/compare/${baseBranch}...${headBranch}`

    const response = await fetch(apiUrl, {
      headers: githubHeaders(config.token),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const error = await response.json()
      let errorMessage = "获取分支差异失败"
      if (response.status === 401) errorMessage = "GitHub访问令牌无效或已过期"
      else if (response.status === 404) errorMessage = `仓库或分支不存在: ${config.owner}/${repo}`

      return NextResponse.json({ error: errorMessage, details: error }, { status: response.status })
    }

    const data = await response.json()

    return NextResponse.json({
      status: data.status,
      aheadBy: data.ahead_by,
      behindBy: data.behind_by,
      totalCommits: data.total_commits,
      commits: data.commits?.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
      })) ?? [],
      files: data.files?.map((f: { filename: string; status: string; additions: number; deletions: number; changes: number }) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
      })) ?? [],
      _config: { name: config.name, owner: config.owner, domain: config.domain, repo, baseBranch, headBranch },
    })
  } catch (error) {
    console.error("Error comparing branches:", error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
