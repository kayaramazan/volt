// Local DB initialization.
//
// We use better-sqlite3 (synchronous, fast) with Drizzle ORM.
// Database file lives at OS-appropriate "userData" path.
// Migrations are inline SQL run at first open — small enough not to need
// drizzle-kit at runtime.

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

import { schema } from './schema';

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _raw: Database.Database | null = null;
let _dbPath: string | null = null;

export function getDbPath(): string {
  if (_dbPath) return _dbPath;
  // app.getPath('userData') returns:
  //   macOS:   ~/Library/Application Support/Volt
  //   Windows: %APPDATA%/Volt
  //   Linux:   ~/.config/Volt
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  _dbPath = path.join(userData, 'volt.db');
  return _dbPath;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) initDb();
  return _db!;
}

export function getRawDb(): Database.Database {
  if (!_raw) initDb();
  return _raw!;
}

function initDb() {
  const dbPath = getDbPath();
  _raw = new Database(dbPath);

  // Performance pragmas — applied at every open (idempotent).
  _raw.pragma('journal_mode = WAL');       // concurrent reads while writing
  _raw.pragma('synchronous = NORMAL');     // fsync less aggressively; WAL is durable
  _raw.pragma('foreign_keys = ON');        // enforce FKs
  _raw.pragma('busy_timeout = 5000');      // wait up to 5s on locks

  _db = drizzle(_raw, { schema });
  runMigrations(_raw);
}

/**
 * Inline migrations. Each migration is a CREATE statement guarded by
 * IF NOT EXISTS so re-running is safe. Order matters; new migrations
 * append to the bottom.
 */
