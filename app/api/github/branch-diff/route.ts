import { type NextRequest, NextResponse } from "next/server"

interface GitHubConfig {
  id: string
  name: string
  domain: string
  owner: string
  token: string
  isDefault?: boolean
}

interface BranchDiffBody {
  serviceName: string
  baseBranch: string  // 目标分支 (如测试分支)
  headBranch: string  // 当前分支 (如feature分支)
  githubConfigs?: GitHubConfig[]
  configId?: string
}

interface CompareCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
}

interface CompareFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
}

interface CompareResponseData {
  status: string
  ahead_by: number
  behind_by: number
  total_commits: number
  commits?: CompareCommit[]
  files?: CompareFile[]
}

export async function POST(request: NextRequest) {
  try {
    const body: BranchDiffBody = await request.json()
    const { serviceName, baseBranch, headBranch, githubConfigs = [], configId } = body

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
      ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}/compare/${baseBranch}...${headBranch}`
      : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}/compare/${baseBranch}...${headBranch}`

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${selectedConfig.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Kanban-Board-App/1.0.0",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("GitHub API Error:", error)
      
      let errorMessage = "获取分支差异失败"
      
      if (response.status === 401) {
        errorMessage = "GitHub访问令牌无效或已过期"
      } else if (response.status === 404) {
        errorMessage = `仓库或分支不存在: ${selectedConfig.owner}/${repo}`
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: error,
      }, { status: response.status })
    }

    const compareData: CompareResponseData = await response.json()
    
    // 解析比较结果
    const result = {
      status: compareData.status, // "ahead", "behind", "identical", "diverged"
      aheadBy: compareData.ahead_by, // head分支领先base分支的提交数
      behindBy: compareData.behind_by, // head分支落后base分支的提交数  
      totalCommits: compareData.total_commits, // 总的不同提交数
      commits: compareData.commits?.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url,
      })) || [],
      files: compareData.files?.map((file) => ({
        filename: file.filename,
        status: file.status, // "added", "removed", "modified", "renamed"
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
      })) || [],
      _config: {
        name: selectedConfig.name,
        owner: selectedConfig.owner,
        domain: selectedConfig.domain,
        repo,
        baseBranch,
        headBranch,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error comparing branches:", error)
    return NextResponse.json({ 
      error: "服务器内部错误",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}
