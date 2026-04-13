import { type NextRequest, NextResponse } from "next/server"
import { getGitHubConfig, buildRepoApiUrl, toRepoSlug, githubHeaders, extractDomainFromRepository } from "@/lib/github-utils"
import { db } from "@/lib/db"
import { githubConfigs } from "@/lib/schema"

interface CreatePullRequestBody {
  serviceName: string
  title: string
  head: string
  base: string
  body?: string
  configId?: string
  serviceRepository?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePullRequestBody = await request.json()
    const { serviceName, title, head, base, body: prBody, configId, serviceRepository } = body

    let selectedConfig = await getGitHubConfig(configId)

    // If no configId, try to auto-match by service repository domain
    if (!selectedConfig && serviceRepository) {
      const repoDomain = extractDomainFromRepository(serviceRepository)
      if (repoDomain) {
        const all = await db.select().from(githubConfigs)
        const matched = all.find((c) => c.domain === repoDomain)
        if (matched) {
          selectedConfig = {
            id: matched.id,
            name: matched.name,
            domain: matched.domain,
            owner: matched.owner,
            token: matched.token,
            isDefault: matched.isDefault === 1,
          }
        }
      }
    }

    if (!selectedConfig) {
      return NextResponse.json(
        { error: "未找到GitHub配置，请先在设置页面添加GitHub配置。" },
        { status: 400 }
      )
    }

    const repo = toRepoSlug(serviceName)
    const apiUrl = `${buildRepoApiUrl(selectedConfig, repo)}/pulls`

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { ...githubHeaders(selectedConfig.token), "Content-Type": "application/json" },
      body: JSON.stringify({ title, head, base, body: prBody }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const error = await response.json()
      let errorMessage = "创建Pull Request失败"
      if (response.status === 401) errorMessage = "GitHub访问令牌无效或已过期，请检查配置"
      else if (response.status === 404) errorMessage = `仓库 ${selectedConfig.owner}/${repo} 不存在或无访问权限`
      else if (response.status === 422) errorMessage = error.message || "Pull Request参数错误"

      return NextResponse.json(
        { error: errorMessage, details: error, config: { owner: selectedConfig.owner, repo, domain: selectedConfig.domain } },
        { status: response.status }
      )
    }

    const pullRequest = await response.json()
    return NextResponse.json({
      ...pullRequest,
      _config: { name: selectedConfig.name, owner: selectedConfig.owner, domain: selectedConfig.domain },
    })
  } catch (error) {
    console.error("Error creating pull request:", error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
