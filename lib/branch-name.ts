export function normalizeBranchPrefix(prefix?: string) {
  const trimmed = (prefix || "feature/").trim()
  const withoutLeadingSlashes = trimmed.replace(/^\/+/, "")
  const withoutTrailingSlashes = withoutLeadingSlashes.replace(/\/+$/, "")

  return `${withoutTrailingSlashes || "feature"}/`
}

export function slugifyBranchSegment(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "task"
}

export function buildTaskBranchName(prefix: string | undefined, label: string, suffix?: string | number) {
  const normalizedPrefix = normalizeBranchPrefix(prefix)
  const slug = slugifyBranchSegment(label)

  return `${normalizedPrefix}${slug}${suffix ? `-${suffix}` : ""}`
}
