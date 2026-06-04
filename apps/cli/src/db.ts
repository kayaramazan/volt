// Minimal read-only DB helpers for the CLI. Uses better-sqlite3 directly
// against the same `volt.db` the desktop app writes to. We deliberately
// don't share types with the desktop app — the schema is small enough to
// declare inline, and keeping the CLI self-contained means we don't have
// to compile the Electron-bound desktop sources for the CLI.

import fs from 'node:fs';
import Database from 'better-sqlite3';

import { dbPath } from './paths';

export type Json = unknown;

export interface Workspace {
  id: string;
  name: string;
  activeEnvironmentId: string | null;
}

export interface Collection {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  variables: Array<{ key: string; value: string; secretRef?: string }>;
}

export interface Environment {
  id: string;
  workspaceId: string;
  name: string;
  variables: Array<{ key: string; value: string; secretRef?: string }>;
}

export interface ApiRequest {
  id: string;
  workspaceId: string;
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>;
  bodyType: string;
  body: Json;
  auth: Json;
  preRequestScript: string;
  postResponseScript: string;
}

let _db: Database.Database | null = null;

export function openDb(): Database.Database {
  if (_db) return _db;
  const p = dbPath();
  if (!fs.existsSync(p)) {
    throw new VoltCliError(
      `No Volt database found at ${p}. Open the desktop app at least once, or set VOLT_DB to point at a different file.`,
    );
  }
  // Read-only would be safer but better-sqlite3 needs write access for WAL.
  _db = new Database(p);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (s == null) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function listWorkspaces(): Workspace[] {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT id, name, active_environment_id AS activeEnvironmentId
       FROM workspaces
       WHERE deleted_at IS NULL
       ORDER BY name`,
    )
    .all() as Array<{ id: string; name: string; activeEnvironmentId: string | null }>;
  return rows;
}

export function findWorkspaceByName(name: string): Workspace | null {
  const db = openDb();
  const row = db
    .prepare(
      `SELECT id, name, active_environment_id AS activeEnvironmentId
       FROM workspaces
       WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?)
       LIMIT 1`,
    )
    .get(name) as Workspace | undefined;
  return row ?? null;
}

export function listCollections(workspaceId: string): Collection[] {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT id, workspace_id AS workspaceId, parent_id AS parentId, name, variables
       FROM collections
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, name`,
    )
    .all(workspaceId) as Array<{
    id: string;
    workspaceId: string;
    parentId: string | null;
    name: string;
    variables: string;
  }>;
  return rows.map((r) => ({
    ...r,
    variables: safeJson(r.variables, [] as Collection['variables']),
  }));
}

export function listRequests(workspaceId: string): ApiRequest[] {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT id, workspace_id AS workspaceId, collection_id AS collectionId,
              name, method, url, headers, query_params AS queryParams,
              body_type AS bodyType, body, auth,
              pre_request_script AS preRequestScript,
              post_response_script AS postResponseScript
       FROM api_requests
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, name`,
    )
    .all(workspaceId) as Array<{
    id: string;
    workspaceId: string;
    collectionId: string | null;
    name: string;
    method: string;
    url: string;
    headers: string;
    queryParams: string;
    bodyType: string;
    body: string;
    auth: string;
    preRequestScript: string;
    postResponseScript: string;
  }>;
  return rows.map((r) => ({
    ...r,
    headers: safeJson(r.headers, [] as ApiRequest['headers']),
    queryParams: safeJson(r.queryParams, [] as ApiRequest['queryParams']),
    body: safeJson(r.body, { type: 'none' }),
    auth: safeJson(r.auth, { type: 'none' }),
  }));
}

export function getRequest(id: string): ApiRequest | null {
  const db = openDb();
  const row = db
    .prepare(
      `SELECT id, workspace_id AS workspaceId, collection_id AS collectionId,
              name, method, url, headers, query_params AS queryParams,
              body_type AS bodyType, body, auth,
              pre_request_script AS preRequestScript,
              post_response_script AS postResponseScript
       FROM api_requests
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
    .get(id) as
    | {
        id: string;
        workspaceId: string;
        collectionId: string | null;
        name: string;
        method: string;
        url: string;
        headers: string;
        queryParams: string;
        bodyType: string;
        body: string;
        auth: string;
        preRequestScript: string;
        postResponseScript: string;
      }
    | undefined;
  if (!row) return null;
  return {
    ...row,
    headers: safeJson(row.headers, [] as ApiRequest['headers']),
    queryParams: safeJson(row.queryParams, [] as ApiRequest['queryParams']),
    body: safeJson(row.body, { type: 'none' }),
    auth: safeJson(row.auth, { type: 'none' }),
  };
}

export function listEnvironments(workspaceId: string): Environment[] {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT id, workspace_id AS workspaceId, name, variables
       FROM environments
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY name`,
    )
    .all(workspaceId) as Array<{
    id: string;
    workspaceId: string;
    name: string;
    variables: string;
  }>;
  return rows.map((r) => ({
    ...r,
    variables: safeJson(r.variables, [] as Environment['variables']),
  }));
}

/** Read app_state.value JSON-decoded for all keys with the given prefix. */
export function listGlobals(): Record<string, unknown> {
  const db = openDb();
  const rows = db
    .prepare(`SELECT key, value FROM app_state WHERE key LIKE 'globals.%'`)
    .all() as Array<{ key: string; value: string }>;
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.slice('globals.'.length);
    if (!k) continue;
    try {
      out[k] = JSON.parse(r.value);
    } catch {
      out[k] = r.value;
    }
  }
  return out;
}

export class VoltCliError extends Error {
  constructor(message: string, public exitCode: number = 2) {
    super(message);
    this.name = 'VoltCliError';
  }
}
