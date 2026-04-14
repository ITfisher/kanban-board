import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8")

const expectedRoutes = [
  { route: "/dashboard", file: "app/dashboard/page.tsx" },
  { route: "/tasks", file: "app/tasks/page.tsx" },
  { route: "/tasks/[id]", file: "app/tasks/[id]/page.tsx" },
  { route: "/services", file: "app/services/page.tsx" },
  { route: "/branches", file: "app/branches/page.tsx" },
  { route: "/settings", file: "app/settings/page.tsx" },
]

const expectedApiRoutes = [
  "app/api/github/branch-diff/route.ts",
  "app/api/github/check-merge-status/route.ts",
  "app/api/github/pr-status/route.ts",
  "app/api/github/pull-request/route.ts",
]

const expectedSections = [
  "## ✨ 功能概览",
  "## Docker 部署",
  "## 🌐 页面地图",
  "## 🔄 数据流",
  "## 🧩 核心组件协作图",
  "## 📁 仓库约定",
  "## ✅ 推荐验证命令",
]

const expectedDocs = [
  "Dockerfile",
  "docker-compose.yml",
  "scripts/docker-deploy.sh",
  "data/kanban.db",
  "docker compose up -d --build",
  "首次启动时自动创建",
  "不使用外键约束",
]

test("README documents the required architecture sections", () => {
  for (const heading of expectedSections) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  const mermaidBlocks = (readme.match(/```mermaid/g) || []).length
  assert.ok(mermaidBlocks >= 2, "README should include at least two mermaid diagrams")
})

test("README route map stays aligned with actual page files", () => {
  for (const { route, file } of expectedRoutes) {
    assert.ok(fs.existsSync(path.join(rootDir, file)), `${file} should exist`)
    assert.match(readme, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    assert.match(readme, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("README captures Docker and SQLite persistence guidance", () => {
  for (const docEntry of expectedDocs) {
    assert.match(readme, new RegExp(docEntry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  for (const apiFile of expectedApiRoutes) {
    assert.ok(fs.existsSync(path.join(rootDir, apiFile)), `${apiFile} should exist`)
    assert.match(readme, new RegExp(apiFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})
