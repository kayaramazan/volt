// Local SQLite schema — the source of truth for the user's working set.
//
// Structurally mirrors the backend Prisma schema with key additions:
// - `dirty` flag on syncable rows (1 = local changes pending push)
// - `remoteRevision` on each row (last revision seen from server; 0 = never synced)
// - `localOnly` flag for personal workspaces never meant to sync
//
// Sync engine inspects (dirty=1) to know what to push; uses remoteRevision
// to detect overwrites coming from a pull.

import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────────────────
// App-level settings (single row)
// ─────────────────────────────────────────────────────────

export const appState = sqliteTable('app_state', {
  // key/value singleton table — used for session token references,
  // last-known user info, sync engine state.
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ─────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // localOnly = personal workspace never tied to backend user.
    // When user logs in, their local-only personal workspaces stay local;
    // they can manually "Move to cloud" to sync them.
    localOnly: integer('local_only', { mode: 'boolean' }).notNull().default(true),
    // If !localOnly, these tie the workspace to a backend identity.
    // ownerUserId XOR ownerTeamId (one is null).
    ownerUserId: text('owner_user_id'),
    ownerTeamId: text('owner_team_id'),
    // What revision the client last pulled. Used for delta queries.
    remoteRevision: text('remote_revision').notNull().default('0'),
    // True when there are dirty rows in this workspace.
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    // Currently selected environment (local-only, never synced).
    activeEnvironmentId: text('active_environment_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    syncIdx: index('workspaces_sync_idx').on(t.dirty),
  }),
);

// ─────────────────────────────────────────────────────────
// Collections (nested folders)
// ─────────────────────────────────────────────────────────

export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    name: text('name').notNull(),
    // Markdown documentation for the collection.
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    // JSON: Variable[] (key, value, secretRef)
    variables: text('variables').notNull().default('[]'),
    // JSON: MockDefinition[] — local mock-server entries scoped to this collection.
    mocks: text('mocks').notNull().default('[]'),
    // Sync tracking
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    remoteRevision: text('remote_revision').notNull().default('0'),
    deletedAt: integer('deleted_at'), // soft delete
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    workspaceIdx: index('collections_workspace_idx').on(t.workspaceId, t.updatedAt),
    parentIdx: index('collections_parent_idx').on(t.parentId),
    dirtyIdx: index('collections_dirty_idx').on(t.workspaceId, t.dirty),
  }),
);

// ─────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────

export const apiRequests = sqliteTable(
  'api_requests',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    collectionId: text('collection_id'),
    name: text('name').notNull(),
    method: text('method').notNull(),
    url: text('url').notNull(),
    // All shape-variable fields stored as JSON to avoid migration churn.
    headers: text('headers').notNull().default('[]'),      // HeaderRow[]
    queryParams: text('query_params').notNull().default('[]'),
    pathVariables: text('path_variables').notNull().default('[]'),
    bodyType: text('body_type').notNull().default('none'),
    body: text('body').notNull().default('{}'),            // RequestBody
    auth: text('auth').notNull().default('{"type":"none"}'),
    // Optional JS scripts run in a sandboxed vm. Empty string = no-op.
    preRequestScript: text('pre_request_script').notNull().default(''),
    postResponseScript: text('post_response_script').notNull().default(''),
    // Markdown documentation for the request.
    description: text('description').notNull().default(''),
    // JSON-encoded RequestExample[]
    examples: text('examples').notNull().default('[]'),
    sortOrder: integer('sort_order').notNull().default(0),
    // Sync tracking
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    remoteRevision: text('remote_revision').notNull().default('0'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    workspaceIdx: index('requests_workspace_idx').on(t.workspaceId, t.updatedAt),
    collectionIdx: index('requests_collection_idx').on(t.collectionId, t.sortOrder),
    dirtyIdx: index('requests_dirty_idx').on(t.workspaceId, t.dirty),
  }),
);

// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────

export const environments = sqliteTable(
  'environments',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    variables: text('variables').notNull().default('[]'),  // Variable[]
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    remoteRevision: text('remote_revision').notNull().default('0'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    workspaceIdx: index('environments_workspace_idx').on(t.workspaceId),
    dirtyIdx: index('environments_dirty_idx').on(t.workspaceId, t.dirty),
  }),
);

// ─────────────────────────────────────────────────────────
// History (local only — never synced, privacy promise)
// ─────────────────────────────────────────────────────────

export const historyEntries = sqliteTable(
  'history_entries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    // requestId can be null for ad-hoc requests not tied to a collection
    requestId: text('request_id'),
    method: text('method').notNull(),
    url: text('url').notNull(),
    // Full snapshot of the resolved request (JSON)
    requestSnapshot: text('request_snapshot').notNull(),
    statusCode: integer('status_code'),
    responseHeaders: text('response_headers'),  // JSON: [string, string][]
    // Response body up to RESPONSE_BODY_MAX_BYTES, stored as BLOB
    responseBody: blob('response_body'),
    responseSizeBytes: integer('response_size_bytes'),
    responseContentType: text('response_content_type'),
    startedAt: integer('started_at').notNull(),
    durationMs: integer('duration_ms').notNull(),
    errorCode: text('error_code'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    // Sync columns. History rows go through the same dirty/revision/deleted
    // pipeline as collections/requests/environments so they round-trip to
    // backend Postgres.
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    remoteRevision: text('remote_revision').notNull().default('0'),
    deletedAt: integer('deleted_at'),
  },
  (t) => ({
    workspaceTimeIdx: index('history_workspace_time_idx').on(t.workspaceId, t.startedAt),
    pinnedIdx: index('history_pinned_idx').on(t.workspaceId, t.pinned),
    dirtyIdx: index('history_dirty_idx').on(t.workspaceId, t.dirty),
  }),
);

// ─────────────────────────────────────────────────────────
// Conflict log (local cache of server conflict log)
// ─────────────────────────────────────────────────────────

export const conflictLog = sqliteTable(
  'conflict_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    table: text('table').notNull(),  // 'collection' | 'request' | 'environment'
    rowId: text('row_id').notNull(),
    previousState: text('previous_state').notNull(),  // JSON
    overwrittenByName: text('overwritten_by_name').notNull(),
    overwrittenByUserId: text('overwritten_by_user_id').notNull(),
    overwrittenAt: integer('overwritten_at').notNull(),
    dismissedAt: integer('dismissed_at'),  // user dismissed the banner
  },
  (t) => ({
    workspaceIdx: index('conflict_log_workspace_idx').on(t.workspaceId, t.overwrittenAt),
  }),
);

// Re-export the schema for use in migrations and queries
export const schema = {
  appState,
  workspaces,
  collections,
  apiRequests,
  environments,
  historyEntries,
  conflictLog,
};
