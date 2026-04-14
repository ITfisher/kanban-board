import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const pipelineSource = fs.readFileSync(path.join(rootDir, "lib/service-pipeline.ts"), "utf8")
const stageBoardRouteSource = fs.readFileSync(
  path.join(rootDir, "app/api/services/[id]/stage-board/route.ts"),
  "utf8"
)

test("service pipeline exposes gate calculation and sync entrypoints", () => {
  assert.match(pipelineSource, /export function computeStageGateState/)
  assert.match(pipelineSource, /export async function refreshServiceBranchStageSnapshots/)
  assert.match(pipelineSource, /export async function runServicePipelineSync/)
  assert.match(pipelineSource, /eventType: "snapshot\.refreshed"/)
  assert.match(pipelineSource, /eventType: "sync\.completed"/)
  assert.match(pipelineSource, /eventType: "pull_request\.merge_reverted"/)
  assert.match(pipelineSource, /operationType: "pull_request_revert"/)
  assert.match(pipelineSource, /latestPullRequestChecks/)
})

test("stage board route supports on-demand sync without changing the consumer path", () => {
  assert.match(stageBoardRouteSource, /searchParams\.get\("sync"\) === "1"/)
  assert.match(stageBoardRouteSource, /runServicePipelineSync/)
  assert.match(stageBoardRouteSource, /refreshServiceBranchStageSnapshots/)
})
