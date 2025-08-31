import { type NextRequest, NextResponse } from "next/server"

interface CreatePullRequestBody {
  serviceName: string
  title: string
  head: string
  base: string
  body?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: CreatePullRequestBody = await request.json()
    const { serviceName, title, head, base, body: prBody } = body

    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const owner = process.env.GITHUB_OWNER || "your-org"
    const repo = serviceName.toLowerCase().replace(/\s+/g, "-")

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
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
      return NextResponse.json({ error: error.message || "Failed to create pull request" }, { status: response.status })
    }

    const pullRequest = await response.json()
    return NextResponse.json(pullRequest)
  } catch (error) {
    console.error("Error creating pull request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
