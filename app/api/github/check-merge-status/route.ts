import { type NextRequest, NextResponse } from "next/server"

interface GitHubConfig {
  id: string
  name: string
  domain: string
  owner: string
  token: string
  isDefault?: boolean
}

interface CheckMergeStatusBody {
  serviceName: string
  pullRequestUrl?: string  // 单个PR检查模式（保持向后兼容）
  headBranch?: string     // 分支状态检查模式
  baseBranches?: string[] // 要检查的目标分支列表
  githubConfigs?: GitHubConfig[]
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
  user: {
    login: string
  }
}

interface CompareCommitSummary {
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

interface CompareBranchResponse {
  status: string
  ahead_by: number
  behind_by: number
  total_commits: number
  commits?: CompareCommitSummary[]
}

// 从PR URL中提取PR号码
function extractPRNumberFromUrl(url: string): string | null {
  const match = url.match(/\/pull\/(\d+)/)
  return match ? match[1] : null
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckMergeStatusBody = await request.json()
    const { serviceName, pullRequestUrl, headBranch, baseBranches, githubConfigs = [], configId } = body

    // 判断是单个PR检查模式还是分支状态检查模式
    if (pullRequestUrl) {
      // 单个PR检查模式（保持向后兼容）
      const prNumber = extractPRNumberFromUrl(pullRequestUrl)
      if (!prNumber) {
        return NextResponse.json({ 
          error: "无效的Pull Request URL格式" 
        }, { status: 400 })
      }
      return await checkSinglePR(serviceName, prNumber, githubConfigs, configId)
    } else if (headBranch && baseBranches) {
      // 分支状态检查模式
      return await checkBranchMergeStatus(serviceName, headBranch, baseBranches, githubConfigs, configId)
    } else {
      return NextResponse.json({ 
        error: "请提供pullRequestUrl或headBranch+baseBranches参数" 
      }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in main handler:", error)
    return NextResponse.json({ 
      error: "服务器内部错误",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 })
  }
}

// 获取GitHub配置的辅助函数
function getGitHubConfig(githubConfigs: GitHubConfig[], configId?: string): GitHubConfig | null {
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

  return selectedConfig || null
}

// 单个PR检查模式（保持向后兼容）
async function checkSinglePR(serviceName: string, prNumber: string, githubConfigs: GitHubConfig[], configId?: string) {
  const selectedConfig = getGitHubConfig(githubConfigs, configId)
  
  if (!selectedConfig || !selectedConfig.token) {
    return NextResponse.json({ 
      error: "GitHub配置未找到或Token未设置" 
    }, { status: 400 })
  }

  const repo = serviceName.toLowerCase().replace(/\s+/g, "-")
  const apiUrl = selectedConfig.domain === "github.com" 
    ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}/pulls/${prNumber}`
    : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}/pulls/${prNumber}`

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
    
    let errorMessage = "检查Pull Request状态失败"
    
    if (response.status === 401) {
      errorMessage = "GitHub访问令牌无效或已过期"
    } else if (response.status === 404) {
      errorMessage = `Pull Request #${prNumber} 不存在或无访问权限`
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error
    }, { status: response.status })
  }

  const pullRequest = await response.json()
  
  return NextResponse.json({
    prNumber: parseInt(prNumber),
    isMerged: pullRequest.merged,
    mergedAt: pullRequest.merged_at,
    state: pullRequest.state,
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    title: pullRequest.title,
    url: pullRequest.html_url,
    _config: {
      name: selectedConfig.name,
      owner: selectedConfig.owner,
      domain: selectedConfig.domain,
    }
  })
}

// 分支状态检查模式
async function checkBranchMergeStatus(serviceName: string, headBranch: string, baseBranches: string[], githubConfigs: GitHubConfig[], configId?: string) {
  const selectedConfig = getGitHubConfig(githubConfigs, configId)
  
  if (!selectedConfig || !selectedConfig.token) {
    return NextResponse.json({ 
      error: "GitHub配置未找到或Token未设置" 
    }, { status: 400 })
  }

  const repo = serviceName.toLowerCase().replace(/\s+/g, "-")
  const baseApiUrl = selectedConfig.domain === "github.com" 
    ? `https://api.github.com/repos/${selectedConfig.owner}/${repo}`
    : `https://${selectedConfig.domain}/api/v3/repos/${selectedConfig.owner}/${repo}`

  const headers = {
    Authorization: `Bearer ${selectedConfig.token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Kanban-Board-App/1.0.0",
  }

  // 检查每个目标分支的状态
  const branchStatuses = await Promise.all(
    baseBranches.map(async (baseBranch) => {
      try {
        // 1. 查找从headBranch到baseBranch的PR
        const pullsUrl = `${baseApiUrl}/pulls?head=${selectedConfig!.owner}:${headBranch}&base=${baseBranch}&state=all&sort=updated&direction=desc`
        
        const pullsResponse = await fetch(pullsUrl, { headers })
        
        if (!pullsResponse.ok) {
          throw new Error(`获取PR列表失败: ${pullsResponse.status}`)
        }

        const pulls: PullRequestListItem[] = await pullsResponse.json()
        const latestPR = pulls.length > 0 ? pulls[0] : null

        // 2. 检查分支差异
        let diffStatus = null
        let isMerged = false

        try {
          const compareUrl = `${baseApiUrl}/compare/${baseBranch}...${headBranch}`
          const compareResponse = await fetch(compareUrl, { headers })
          
          if (compareResponse.ok) {
            const compareData: CompareBranchResponse = await compareResponse.json()
            isMerged = compareData.behind_by === 0 && compareData.ahead_by === 0
            diffStatus = {
              status: compareData.status, // "ahead", "behind", "identical", "diverged"
              aheadBy: compareData.ahead_by,
              behindBy: compareData.behind_by,
              totalCommits: compareData.total_commits,
              commits: compareData.commits?.slice(0, 5).map((commit) => ({
                sha: commit.sha.substring(0, 7),
                message: commit.commit.message.split('\n')[0], // 只取第一行
                author: commit.commit.author.name,
                date: commit.commit.author.date,
                url: commit.html_url,
              })) || []
            }
          }
        } catch (error) {
          console.warn(`比较分支失败 ${baseBranch}...${headBranch}:`, error)
        }

        return {
          baseBranch,
          isMerged,
          diffStatus,
          pullRequest: latestPR ? {
            number: latestPR.number,
            title: latestPR.title,
            state: latestPR.state, // "open", "closed"
            merged: latestPR.merged_at !== null,
            mergedAt: latestPR.merged_at,
            createdAt: latestPR.created_at,
            updatedAt: latestPR.updated_at,
            url: latestPR.html_url,
            author: latestPR.user.login,
            mergeable: latestPR.mergeable,
            mergeableState: latestPR.mergeable_state,
          } : null
        }
      } catch (error) {
        console.error(`检查分支 ${baseBranch} 状态失败:`, error)
        return {
          baseBranch,
          isMerged: false,
          diffStatus: null,
          pullRequest: null,
          error: error instanceof Error ? error.message : "未知错误"
        }
      }
    })
  )

  return NextResponse.json({
    serviceName,
    headBranch,
    branchStatuses,
    _config: {
      name: selectedConfig.name,
      owner: selectedConfig.owner,
      domain: selectedConfig.domain,
      repo,
    }
  })
}
