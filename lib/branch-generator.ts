import { slugifyBranchSegment } from "@/lib/branch-name"

export type BranchTaskType = "feature" | "bugfix" | "hotfix" | "refactor" | "docs"

interface BranchGeneratorOptions {
  taskTitle: string
  serviceName: string
  priority?: "low" | "medium" | "high"
  taskType?: BranchTaskType
  assignee?: string
  taskId?: string
}

interface BranchTemplate {
  prefix: string
  pattern: string
  description: string
}

const BRANCH_TEMPLATES: Record<BranchTaskType, BranchTemplate> = {
  feature: {
    prefix: "feature",
    pattern: "{prefix}/{service}-{title}-{id}",
    description: "新功能开发分支",
  },
  bugfix: {
    prefix: "bugfix",
    pattern: "{prefix}/{service}-{title}-{id}",
    description: "Bug修复分支",
  },
  hotfix: {
    prefix: "hotfix",
    pattern: "{prefix}/{service}-{title}-{id}",
    description: "紧急修复分支",
  },
  refactor: {
    prefix: "refactor",
    pattern: "{prefix}/{service}-{title}",
    description: "代码重构分支",
  },
  docs: {
    prefix: "docs",
    pattern: "{prefix}/{service}-{title}",
    description: "文档更新分支",
  },
}

function cleanForBranchName(text: string): string {
  return slugifyBranchSegment(text)
    .substring(0, 50)
    .replace(/-+$/, "")
}

function detectTaskType(title: string, description: string, priority: string): BranchTaskType {
  const text = `${title} ${description}`.toLowerCase()

  // Check for hotfix indicators
  if (
    priority === "high" &&
    (text.includes("紧急") || text.includes("修复") || text.includes("bug") || text.includes("错误"))
  ) {
    return "hotfix"
  }

  // Check for bugfix indicators
  if (text.includes("修复") || text.includes("bug") || text.includes("错误") || text.includes("问题")) {
    return "bugfix"
  }

  // Check for refactor indicators
  if (text.includes("重构") || text.includes("优化") || text.includes("refactor") || text.includes("优化性能")) {
    return "refactor"
  }

  // Check for docs indicators
  if (text.includes("文档") || text.includes("说明") || text.includes("readme") || text.includes("docs")) {
    return "docs"
  }

  // Default to feature
  return "feature"
}

export function generateBranchName(options: BranchGeneratorOptions): string {
  const { taskTitle, serviceName, priority = "medium", taskType, taskId } = options

  // Auto-detect task type if not provided
  const detectedType = taskType || detectTaskType(taskTitle, "", priority)
  const template = BRANCH_TEMPLATES[detectedType] || BRANCH_TEMPLATES.feature

  // Clean service name and task title
  const cleanService = cleanForBranchName(serviceName)
  const cleanTitle = cleanForBranchName(taskTitle)
  const shortId = taskId ? taskId.slice(-6) : Date.now().toString().slice(-6)

  // Generate branch name using template
  let branchName = template.pattern
    .replace("{prefix}", template.prefix)
    .replace("{service}", cleanService)
    .replace("{title}", cleanTitle)
    .replace("{id}", shortId)

  // Ensure branch name is not too long (Git has a limit)
  if (branchName.length > 100) {
    const maxTitleLength = 100 - template.prefix.length - cleanService.length - shortId.length - 10
    const truncatedTitle = cleanTitle.substring(0, maxTitleLength).replace(/-+$/, "")
    branchName = template.pattern
      .replace("{prefix}", template.prefix)
      .replace("{service}", cleanService)
      .replace("{title}", truncatedTitle)
      .replace("{id}", shortId)
  }

  return branchName
}

export function getBranchTemplates(): Record<BranchTaskType, BranchTemplate> {
  return BRANCH_TEMPLATES
}

export function generateMultiServiceBranches(
  taskTitle: string,
  services: string[],
  options: Partial<BranchGeneratorOptions> = {},
): Array<{ serviceName: string; branchName: string; taskType: BranchTaskType }> {
  return services.map((serviceName) => {
    const branchName = generateBranchName({
      taskTitle,
      serviceName,
      ...options,
    })

    const taskType = options.taskType || detectTaskType(taskTitle, "", options.priority || "medium")

    return {
      serviceName,
      branchName,
      taskType,
    }
  })
}

export function validateBranchName(branchName: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check length
  if (branchName.length > 100) {
    errors.push("分支名过长（超过100个字符）")
  }

  if (branchName.length < 3) {
    errors.push("分支名过短（少于3个字符）")
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
    errors.push("分支名包含无效字符（只允许字母、数字、下划线、斜杠和连字符）")
  }

  // Check for invalid patterns
  if (branchName.startsWith("-") || branchName.endsWith("-")) {
    errors.push("分支名不能以连字符开头或结尾")
  }

  if (branchName.includes("//") || branchName.includes("--")) {
    errors.push("分支名不能包含连续的斜杠或连字符")
  }

  if (branchName.startsWith("/") || branchName.endsWith("/")) {
    errors.push("分支名不能以斜杠开头或结尾")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
