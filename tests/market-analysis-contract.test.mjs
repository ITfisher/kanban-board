import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const pageSource = fs.readFileSync(path.join(rootDir, "app/market-analysis/page.tsx"), "utf8")
const routeSource = fs.readFileSync(path.join(rootDir, "app/api/market-analysis/route.ts"), "utf8")
const sidebarSource = fs.readFileSync(path.join(rootDir, "components/sidebar.tsx"), "utf8")
const shellSource = fs.readFileSync(path.join(rootDir, "components/app-shell.tsx"), "utf8")
const analysisSource = fs.readFileSync(path.join(rootDir, "lib/market-analysis.ts"), "utf8")

test("market analysis page exposes the four required sections", () => {
  assert.match(pageSource, /高热度帖子 Top 5/)
  assert.match(pageSource, /每日高频币种 Top 5/)
  assert.match(pageSource, /涨幅波动 Top 10/)
  assert.match(pageSource, /最终建议交易币种/)
})

test("market analysis route and navigation are wired into the app shell", () => {
  assert.match(routeSource, /getMarketAnalysisPayload/)
  assert.match(sidebarSource, /name: "行情分析"/)
  assert.match(sidebarSource, /href: "\/market-analysis"/)
  assert.match(shellSource, /market-analysis/)
})

test("market analysis library keeps symbol extraction and recommendation entrypoints", () => {
  assert.match(analysisSource, /export function extractSymbolsFromText/)
  assert.match(analysisSource, /export function buildCoinFrequency/)
  assert.match(analysisSource, /export async function fetchVolatilityRankings/)
  assert.match(analysisSource, /export function buildRecommendations/)
  assert.match(analysisSource, /strategySummary/)
})