function runMigrations(raw: Database.Database) {
  raw.exec(`
    -- v1: initial schema
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      local_only INTEGER NOT NULL DEFAULT 1,
      owner_user_id TEXT,
      owner_team_id TEXT,
      remote_revision TEXT NOT NULL DEFAULT '0',
      dirty INTEGER NOT NULL DEFAULT 0,
      active_environment_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS workspaces_sync_idx ON workspaces(dirty);

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      parent_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      variables TEXT NOT NULL DEFAULT '[]',
      mocks TEXT NOT NULL DEFAULT '[]',
      dirty INTEGER NOT NULL DEFAULT 0,
      remote_revision TEXT NOT NULL DEFAULT '0',
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS collections_workspace_idx ON collections(workspace_id, updated_at);
    CREATE INDEX IF NOT EXISTS collections_parent_idx ON collections(parent_id);
    CREATE INDEX IF NOT EXISTS collections_dirty_idx ON collections(workspace_id, dirty);

    CREATE TABLE IF NOT EXISTS api_requests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      collection_id TEXT,
      name TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT NOT NULL DEFAULT '[]',
      query_params TEXT NOT NULL DEFAULT '[]',
      path_variables TEXT NOT NULL DEFAULT '[]',
      body_type TEXT NOT NULL DEFAULT 'none',
      body TEXT NOT NULL DEFAULT '{}',
      auth TEXT NOT NULL DEFAULT '{"type":"none"}',
      pre_request_script TEXT NOT NULL DEFAULT '',
      post_response_script TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      examples TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0,
      remote_revision TEXT NOT NULL DEFAULT '0',
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS requests_workspace_idx ON api_requests(workspace_id, updated_at);
    CREATE INDEX IF NOT EXISTS requests_collection_idx ON api_requests(collection_id, sort_order);
    CREATE INDEX IF NOT EXISTS requests_dirty_idx ON api_requests(workspace_id, dirty);

    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      variables TEXT NOT NULL DEFAULT '[]',
      dirty INTEGER NOT NULL DEFAULT 0,
      remote_revision TEXT NOT NULL DEFAULT '0',
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS environments_workspace_idx ON environments(workspace_id);
    CREATE INDEX IF NOT EXISTS environments_dirty_idx ON environments(workspace_id, dirty);

    CREATE TABLE IF NOT EXISTS history_entries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      request_id TEXT,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      request_snapshot TEXT NOT NULL,
      status_code INTEGER,
      response_headers TEXT,
      response_body BLOB,
      response_size_bytes INTEGER,
      response_content_type TEXT,
      started_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      error_code TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0,
      remote_revision TEXT NOT NULL DEFAULT '0',
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS history_workspace_time_idx ON history_entries(workspace_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS history_pinned_idx ON history_entries(workspace_id, pinned);
    -- history_dirty_idx is created in the v2 migration below, after ensuring
    -- the dirty column exists on older databases.

    CREATE TABLE IF NOT EXISTS conflict_log (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      "table" TEXT NOT NULL,
      row_id TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      overwritten_by_name TEXT NOT NULL,
      overwritten_by_user_id TEXT NOT NULL,
      overwritten_at INTEGER NOT NULL,
      dismissed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS conflict_log_workspace_idx ON conflict_log(workspace_id, overwritten_at);
  `);

  // v2: history sync columns. Idempotent — only ADD COLUMN if missing.
  // SQLite has no `ADD COLUMN IF NOT EXISTS`, so we inspect PRAGMA table_info first.
  const historyCols = raw
    .prepare(`PRAGMA table_info('history_entries')`)
    .all() as Array<{ name: string }>;
  const has = (name: string) => historyCols.some((c) => c.name === name);
  if (!has('dirty')) {
    raw.exec(`ALTER TABLE history_entries ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0`);
  }
  if (!has('remote_revision')) {
    raw.exec(`ALTER TABLE history_entries ADD COLUMN remote_revision TEXT NOT NULL DEFAULT '0'`);
  }
  if (!has('deleted_at')) {
    raw.exec(`ALTER TABLE history_entries ADD COLUMN deleted_at INTEGER`);
  }
  raw.exec(`CREATE INDEX IF NOT EXISTS history_dirty_idx ON history_entries(workspace_id, dirty)`);

  // v3: pre/post scripts on api_requests. Same idempotent ALTER pattern.
  const reqCols = raw
    .prepare(`PRAGMA table_info('api_requests')`)
    .all() as Array<{ name: string }>;
  const reqHas = (name: string) => reqCols.some((c) => c.name === name);
  if (!reqHas('pre_request_script')) {
    raw.exec(
      `ALTER TABLE api_requests ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT ''`,
    );
  }
  if (!reqHas('post_response_script')) {
    raw.exec(
      `ALTER TABLE api_requests ADD COLUMN post_response_script TEXT NOT NULL DEFAULT ''`,
    );
  }
  // Path variables (`:id` segments) — JSON array of key/value rows.
  if (!reqHas('path_variables')) {
    raw.exec(`ALTER TABLE api_requests ADD COLUMN path_variables TEXT NOT NULL DEFAULT '[]'`);
  }

  // v4: collection.description (markdown documentation).
  const colCols = raw
    .prepare(`PRAGMA table_info('collections')`)
    .all() as Array<{ name: string }>;
  if (!colCols.some((c) => c.name === 'description')) {
    raw.exec(`ALTER TABLE collections ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
  }

  // v5: api_requests.description + examples (JSON array of frozen snapshots).
  const reqCols2 = raw
    .prepare(`PRAGMA table_info('api_requests')`)
    .all() as Array<{ name: string }>;
  if (!reqCols2.some((c) => c.name === 'description')) {
    raw.exec(`ALTER TABLE api_requests ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
  }
  if (!reqCols2.some((c) => c.name === 'examples')) {
    raw.exec(`ALTER TABLE api_requests ADD COLUMN examples TEXT NOT NULL DEFAULT '[]'`);
  }

  // v6: collections.mocks (local mock-server entries scoped per collection).
  const colCols2 = raw
    .prepare(`PRAGMA table_info('collections')`)
    .all() as Array<{ name: string }>;
  if (!colCols2.some((c) => c.name === 'mocks')) {
    raw.exec(`ALTER TABLE collections ADD COLUMN mocks TEXT NOT NULL DEFAULT '[]'`);
  }
}

export function closeDb() {
  if (_raw) {
    _raw.close();
    _raw = null;
    _db = null;
  }
}
