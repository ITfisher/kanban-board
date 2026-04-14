import Database from "better-sqlite3"
import fs from "fs"
import { drizzle } from "drizzle-orm/better-sqlite3"
import path from "path"
import * as schema from "./schema"
import { isCompletedTaskStatus } from "./task-status"

const DB_PATH = path.join(process.cwd(), "data", "kanban.db")

let _db: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    const sqlite = new Database(DB_PATH)
    sqlite.pragma("busy_timeout = 5000")
    sqlite.pragma("journal_mode = WAL")
    sqlite.pragma("foreign_keys = OFF")
    initSchema(sqlite)
    _db = drizzle(sqlite, { schema })
  }

  return _db
}

function initSchema(sqlite: Database.Database) {
  dropLegacyTables(sqlite)
  repairLegacyServiceData(sqlite)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'github',
      domain TEXT NOT NULL DEFAULT 'github.com',
      owner TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL DEFAULT '',
      default_branch TEXT NOT NULL DEFAULT 'main',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      owner_user_id TEXT,
      assignee_name TEXT,
      assignee_avatar TEXT,
      jira_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_branches (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_branch_developers (
      id TEXT PRIMARY KEY,
      task_branch_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'developer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      root_path TEXT NOT NULL DEFAULT '',
      dependencies TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_stages (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      target_branch TEXT NOT NULL DEFAULT 'main',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_branch_services (
      id TEXT PRIMARY KEY,
      task_branch_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      task_branch_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_stage_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'github',
      provider_domain TEXT NOT NULL DEFAULT 'github.com',
      external_number INTEGER,
      title TEXT NOT NULL DEFAULT '',
      html_url TEXT,
      source_branch TEXT NOT NULL,
      target_branch TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'open',
      merged INTEGER NOT NULL DEFAULT 0,
      mergeable INTEGER,
      mergeable_state TEXT,
      head_sha TEXT,
      base_sha TEXT,
      draft INTEGER NOT NULL DEFAULT 0,
      author_user_id TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      merged_at TEXT,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      repository_id TEXT,
      task_id TEXT,
      task_branch_id TEXT,
      service_id TEXT,
      service_stage_id TEXT,
      pull_request_id TEXT,
      actor_user_id TEXT,
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merge_operations (
      id TEXT PRIMARY KEY,
      repository_id TEXT,
      task_id TEXT,
      task_branch_id TEXT,
      service_id TEXT,
      service_stage_id TEXT,
      pull_request_id TEXT,
      operation_type TEXT NOT NULL DEFAULT 'pull_request_merge',
      status TEXT NOT NULL DEFAULT 'completed',
      summary TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      repository_id TEXT,
      service_id TEXT,
      task_branch_id TEXT,
      scope TEXT NOT NULL DEFAULT 'service',
      status TEXT NOT NULL DEFAULT 'running',
      summary TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scm_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'github',
      domain TEXT NOT NULL DEFAULT 'github.com',
      owner TEXT NOT NULL,
      token TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repository_connections (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      scm_connection_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_branch_stage_snapshots (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      task_branch_id TEXT NOT NULL,
      service_stage_id TEXT NOT NULL,
      stage_status TEXT NOT NULL DEFAULT 'idle',
      gate_status TEXT NOT NULL DEFAULT 'unknown',
      is_actionable INTEGER NOT NULL DEFAULT 0,
      action_type TEXT,
      latest_pull_request_id TEXT,
      latest_pull_request_number INTEGER,
      latest_pull_request_state TEXT,
      latest_pull_request_url TEXT,
      latest_pull_request_title TEXT,
      latest_pull_request_mergeable INTEGER,
      latest_pull_request_mergeable_state TEXT,
      latest_pull_request_draft INTEGER,
      latest_pull_request_checks TEXT,
      task_title TEXT NOT NULL DEFAULT '',
      task_status TEXT NOT NULL DEFAULT 'backlog',
      branch_name TEXT NOT NULL,
      developer_user_ids TEXT NOT NULL DEFAULT '[]',
      developer_names TEXT NOT NULL DEFAULT '[]',
      last_synced_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      notifications INTEGER NOT NULL DEFAULT 0,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      compact_view INTEGER NOT NULL DEFAULT 0,
      show_assignee_avatars INTEGER NOT NULL DEFAULT 1,
      default_priority TEXT NOT NULL DEFAULT 'medium',
      branch_prefix TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_task_branches_task_id ON task_branches(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_branches_repository_id ON task_branches(repository_id);
    CREATE INDEX IF NOT EXISTS idx_task_branch_services_branch_id ON task_branch_services(task_branch_id);
    CREATE INDEX IF NOT EXISTS idx_task_branch_services_service_id ON task_branch_services(service_id);
    CREATE INDEX IF NOT EXISTS idx_service_stages_service_id ON service_stages(service_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_services_repository_name ON services(repository_id, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_stages_service_key ON service_stages(service_id, key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_stages_service_position ON service_stages(service_id, position);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_repository_connections_repo_connection
      ON repository_connections(repository_id, scm_connection_id);
    CREATE INDEX IF NOT EXISTS idx_pull_requests_branch_stage ON pull_requests(task_branch_id, service_id, service_stage_id);
    CREATE INDEX IF NOT EXISTS idx_events_branch_id ON events(task_branch_id);
    CREATE INDEX IF NOT EXISTS idx_merge_operations_branch_id ON merge_operations(task_branch_id);
    CREATE INDEX IF NOT EXISTS idx_merge_operations_pull_request_id ON merge_operations(pull_request_id);
    CREATE INDEX IF NOT EXISTS idx_sync_runs_scope ON sync_runs(repository_id, service_id, task_branch_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_service_stage ON service_branch_stage_snapshots(service_id, service_stage_id);
  `)

  ensureColumn(sqlite, "tasks", "owner_user_id", "TEXT")
  ensureColumn(sqlite, "tasks", "completed_at", "TEXT")
  ensureColumn(sqlite, "task_branches", "title", "TEXT NOT NULL DEFAULT ''")
  ensureColumn(sqlite, "task_branches", "description", "TEXT NOT NULL DEFAULT ''")
  ensureColumn(sqlite, "task_branches", "created_by_user_id", "TEXT")
  ensureColumn(sqlite, "task_branches", "last_synced_at", "TEXT")
  ensureColumn(sqlite, "service_branch_stage_snapshots", "latest_pull_request_title", "TEXT")
  ensureColumn(sqlite, "service_branch_stage_snapshots", "latest_pull_request_mergeable", "INTEGER")
  ensureColumn(sqlite, "service_branch_stage_snapshots", "latest_pull_request_mergeable_state", "TEXT")
  ensureColumn(sqlite, "service_branch_stage_snapshots", "latest_pull_request_draft", "INTEGER")
  ensureColumn(sqlite, "service_branch_stage_snapshots", "latest_pull_request_checks", "TEXT")

  migrateGitHubConfigsToScmConnections(sqlite)
  rebuildServicesTableIfNeeded(sqlite)
  rebuildSettingsTableIfNeeded(sqlite)
  dropLegacyTables(sqlite)

  sqlite.exec(`
    UPDATE tasks
    SET status = 'testing'
    WHERE status = 'review'
  `)

  const completedTaskRows = sqlite
    .prepare(`SELECT id, status, created_at, updated_at, completed_at FROM tasks`)
    .all() as Array<{ id: string; status: string; created_at: string; updated_at: string; completed_at: string | null }>

  const updateCompletedAt = sqlite.prepare(`UPDATE tasks SET completed_at = ? WHERE id = ?`)

  completedTaskRows.forEach((task) => {
    if (isCompletedTaskStatus(task.status)) {
      updateCompletedAt.run(task.completed_at ?? task.updated_at ?? task.created_at, task.id)
      return
    }

    if (task.completed_at !== null) {
      updateCompletedAt.run(null, task.id)
    }
  })

  sqlite.prepare(`INSERT OR IGNORE INTO settings (id) VALUES ('singleton')`).run()
  sqlite.prepare(`UPDATE settings SET notifications = 0 WHERE id = 'singleton' AND notifications != 0`).run()
}

function tableExists(sqlite: Database.Database, tableName: string) {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName) as { name?: string } | undefined

  return Boolean(row?.name)
}

function getColumnNames(sqlite: Database.Database, tableName: string) {
  if (!tableExists(sqlite, tableName)) {
    return []
  }

  return (sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name)
}

function ensureColumn(sqlite: Database.Database, tableName: string, columnName: string, columnDefinition: string) {
  const columnNames = getColumnNames(sqlite, tableName)
  if (!columnNames.includes(columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`)
  }
}

function repairLegacyServiceData(sqlite: Database.Database) {
  if (!tableExists(sqlite, "services")) {
    return
  }

  const serviceColumns = new Set(getColumnNames(sqlite, "services"))
  const hasLegacyServiceShape =
    serviceColumns.has("repository") || serviceColumns.has("test_branch") || serviceColumns.has("master_branch")

  if (hasLegacyServiceShape) {
    const invalidServiceIds = (
      sqlite
        .prepare(`SELECT id FROM services WHERE repository_id IS NULL OR TRIM(repository_id) = ''`)
        .all() as Array<{ id: string }>
    ).map((row) => row.id)

    if (invalidServiceIds.length > 0) {
      const placeholders = invalidServiceIds.map(() => "?").join(", ")
      const deleteFromServiceLinkedTable = (tableName: string, columnName = "service_id") => {
        if (!tableExists(sqlite, tableName)) {
          return
        }
        sqlite.prepare(`DELETE FROM ${tableName} WHERE ${columnName} IN (${placeholders})`).run(...invalidServiceIds)
      }

      deleteFromServiceLinkedTable("service_stages")
      deleteFromServiceLinkedTable("task_branch_services")
      deleteFromServiceLinkedTable("pull_requests")
      deleteFromServiceLinkedTable("service_branch_stage_snapshots")
      deleteFromServiceLinkedTable("merge_operations")
      deleteFromServiceLinkedTable("sync_runs")
      deleteFromServiceLinkedTable("events")
    }
  }

  if (tableExists(sqlite, "service_stages")) {
    sqlite.exec(`
      DELETE FROM service_stages
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM service_stages
        GROUP BY service_id, key
      );

      DELETE FROM service_stages
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM service_stages
        GROUP BY service_id, position
      );
    `)
  }
}

function migrateGitHubConfigsToScmConnections(sqlite: Database.Database) {
  if (!tableExists(sqlite, "github_configs")) {
    return
  }

  sqlite.exec(`
    INSERT OR IGNORE INTO scm_connections (
      id,
      name,
      provider,
      domain,
      owner,
      token,
      is_default,
      created_at,
      updated_at
    )
    SELECT
      id,
      name,
      'github',
      domain,
      owner,
      token,
      is_default,
      datetime('now'),
      datetime('now')
    FROM github_configs
  `)
}

function rebuildServicesTableIfNeeded(sqlite: Database.Database) {
  if (!tableExists(sqlite, "services")) {
    return
  }

  const columns = new Set(getColumnNames(sqlite, "services"))
  const requiresRebuild =
    columns.has("repository") ||
    columns.has("test_branch") ||
    columns.has("master_branch") ||
    !columns.has("repository_id") ||
    !columns.has("created_at") ||
    !columns.has("updated_at")

  if (!requiresRebuild) {
    return
  }

  sqlite.exec(`
    BEGIN;
    DROP TABLE IF EXISTS services__new;
    CREATE TABLE services__new (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      root_path TEXT NOT NULL DEFAULT '',
      dependencies TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO services__new (
      id,
      repository_id,
      name,
      description,
      root_path,
      dependencies,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      id,
      repository_id,
      name,
      COALESCE(description, ''),
      COALESCE(root_path, ''),
      COALESCE(dependencies, '[]'),
      COALESCE(is_active, 1),
      COALESCE(created_at, datetime('now')),
      COALESCE(updated_at, created_at, datetime('now'))
    FROM services
    WHERE repository_id IS NOT NULL AND TRIM(repository_id) != '';

    DROP TABLE services;
    ALTER TABLE services__new RENAME TO services;
    COMMIT;
  `)
}

function rebuildSettingsTableIfNeeded(sqlite: Database.Database) {
  if (!tableExists(sqlite, "settings")) {
    return
  }

  const columns = new Set(getColumnNames(sqlite, "settings"))
  if (!columns.has("auto_create_branch")) {
    return
  }

  sqlite.exec(`
    BEGIN;
    DROP TABLE IF EXISTS settings__new;
    CREATE TABLE settings__new (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      notifications INTEGER NOT NULL DEFAULT 0,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      compact_view INTEGER NOT NULL DEFAULT 0,
      show_assignee_avatars INTEGER NOT NULL DEFAULT 1,
      default_priority TEXT NOT NULL DEFAULT 'medium',
      branch_prefix TEXT NOT NULL DEFAULT ''
    );

    INSERT INTO settings__new (
      id,
      notifications,
      dark_mode,
      compact_view,
      show_assignee_avatars,
      default_priority,
      branch_prefix
    )
    SELECT
      id,
      notifications,
      dark_mode,
      compact_view,
      show_assignee_avatars,
      default_priority,
      branch_prefix
    FROM settings;

    DROP TABLE settings;
    ALTER TABLE settings__new RENAME TO settings;
    COMMIT;
  `)
}

function dropLegacyTables(sqlite: Database.Database) {
  sqlite.exec(`
    DROP TABLE IF EXISTS service_branches;
    DROP TABLE IF EXISTS github_configs;
  `)
}

type Db = ReturnType<typeof drizzle>

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb()
    const value = Reflect.get(instance as object, prop, receiver)
    return typeof value === "function" ? value.bind(instance) : value
  },
})
