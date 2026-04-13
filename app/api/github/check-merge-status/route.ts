import { type NextRequest, NextResponse } from "next/server"
import { getGitHubConfig, buildRepoApiUrl, toRepoSlug, githubHeaders } from "@/lib/github-utils"

interface CheckMergeStatusBody {
  serviceName: string
  pullRequestUrl?: string
  headBranch?: string
  baseBranches?: string[]
  configId?: string
}

interface PullRequestListItem {
  number: number
  title: string
  state: string
  merged_at: string | null
  created_at: string
  updated_at: string
  html_url: string
  mergeable: boolean | null
  mergeable_state: string
  user: { login: string }
}

interface CompareBranchResponse {
  status: string
  ahead_by: number
  behind_by: number
  total_commits: number
  commits?: { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }[]
}

function extractPRNumber(url: string): string | null {
  const match = url.match(/\/pull\/(\d+)/)
  return match ? match[1] : null
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckMergeStatusBody = await request.json()
    const { serviceName, pullRequestUrl, headBranch, baseBranches, configId } = body

    if (pullRequestUrl) {
      const prNumber = extractPRNumber(pullRequestUrl)
      if (!prNumber) {
        return NextResponse.json({ error: "无效的Pull Request URL格式" }, { status: 400 })
      }
      return checkSinglePR(serviceName, prNumber, configId)
    }

    if (headBranch && baseBranches) {
      return checkBranchMergeStatus(serviceName, headBranch, baseBranches, configId)
    }

    return NextResponse.json({ error: "请提供pullRequestUrl或headBranch+baseBranches参数" }, { status: 400 })
  } catch (error) {
    console.error("check-merge-status error:", error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}

async function checkSinglePR(serviceName: string, prNumber: string, configId?: string) {
  const config = await getGitHubConfig(configId)
  if (!config) return NextResponse.json({ error: "GitHub配置未找到或Token未设置" }, { status: 400 })

  const repo = toRepoSlug(serviceName)
  const response = await fetch(`${buildRepoApiUrl(config, repo)}/pulls/${prNumber}`, {
    headers: githubHeaders(config.token),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    const error = await response.json()
    let errorMessage = "检查Pull Request状态失败"
    if (response.status === 401) errorMessage = "GitHub访问令牌无效或已过期"
    else if (response.status === 404) errorMessage = `Pull Request #${prNumber} 不存在或无访问权限`
    return NextResponse.json({ error: errorMessage, details: error }, { status: response.status })
  }

  const pr = await response.json()
  return NextResponse.json({
    prNumber: parseInt(prNumber),
    isMerged: pr.merged,
    mergedAt: pr.merged_at,
    state: pr.state,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    title: pr.title,
    url: pr.html_url,
    _config: { name: config.name, owner: config.owner, domain: config.domain },
  })
}

async function checkBranchMergeStatus(
  serviceName: string,
  headBranch: string,
  baseBranches: string[],
  configId?: string
) {
  const config = await getGitHubConfig(configId)
  if (!config) return NextResponse.json({ error: "GitHub配置未找到或Token未设置" }, { status: 400 })

  const repo = toRepoSlug(serviceName)
  const baseApiUrl = buildRepoApiUrl(config, repo)
  const headers = githubHeaders(config.token)

  const branchStatuses = await Promise.all(
    baseBranches.map(async (baseBranch) => {
      try {
        const pullsUrl = `${baseApiUrl}/pulls?head=${config.owner}:${headBranch}&base=${baseBranch}&state=all&sort=updated&direction=desc`
        const pullsResponse = await fetch(pullsUrl, { headers, signal: AbortSignal.timeout(10000) })

        if (!pullsResponse.ok) throw new Error(`获取PR列表失败: ${pullsResponse.status}`)
        const pulls: PullRequestListItem[] = await pullsResponse.json()
        const latestPR = pulls[0] ?? null

        let diffStatus = null
        let isMerged = false

        try {
          const compareResponse = await fetch(`${baseApiUrl}/compare/${baseBranch}...${headBranch}`, {
            headers,
            signal: AbortSignal.timeout(10000),
          })
          if (compareResponse.ok) {
            const data: CompareBranchResponse = await compareResponse.json()
            isMerged = data.behind_by === 0 && data.ahead_by === 0
            diffStatus = {
              status: data.status,
              aheadBy: data.ahead_by,
              behindBy: data.behind_by,
              totalCommits: data.total_commits,
              commits: data.commits?.slice(0, 5).map((c) => ({
                sha: c.sha.substring(0, 7),
                message: c.commit.message.split("\n")[0],
                author: c.commit.author.name,
                date: c.commit.author.date,
                url: c.html_url,
              })) ?? [],
            }
          }
        } catch {
          // diff is optional
        }

        return {
          baseBranch,
          isMerged,
          diffStatus,
          pullRequest: latestPR
            ? {
                number: latestPR.number,
                title: latestPR.title,
                state: latestPR.state,
                merged: latestPR.merged_at !== null,
                mergedAt: latestPR.merged_at,
                createdAt: latestPR.created_at,
                updatedAt: latestPR.updated_at,
                url: latestPR.html_url,
                author: latestPR.user.login,
                mergeable: latestPR.mergeable,
                mergeableState: latestPR.mergeable_state,
              }
            : null,
        }
      } catch (error) {
        return {
          baseBranch,
          isMerged: false,
          diffStatus: null,
          pullRequest: null,
          error: error instanceof Error ? error.message : "未知错误",
        }
      }
    })
  )

  return NextResponse.json({
    serviceName,
    headBranch,
    branchStatuses,
    _config: { name: config.name, owner: config.owner, domain: config.domain, repo },
  })
}
