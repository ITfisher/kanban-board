import { type NextRequest, NextResponse } from "next/server"
import { buildRepositoryApiUrl, getGitHubConnection, githubHeaders, resolveRepositoryTarget } from "@/lib/github-utils"

interface CreatePullRequestBody {
  repositoryId?: string
  repoDomain?: string
  repoOwner?: string
  repoName?: string
  title: string
  head: string
  base: string
  body?: string
  connectionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePullRequestBody = await request.json()
    const { title, head, base, body: prBody, connectionId } = body
    const target = await resolveRepositoryTarget(body)

    if (!target) {
      return NextResponse.json(
        { error: "缺少显式仓库信息，请传 repositoryId 或 repoDomain/repoOwner/repoName" },
        { status: 400 }
      )
    }

    const connection = await getGitHubConnection({
      connectionId,
      repositoryId: target.repositoryId,
      preferredDomain: target.domain,
    })
    if (!connection) {
      return NextResponse.json(
        { error: "未找到 SCM 连接，请先配置仓库对应的连接。" },
        { status: 400 }
      )
    }

    const apiUrl = `${buildRepositoryApiUrl(connection, target)}/pulls`

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { ...githubHeaders(connection.token), "Content-Type": "application/json" },
      body: JSON.stringify({ title, head, base, body: prBody }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const error = await response.json()
      let errorMessage = "创建Pull Request失败"
      if (response.status === 401) errorMessage = "GitHub访问令牌无效或已过期，请检查配置"
      else if (response.status === 404) errorMessage = `仓库 ${target.owner}/${target.repo} 不存在或无访问权限`
      else if (response.status === 422) errorMessage = error.message || "Pull Request参数错误"

      return NextResponse.json(
        { error: errorMessage, details: error, config: { owner: target.owner, repo: target.repo, domain: target.domain } },
        { status: response.status }
      )
    }

    const pullRequest = await response.json()
    return NextResponse.json({
      ...pullRequest,
      _connection: { name: connection.name, owner: target.owner, domain: target.domain, repo: target.repo },
    })
  } catch (error) {
    console.error("Error creating pull request:", error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
