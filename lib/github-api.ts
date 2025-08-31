interface GitHubConfig {
  token: string
  owner: string
  repo: string
}

interface CreatePullRequestParams {
  title: string
  head: string // 源分支
  base: string // 目标分支
  body?: string
}

export class GitHubService {
  private config: GitHubConfig

  constructor(config: GitHubConfig) {
    this.config = config
  }

  async createPullRequest(params: CreatePullRequestParams) {
    const response = await fetch(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to create pull request")
    }

    return response.json()
  }

  async mergePullRequest(pullNumber: number, mergeMethod: "merge" | "squash" | "rebase" = "merge") {
    const response = await fetch(
      `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls/${pullNumber}/merge`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merge_method: mergeMethod,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || "Failed to merge pull request")
    }

    return response.json()
  }

  async getBranch(branchName: string) {
    const response = await fetch(
      `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/branches/${branchName}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    )

    if (!response.ok) {
      return null
    }

    return response.json()
  }
}
