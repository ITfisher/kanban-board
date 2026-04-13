import { slugify } from "transliteration"

const BRANCH_TERM_REPLACEMENTS = [
  ["批量删除", "batch delete"],
  ["主题切换", "theme switch"],
  ["服务分支", "service branch"],
  ["设置页", "settings page"],
  ["详情页", "detail page"],
  ["列表页", "list page"],
  ["看板", "kanban"],
  ["项目", "project"],
  ["新建", "create"],
  ["新增", "add"],
  ["修复", "fix"],
  ["管理", "manage"],
  ["优化", "optimize"],
  ["重构", "refactor"],
  ["设置", "settings"],
  ["主题", "theme"],
  ["切换", "switch"],
  ["任务", "task"],
  ["分支", "branch"],
  ["服务", "service"],
  ["页面", "page"],
  ["详情", "detail"],
  ["列表", "list"],
  ["支持", ""],
] as const

export function normalizeBranchPrefix(prefix?: string) {
  const trimmed = (prefix ?? "").trim()

  if (!trimmed) {
    return ""
  }

  const withoutLeadingSlashes = trimmed.replace(/^\/+/, "")
  const withoutTrailingSlashes = withoutLeadingSlashes.replace(/\/+$/, "")

  return withoutTrailingSlashes ? `${withoutTrailingSlashes}/` : ""
}

export function slugifyBranchSegment(input: string) {
  const normalizedInput = BRANCH_TERM_REPLACEMENTS.reduce((value, [search, replacement]) => {
    return value.replaceAll(search, replacement ? ` ${replacement} ` : " ")
  }, input.trim())

  const normalized = slugify(normalizedInput, {
    lowercase: true,
    separator: "-",
  })
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "task"
}

export function buildTaskBranchName(prefix: string | undefined, label: string, suffix?: string | number) {
  const normalizedPrefix = normalizeBranchPrefix(prefix)
  const slug = slugifyBranchSegment(label)

  return `${normalizedPrefix}${slug}${suffix ? `-${suffix}` : ""}`
}
