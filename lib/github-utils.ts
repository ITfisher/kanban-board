import { db } from "./db"
import { repositories, repositoryConnections, scmConnections } from "./schema"
import type { RepositoryProvider } from "./types"

export interface ResolvedScmConnection {
  id: string
  name: string
  provider: RepositoryProvider
  domain: string
  owner: string
  token: string
  isDefault: boolean
}

export interface ResolvedRepositoryTarget {
  repositoryId?: string
  provider: RepositoryProvider
  domain: string
  owner: string
  repo: string
}

function toResolvedConnection(connection: typeof scmConnections.$inferSelect): ResolvedScmConnection {
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider as RepositoryProvider,
    domain: connection.domain,
    owner: connection.owner,
    token: connection.token,
    isDefault: connection.isDefault === 1,
  }
}

export async function getGitHubConnection(input: {
  connectionId?: string
  repositoryId?: string
  preferredDomain?: string
}): Promise<ResolvedScmConnection | null> {
  const [allConnections, allRepositoryConnections] = await Promise.all([
    db.select().from(scmConnections),
    db.select().from(repositoryConnections),
  ])

  let selected = input.connectionId
    ? allConnections.find((connection) => connection.id === input.connectionId)
    : undefined

  if (!selected && input.repositoryId) {
    const mappedConnectionIds = new Set(
      allRepositoryConnections
        .filter((mapping) => mapping.repositoryId === input.repositoryId)
        .map((mapping) => mapping.scmConnectionId)
    )

    selected = allConnections.find((connection) => mappedConnectionIds.has(connection.id))
  }

  if (!selected && input.preferredDomain) {
    selected = allConnections.find((connection) => connection.domain === input.preferredDomain)
  }

  if (!selected) {
    selected = allConnections.find((connection) => connection.isDefault === 1) ?? allConnections[0]
  }

  if (selected) {
    return toResolvedConnection(selected)
  }

  const envToken = process.env.GITHUB_TOKEN
  const envOwner = process.env.GITHUB_OWNER
  if (envToken && envOwner) {
    return {
      id: "env",
      name: "Environment",
      provider: "github",
      domain: "github.com",
      owner: envOwner,
      token: envToken,
      isDefault: true,
    }
  }

  return null
}

export async function resolveRepositoryTarget(input: {
  repositoryId?: string
  repoDomain?: string
  repoOwner?: string
  repoName?: string
}): Promise<ResolvedRepositoryTarget | null> {
  if (input.repositoryId) {
    const repositoryRows = await db.select().from(repositories)
    const repository = repositoryRows.find((row) => row.id === input.repositoryId)

    if (!repository) {
      return null
    }

    return {
      repositoryId: repository.id,
      provider: repository.provider as RepositoryProvider,
      domain: repository.domain,
      owner: repository.owner,
      repo: repository.slug || repository.name,
    }
  }

  if (input.repoDomain && input.repoOwner && input.repoName) {
    return {
      provider: input.repoDomain === "github.com" ? "github" : "github-enterprise",
      domain: input.repoDomain,
      owner: input.repoOwner,
      repo: input.repoName,
    }
  }

  return null
}

export function buildRepositoryApiUrl(_connection: ResolvedScmConnection, target: ResolvedRepositoryTarget): string {
  return target.domain === "github.com"
    ? `https://api.github.com/repos/${target.owner}/${target.repo}`
    : `https://${target.domain}/api/v3/repos/${target.owner}/${target.repo}`
}

export function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Kanban-Board-App/1.0.0",
  }
}

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
