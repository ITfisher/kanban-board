import { type NextRequest, NextResponse } from "next/server"
import { buildRepositoryApiUrl, getGitHubConnection, githubHeaders, resolveRepositoryTarget } from "@/lib/github-utils"

interface CheckMergeStatusBody {
  repositoryId?: string
  repoDomain?: string
  repoOwner?: string
  repoName?: string
  pullRequestUrl?: string
  headBranch?: string
  baseBranches?: string[]
  connectionId?: string
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
    const { pullRequestUrl, headBranch, baseBranches, connectionId } = body
    const target = await resolveRepositoryTarget(body)

    if (!target) {
      return NextResponse.json(
        { error: "缺少显式仓库信息，请传 repositoryId 或 repoDomain/repoOwner/repoName" },
        { status: 400 }
      )
    }

    if (pullRequestUrl) {
      const prNumber = extractPRNumber(pullRequestUrl)
      if (!prNumber) {
        return NextResponse.json({ error: "无效的Pull Request URL格式" }, { status: 400 })
      }
      return checkSinglePR(target, prNumber, connectionId)
    }

    if (headBranch && baseBranches) {
      return checkBranchMergeStatus(target, headBranch, baseBranches, connectionId)
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

async function checkSinglePR(
  target: Awaited<ReturnType<typeof resolveRepositoryTarget>>,
  prNumber: string,
  connectionId?: string
) {
  if (!target) {
    return NextResponse.json({ error: "仓库不存在" }, { status: 404 })
  }

  const connection = await getGitHubConnection({
    connectionId,
    repositoryId: target.repositoryId,
    preferredDomain: target.domain,
  })
  if (!connection) return NextResponse.json({ error: "SCM 连接未找到或 Token 未设置" }, { status: 400 })

  const response = await fetch(`${buildRepositoryApiUrl(connection, target)}/pulls/${prNumber}`, {
    headers: githubHeaders(connection.token),
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
    _connection: { name: connection.name, owner: target.owner, domain: target.domain, repo: target.repo },
  })
}

async function checkBranchMergeStatus(
  target: Awaited<ReturnType<typeof resolveRepositoryTarget>>,
  headBranch: string,
  baseBranches: string[],
  connectionId?: string
) {
  if (!target) {
    return NextResponse.json({ error: "仓库不存在" }, { status: 404 })
  }

  const connection = await getGitHubConnection({
    connectionId,
    repositoryId: target.repositoryId,
    preferredDomain: target.domain,
  })
  if (!connection) return NextResponse.json({ error: "SCM 连接未找到或 Token 未设置" }, { status: 400 })

  const baseApiUrl = buildRepositoryApiUrl(connection, target)
  const headers = githubHeaders(connection.token)

  const branchStatuses = await Promise.all(
    baseBranches.map(async (baseBranch) => {
      try {
        const pullsUrl = `${baseApiUrl}/pulls?head=${connection.owner}:${headBranch}&base=${baseBranch}&state=all&sort=updated&direction=desc`
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
    repository: target,
    headBranch,
    branchStatuses,
    _connection: { name: connection.name, owner: target.owner, domain: target.domain, repo: target.repo },
  })
}
