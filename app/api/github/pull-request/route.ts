import { type NextRequest, NextResponse } from "next/server"

interface GitHubConfig {
  id: string
  name: string
  domain: string
  owner: string
  token: string
  isDefault?: boolean
}

interface CreatePullRequestBody {
  serviceName: string
  title: string
  head: string
  base: string
  body?: string
  githubConfigs?: GitHubConfig[]
  configId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePullRequestBody = await request.json()
    const { serviceName, title, head, base, body: prBody, githubConfigs = [], configId } = body

    // 选择GitHub配置
    let selectedConfig: GitHubConfig | undefined

    if (configId) {
      selectedConfig = githubConfigs.find(config => config.id === configId)
    } else {
      selectedConfig = githubConfigs.find(config => config.isDefault) || githubConfigs[0]
    }

    // 回退到环境变量（向后兼容）
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
        error: "GitHub配置未找到或Token未设置。请在设置页面配置GitHub访问令牌。" 
      }, { status: 400 })
    }

    const repo = serviceName.toLowerCase().replace(/\s+/g, "-")
    const apiUrl = selectedConfig.domain === "github.com" 
      ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}/pulls`
      : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}/pulls`

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${selectedConfig.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Kanban-Board-App/1.0.0",
      },
      body: JSON.stringify({
        title,
        head,
        base,
        body: prBody,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("GitHub API Error:", error)
      
      let errorMessage = "创建Pull Request失败"
      
      if (response.status === 401) {
        errorMessage = "GitHub访问令牌无效或已过期，请检查配置"
      } else if (response.status === 404) {
        errorMessage = `仓库 ${selectedConfig.owner}/${repo} 不存在或无访问权限`
      } else if (response.status === 422) {
        errorMessage = error.message || "Pull Request参数错误"
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: error,
        config: {
          owner: selectedConfig.owner,
          repo,
          domain: selectedConfig.domain,
        }
      }, { status: response.status })
    }

    const pullRequest = await response.json()
    return NextResponse.json({
      ...pullRequest,
      _config: {
        name: selectedConfig.name,
        owner: selectedConfig.owner,
        domain: selectedConfig.domain,
      }
    })
  } catch (error) {
    console.error("Error creating pull request:", error)
    return NextResponse.json({ 
      error: "服务器内部错误",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}
