import type { RepositoryProvider } from "@/lib/types"

export type ParsedRepositoryUrl = {
  provider: RepositoryProvider
  domain: string
  owner: string
  name: string
  slug: string
  fullName: string
  normalizedUrl: string
}

function inferProvider(domain: string): RepositoryProvider {
  return domain === "github.com" ? "github" : "github-enterprise"
}

function normalizeRepoName(value: string) {
  return value.replace(/\.git$/i, "").trim()
}

export function parseRepositoryUrl(input: string): ParsedRepositoryUrl | null {
  const raw = input.trim()
  if (!raw) {
    return null
  }

  const sshMatch = raw.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i)
  if (sshMatch) {
    const [, domain, owner, repoName] = sshMatch
    const slug = normalizeRepoName(repoName)
    if (!domain || !owner || !slug) {
      return null
    }

    return {
      provider: inferProvider(domain),
      domain,
      owner,
      name: slug,
      slug,
      fullName: `${owner}/${slug}`,
      normalizedUrl: `https://${domain}/${owner}/${slug}.git`,
    }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(raw)
  } catch {
    return null
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean)
  if (pathSegments.length < 2) {
    return null
  }

  const [owner, repoName] = pathSegments
  const slug = normalizeRepoName(repoName)
  if (!owner || !slug) {
    return null
  }

  const domain = parsedUrl.hostname

  return {
    provider: inferProvider(domain),
    domain,
    owner,
    name: slug,
    slug,
    fullName: `${owner}/${slug}`,
    normalizedUrl: `https://${domain}/${owner}/${slug}.git`,
  }
}
