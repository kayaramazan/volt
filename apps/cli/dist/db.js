"use strict";
// Minimal read-only DB helpers for the CLI. Uses better-sqlite3 directly
// against the same `volt.db` the desktop app writes to. We deliberately
// don't share types with the desktop app — the schema is small enough to
// declare inline, and keeping the CLI self-contained means we don't have
// to compile the Electron-bound desktop sources for the CLI.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoltCliError = void 0;
exports.openDb = openDb;
exports.closeDb = closeDb;
exports.listWorkspaces = listWorkspaces;
exports.findWorkspaceByName = findWorkspaceByName;
exports.listCollections = listCollections;
exports.listRequests = listRequests;
exports.getRequest = getRequest;
exports.listEnvironments = listEnvironments;
exports.listGlobals = listGlobals;
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const paths_1 = require("./paths");
let _db = null;
function openDb() {
    if (_db)
        return _db;
    const p = (0, paths_1.dbPath)();
    if (!node_fs_1.default.existsSync(p)) {
        throw new VoltCliError(`No Volt database found at ${p}. Open the desktop app at least once, or set VOLT_DB to point at a different file.`);
    }
    // Read-only would be safer but better-sqlite3 needs write access for WAL.
    _db = new better_sqlite3_1.default(p);
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 5000');
    return _db;
}
function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
function safeJson(s, fallback) {
    if (s == null)
        return fallback;
    try {
        return JSON.parse(s);
    }
    catch {
        return fallback;
    }
}
function listWorkspaces() {
    const db = openDb();
    const rows = db
        .prepare(`SELECT id, name, active_environment_id AS activeEnvironmentId
       FROM workspaces
       WHERE deleted_at IS NULL
       ORDER BY name`)
        .all();
    return rows;
}
function findWorkspaceByName(name) {
    const db = openDb();
    const row = db
        .prepare(`SELECT id, name, active_environment_id AS activeEnvironmentId
       FROM workspaces
       WHERE deleted_at IS NULL AND LOWER(name) = LOWER(?)
       LIMIT 1`)
        .get(name);
    return row ?? null;
}
function listCollections(workspaceId) {
    const db = openDb();
    const rows = db
        .prepare(`SELECT id, workspace_id AS workspaceId, parent_id AS parentId, name, variables
       FROM collections
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, name`)
        .all(workspaceId);
    return rows.map((r) => ({
        ...r,
        variables: safeJson(r.variables, []),
    }));
}
function listRequests(workspaceId) {
    const db = openDb();
    const rows = db
        .prepare(`SELECT id, workspace_id AS workspaceId, collection_id AS collectionId,
              name, method, url, headers, query_params AS queryParams,
              body_type AS bodyType, body, auth,
              pre_request_script AS preRequestScript,
              post_response_script AS postResponseScript
       FROM api_requests
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, name`)
        .all(workspaceId);
    return rows.map((r) => ({
        ...r,
        headers: safeJson(r.headers, []),
        queryParams: safeJson(r.queryParams, []),
        body: safeJson(r.body, { type: 'none' }),
        auth: safeJson(r.auth, { type: 'none' }),
    }));
}
function getRequest(id) {
    const db = openDb();
    const row = db
        .prepare(`SELECT id, workspace_id AS workspaceId, collection_id AS collectionId,
              name, method, url, headers, query_params AS queryParams,
              body_type AS bodyType, body, auth,
              pre_request_script AS preRequestScript,
              post_response_script AS postResponseScript
       FROM api_requests
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`)
        .get(id);
    if (!row)
        return null;
    return {
        ...row,
        headers: safeJson(row.headers, []),
        queryParams: safeJson(row.queryParams, []),
        body: safeJson(row.body, { type: 'none' }),
        auth: safeJson(row.auth, { type: 'none' }),
    };
}
function listEnvironments(workspaceId) {
    const db = openDb();
    const rows = db
        .prepare(`SELECT id, workspace_id AS workspaceId, name, variables
       FROM environments
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY name`)
        .all(workspaceId);
    return rows.map((r) => ({
        ...r,
        variables: safeJson(r.variables, []),
    }));
}
/** Read app_state.value JSON-decoded for all keys with the given prefix. */
function listGlobals() {
    const db = openDb();
    const rows = db
        .prepare(`SELECT key, value FROM app_state WHERE key LIKE 'globals.%'`)
        .all();
    const out = {};
    for (const r of rows) {
        const k = r.key.slice('globals.'.length);
        if (!k)
            continue;
        try {
            out[k] = JSON.parse(r.value);
        }
        catch {
            out[k] = r.value;
        }
    }
    return out;
}
class VoltCliError extends Error {
    exitCode;
    constructor(message, exitCode = 2) {
        super(message);
        this.exitCode = exitCode;
        this.name = 'VoltCliError';
    }
}
exports.VoltCliError = VoltCliError;
