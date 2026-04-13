import { eq } from "drizzle-orm"
import { db } from "./db"
import { githubConfigs } from "./schema"

export interface ResolvedGitHubConfig {
  id: string
  name: string
  domain: string
  owner: string
  token: string
  isDefault: boolean
}

/**
 * Fetch a GitHub config from the database by configId, or fall back to the
 * default / first available config, then env-var fallback.
 *
 * Tokens are NEVER returned to the client — this function is server-only.
 */
export async function getGitHubConfig(configId?: string): Promise<ResolvedGitHubConfig | null> {
  const allConfigs = await db.select().from(githubConfigs)

  let selected = allConfigs.find((c) => c.id === configId)

  if (!selected) {
    selected = allConfigs.find((c) => c.isDefault === 1) ?? allConfigs[0]
  }

  if (selected) {
    return {
      id: selected.id,
      name: selected.name,
      domain: selected.domain,
      owner: selected.owner,
      token: selected.token,
      isDefault: selected.isDefault === 1,
    }
  }

  // Env-var fallback (useful in development / CI without DB records)
  const envToken = process.env.GITHUB_TOKEN
  const envOwner = process.env.GITHUB_OWNER
  if (envToken && envOwner) {
    return {
      id: "env",
      name: "Environment",
      domain: "github.com",
      owner: envOwner,
      token: envToken,
      isDefault: true,
    }
  }

  return null
}

/**
 * Build the GitHub REST API base URL for a given config + repo.
 * Handles both github.com and GitHub Enterprise domains.
 */
export function buildRepoApiUrl(config: ResolvedGitHubConfig, repo: string): string {
  const base =
    config.domain === "github.com"
      ? `https://api.github.com/repos/${config.owner}/${repo}`
      : `https://${config.domain}/api/v3/repos/${config.owner}/${repo}`
  return base
}

/** Normalize a service name to a GitHub repo slug. */
export function toRepoSlug(serviceName: string): string {
  return serviceName.toLowerCase().replace(/\s+/g, "-")
}

/** Standard headers for GitHub API calls. */
export function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Kanban-Board-App/1.0.0",
  }
}

/**
 * Parse a domain from a repository URL (HTTP or git@ format).
 * Returns null if parsing fails.
 */
export function extractDomainFromRepository(repository?: string): string | null {
  if (!repository) return null
  if (repository.startsWith("http://") || repository.startsWith("https://")) {
    try {
      return new URL(repository).hostname
    } catch {
      return null
    }
  }
  const match = repository.match(/(?:git@|https?:\/\/)?([^/:]+)[:/]/)
  return match ? match[1] : null
}
