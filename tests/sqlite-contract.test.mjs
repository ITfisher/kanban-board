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
  assert.match(dbSource, /INSERT OR IGNORE INTO settings \(id\) VALUES \('singleton'\)/)
})

test("service_branches schema avoids foreign keys", () => {
  assert.doesNotMatch(schemaSource, /\.references\(/)
  assert.doesNotMatch(dbSource, /REFERENCES\s+tasks/i)
  assert.match(dbSource, /PRAGMA foreign_key_list\(service_branches\)/)
})
