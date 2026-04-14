import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const githubUtilsSource = fs.readFileSync(path.join(rootDir, "lib/github-utils.ts"), "utf8")
const servicePageSource = fs.readFileSync(path.join(rootDir, "app/services/[id]/page.tsx"), "utf8")

test("GitHub repository resolution only accepts explicit repository identifiers", () => {
  assert.doesNotMatch(githubUtilsSource, /if \(input\.serviceName\)/)
  assert.doesNotMatch(githubUtilsSource, /toRepoSlug/)
  assert.doesNotMatch(githubUtilsSource, /githubConfigs/)
  assert.match(githubUtilsSource, /if \(input\.repositoryId\)/)
  assert.match(githubUtilsSource, /if \(input\.repoDomain && input\.repoOwner && input\.repoName\)/)
  assert.match(githubUtilsSource, /getGitHubConnection/)
  assert.match(githubUtilsSource, /scmConnections/)
})

test("service detail page exposes stage config editing and PR snapshot display", () => {
  assert.match(servicePageSource, /阶段配置/)
  assert.match(servicePageSource, /保存阶段配置/)
  assert.match(servicePageSource, /latestPullRequestChecks/)
  assert.match(servicePageSource, /PR 打开/)
})
