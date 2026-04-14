import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const dbSource = fs.readFileSync(path.join(rootDir, "lib/db.ts"), "utf8")
const schemaSource = fs.readFileSync(path.join(rootDir, "lib/schema.ts"), "utf8")

test("SQLite bootstrap creates the data directory and database on first start", () => {
  assert.match(dbSource, /mkdirSync\(path\.dirname\(DB_PATH\), \{ recursive: true \}\)/)
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS tasks/)
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS merge_operations/)
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS sync_runs/)
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS scm_connections/)
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS repository_connections/)
  assert.match(dbSource, /latest_pull_request_checks TEXT/)
  assert.match(dbSource, /latest_pull_request_mergeable_state TEXT/)
  assert.match(dbSource, /INSERT OR IGNORE INTO settings \(id\) VALUES \('singleton'\)/)
})

test("legacy service branch tables are dropped during bootstrap", () => {
  assert.doesNotMatch(schemaSource, /sqliteTable\("service_branches"/)
  assert.match(dbSource, /DROP TABLE IF EXISTS service_branches;/)
  assert.match(dbSource, /DROP TABLE IF EXISTS github_configs;/)
})
