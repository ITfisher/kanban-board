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
  serviceRepository?: string
}

// 从仓库URL解析域名
function extractDomainFromRepository(repository?: string): string | null {
  if (!repository) return null
  
  // 首先尝试作为完整URL解析
  if (repository.startsWith('http://') || repository.startsWith('https://')) {
    try {
      const url = new URL(repository)
      return url.hostname
    } catch {
      return null
    }
  }
  
  // 如果不是完整URL，尝试解析常见的Git URL格式
  // 例如: git@github.com:owner/repo.git 或 github.com/owner/repo
  const matches = repository.match(/(?:git@|https?:\/\/)?([^\/:]*)[:\/]/)
  return matches ? matches[1] : null
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePullRequestBody = await request.json()
    const { serviceName, title, head, base, body: prBody, githubConfigs = [], configId, serviceRepository } = body

    // 选择GitHub配置
    let selectedConfig: GitHubConfig | undefined

    if (configId) {
      // 显式指定配置ID
      selectedConfig = githubConfigs.find(config => config.id === configId)
    } else if (serviceRepository) {
      // 根据服务仓库域名自动匹配GitHub配置
      const repositoryDomain = extractDomainFromRepository(serviceRepository)
      if (repositoryDomain) {
        selectedConfig = githubConfigs.find(config => config.domain === repositoryDomain)
      }
    }

    if (!selectedConfig || !selectedConfig.token) {
      return NextResponse.json({ 
        error: githubConfigs.length === 0 
          ? "未找到GitHub配置，请先在设置页面添加GitHub配置。"
          : "指定的GitHub配置不存在或Token未设置，请检查配置。" 
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
