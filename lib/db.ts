import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "path"
import * as schema from "./schema"

const DB_PATH = path.join(process.cwd(), "data", "kanban.db")

// Singleton connection for the process lifetime
let _db: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH)
    sqlite.pragma("journal_mode = WAL")
    sqlite.pragma("foreign_keys = ON")
    _db = drizzle(sqlite, { schema })
    initSchema(sqlite)
  }
  return _db
}

function initSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_name TEXT,
      assignee_avatar TEXT,
      jira_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_branches (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      service_id TEXT,
      service_name TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      pull_request_url TEXT,
      merged_to_test INTEGER NOT NULL DEFAULT 0,
      merged_to_master INTEGER NOT NULL DEFAULT 0,
      test_merge_date TEXT,
      master_merge_date TEXT,
      last_commit TEXT,
      last_status_check TEXT,
      pr_status TEXT,
      diff_status TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      repository TEXT NOT NULL DEFAULT '',
      test_branch TEXT NOT NULL DEFAULT 'develop',
      master_branch TEXT NOT NULL DEFAULT 'main',
      dependencies TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS github_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      owner TEXT NOT NULL,
      token TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      notifications INTEGER NOT NULL DEFAULT 1,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      compact_view INTEGER NOT NULL DEFAULT 0,
      show_assignee_avatars INTEGER NOT NULL DEFAULT 1,
      default_priority TEXT NOT NULL DEFAULT 'medium',
      auto_create_branch INTEGER NOT NULL DEFAULT 1,
      branch_prefix TEXT NOT NULL DEFAULT 'feature/'
    );
  `)

  const serviceBranchColumns = sqlite.prepare(`PRAGMA table_info(service_branches)`).all() as Array<{ name: string }>
  const hasServiceIdColumn = serviceBranchColumns.some((column) => column.name === "service_id")
  if (!hasServiceIdColumn) {
    sqlite.exec(`ALTER TABLE service_branches ADD COLUMN service_id TEXT`)
  }

  sqlite.exec(`
    UPDATE service_branches
    SET service_id = (
      SELECT services.id
      FROM services
      WHERE services.name = service_branches.service_name
      LIMIT 1
    )
    WHERE service_id IS NULL
  `)

  // Ensure the settings singleton row exists
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO settings (id) VALUES ('singleton')`
    )
    .run()
}

export const db = getDb()
