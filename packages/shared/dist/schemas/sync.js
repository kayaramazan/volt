"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestoreConflictInput = exports.ListConflictsOutput = exports.ListConflictsInput = exports.ConflictLogEntry = exports.SseEvent = exports.SseHeartbeatEvent = exports.SseChangeEvent = exports.SyncPullOutput = exports.FetchedChange = exports.SyncPullInput = exports.SyncPushConflict = exports.SyncPushOutput = exports.SyncPushInput = exports.SyncChange = exports.SyncTable = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
// Each syncable table is identified by a small enum. Keeps the sync engine
// table-agnostic and the wire format compact.
exports.SyncTable = zod_1.z.enum(['collection', 'request', 'environment', 'history']);
// A change is either an upsert (with full row payload) or a delete (just the id).
// The shape of `data` depends on the table; we validate it on the server
// after dispatching by table.
exports.SyncChange = zod_1.z.discriminatedUnion('op', [
    zod_1.z.object({
        op: zod_1.z.literal('upsert'),
        table: exports.SyncTable,
        rowId: uuid,
        data: zod_1.z.record(zod_1.z.unknown()), // server-side per-table validators handle the shape
    }),
    zod_1.z.object({
        op: zod_1.z.literal('delete'),
        table: exports.SyncTable,
        rowId: uuid,
    }),
]);
// ─────────────────────────────────────────────────────────
// Push
// ─────────────────────────────────────────────────────────
exports.SyncPushInput = zod_1.z.object({
    workspaceId: uuid,
    // The revision the client last saw. If this is stale, server returns 409.
    baseRevision: zod_1.z.string(), // bigint as string to survive JSON
    // Batched changes — usually 1-20, soft-capped at 500.
    changes: zod_1.z.array(exports.SyncChange).min(1).max(500),
});
// Each applied change gets a new revision number assigned by the server.
exports.SyncPushOutput = zod_1.z.object({
    newRevision: zod_1.z.string(), // the workspace's new currentRevision
    applied: zod_1.z.array(zod_1.z.object({
        table: exports.SyncTable,
        rowId: uuid,
        revision: zod_1.z.string(),
    })),
});
// 409 conflict response — client must pull then retry.
exports.SyncPushConflict = zod_1.z.object({
    error: zod_1.z.literal('REVISION_CONFLICT'),
    workspaceId: uuid,
    baseRevision: zod_1.z.string(),
    currentRevision: zod_1.z.string(),
});
// ─────────────────────────────────────────────────────────
// Pull
// ─────────────────────────────────────────────────────────
exports.SyncPullInput = zod_1.z.object({
    workspaceId: uuid,
    // Return changes with revision > since.
    since: zod_1.z.string(),
});
// A "fetched" change includes the new revision and full row state.
exports.FetchedChange = zod_1.z.discriminatedUnion('op', [
    zod_1.z.object({
        op: zod_1.z.literal('upsert'),
        table: exports.SyncTable,
        rowId: uuid,
        revision: zod_1.z.string(),
        data: zod_1.z.record(zod_1.z.unknown()),
    }),
    zod_1.z.object({
        op: zod_1.z.literal('delete'),
        table: exports.SyncTable,
        rowId: uuid,
        revision: zod_1.z.string(),
    }),
]);
exports.SyncPullOutput = zod_1.z.object({
    currentRevision: zod_1.z.string(),
    changes: zod_1.z.array(exports.FetchedChange),
});
// ─────────────────────────────────────────────────────────
// SSE event payloads
// ─────────────────────────────────────────────────────────
// Events sent over SSE for real-time push:
// - "change" — a workspace had a new push, client should pull
// - "heartbeat" — keep-alive every 30s through proxies
exports.SseChangeEvent = zod_1.z.object({
    type: zod_1.z.literal('change'),
    workspaceId: uuid,
    newRevision: zod_1.z.string(),
});
exports.SseHeartbeatEvent = zod_1.z.object({
    type: zod_1.z.literal('heartbeat'),
    ts: zod_1.z.string().datetime(),
});
exports.SseEvent = zod_1.z.discriminatedUnion('type', [exports.SseChangeEvent, exports.SseHeartbeatEvent]);
// ─────────────────────────────────────────────────────────
// Conflict log
// ─────────────────────────────────────────────────────────
exports.ConflictLogEntry = zod_1.z.object({
    id: uuid,
    workspaceId: uuid,
    table: exports.SyncTable,
    rowId: uuid,
    previousState: zod_1.z.record(zod_1.z.unknown()),
    overwrittenBy: zod_1.z.object({
        userId: uuid,
        name: zod_1.z.string(),
    }),
    overwrittenAt: zod_1.z.string().datetime(),
});
exports.ListConflictsInput = zod_1.z.object({
    workspaceId: uuid,
});
exports.ListConflictsOutput = zod_1.z.object({
    conflicts: zod_1.z.array(exports.ConflictLogEntry),
});
exports.RestoreConflictInput = zod_1.z.object({
    conflictId: uuid,
});
//# sourceMappingURL=sync.js.map