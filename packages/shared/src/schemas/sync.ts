import { z } from 'zod';

const uuid = z.string().uuid();

// Each syncable table is identified by a small enum. Keeps the sync engine
// table-agnostic and the wire format compact.
export const SyncTable = z.enum(['collection', 'request', 'environment', 'history']);
export type SyncTable = z.infer<typeof SyncTable>;

// A change is either an upsert (with full row payload) or a delete (just the id).
// The shape of `data` depends on the table; we validate it on the server
// after dispatching by table.
export const SyncChange = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    table: SyncTable,
    rowId: uuid,
    data: z.record(z.unknown()), // server-side per-table validators handle the shape
  }),
  z.object({
    op: z.literal('delete'),
    table: SyncTable,
    rowId: uuid,
  }),
]);
export type SyncChange = z.infer<typeof SyncChange>;

// ─────────────────────────────────────────────────────────
// Push
// ─────────────────────────────────────────────────────────

export const SyncPushInput = z.object({
  workspaceId: uuid,
  // The revision the client last saw. If this is stale, server returns 409.
  baseRevision: z.string(), // bigint as string to survive JSON
  // Batched changes — usually 1-20, soft-capped at 500.
  changes: z.array(SyncChange).min(1).max(500),
});
export type SyncPushInput = z.infer<typeof SyncPushInput>;

// Each applied change gets a new revision number assigned by the server.
export const SyncPushOutput = z.object({
  newRevision: z.string(), // the workspace's new currentRevision
  applied: z.array(
    z.object({
      table: SyncTable,
      rowId: uuid,
      revision: z.string(),
    }),
  ),
});
export type SyncPushOutput = z.infer<typeof SyncPushOutput>;

// 409 conflict response — client must pull then retry.
export const SyncPushConflict = z.object({
  error: z.literal('REVISION_CONFLICT'),
  workspaceId: uuid,
  baseRevision: z.string(),
  currentRevision: z.string(),
});
export type SyncPushConflict = z.infer<typeof SyncPushConflict>;

// ─────────────────────────────────────────────────────────
// Pull
// ─────────────────────────────────────────────────────────

export const SyncPullInput = z.object({
  workspaceId: uuid,
  // Return changes with revision > since.
  since: z.string(),
});
export type SyncPullInput = z.infer<typeof SyncPullInput>;

// A "fetched" change includes the new revision and full row state.
export const FetchedChange = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    table: SyncTable,
    rowId: uuid,
    revision: z.string(),
    data: z.record(z.unknown()),
  }),
  z.object({
    op: z.literal('delete'),
    table: SyncTable,
    rowId: uuid,
    revision: z.string(),
  }),
]);
export type FetchedChange = z.infer<typeof FetchedChange>;

export const SyncPullOutput = z.object({
  currentRevision: z.string(),
  changes: z.array(FetchedChange),
});
export type SyncPullOutput = z.infer<typeof SyncPullOutput>;

// ─────────────────────────────────────────────────────────
// SSE event payloads
// ─────────────────────────────────────────────────────────

// Events sent over SSE for real-time push:
// - "change" — a workspace had a new push, client should pull
// - "heartbeat" — keep-alive every 30s through proxies
export const SseChangeEvent = z.object({
  type: z.literal('change'),
  workspaceId: uuid,
  newRevision: z.string(),
});

export const SseHeartbeatEvent = z.object({
  type: z.literal('heartbeat'),
  ts: z.string().datetime(),
});

export const SseEvent = z.discriminatedUnion('type', [SseChangeEvent, SseHeartbeatEvent]);
export type SseEvent = z.infer<typeof SseEvent>;

// ─────────────────────────────────────────────────────────
// Conflict log
// ─────────────────────────────────────────────────────────

export const ConflictLogEntry = z.object({
  id: uuid,
  workspaceId: uuid,
  table: SyncTable,
  rowId: uuid,
  previousState: z.record(z.unknown()),
  overwrittenBy: z.object({
    userId: uuid,
    name: z.string(),
  }),
  overwrittenAt: z.string().datetime(),
});
export type ConflictLogEntry = z.infer<typeof ConflictLogEntry>;

export const ListConflictsInput = z.object({
  workspaceId: uuid,
});
export const ListConflictsOutput = z.object({
  conflicts: z.array(ConflictLogEntry),
});

export const RestoreConflictInput = z.object({
  conflictId: uuid,
});
