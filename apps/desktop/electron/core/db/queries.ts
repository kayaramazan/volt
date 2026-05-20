// High-level DB queries used by IPC handlers.
//
// Every mutation sets `dirty = 1` and `updatedAt = now` so the sync engine
// can pick up changes via a single query: WHERE dirty = 1.
//
// Reads return rows with JSON fields already parsed.

import { and, asc, desc, eq, gt, gte, isNull, like, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { getDb } from './connection';
import {
  apiRequests,
  collections,
  conflictLog,
  environments,
  historyEntries,
  workspaces,
} from './schema';

const now = () => Date.now();
const uuid = () =>
  // RFC 4122 v4 — nanoid alphabet would be too short, we want canonical hex form
  // because backend Prisma stores as @db.Uuid.
  crypto.randomUUID();

// ─────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────

export function createWorkspace(input: {
  name: string;
  localOnly?: boolean;
  ownerUserId?: string | null;
  ownerTeamId?: string | null;
  /** Optional explicit id (used to match a backend-created cloud workspace). */
  id?: string;
}) {
  const db = getDb();
  const id = input.id ?? uuid();
  const ts = now();
  db.insert(workspaces)
    .values({
      id,
      name: input.name,
      localOnly: input.localOnly ?? true,
      ownerUserId: input.ownerUserId ?? null,
      ownerTeamId: input.ownerTeamId ?? null,
      remoteRevision: '0',
      dirty: !(input.localOnly ?? true), // mark dirty for sync if cloud workspace
      activeEnvironmentId: null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  return getWorkspace(id);
}

export function listWorkspaces() {
  return getDb().select().from(workspaces).all();
}

export function getWorkspace(id: string) {
  return getDb().select().from(workspaces).where(eq(workspaces.id, id)).get();
}

export function renameWorkspace(id: string, name: string) {
  getDb()
    .update(workspaces)
    .set({ name, dirty: true, updatedAt: now() })
    .where(eq(workspaces.id, id))
    .run();
  return getWorkspace(id);
}

export function deleteWorkspaceLocal(id: string) {
  // Hard delete locally — cascade clears child rows.
  // For cloud workspaces, the sync engine will issue a server-side soft delete
  // before this is called (separate flow).
  getDb().delete(workspaces).where(eq(workspaces.id, id)).run();
}

export function setActiveEnvironment(workspaceId: string, environmentId: string | null) {
  // activeEnvironmentId is NOT synced — purely local user preference.
  getDb()
    .update(workspaces)
    .set({ activeEnvironmentId: environmentId, updatedAt: now() })
    .where(eq(workspaces.id, workspaceId))
    .run();
}

export function getActiveEnvironment(workspaceId: string): string | null {
  const ws = getWorkspace(workspaceId);
  return ws?.activeEnvironmentId ?? null;
}

// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────

export function createCollection(input: {
  workspaceId: string;
  parentId: string | null;
  name: string;
  description?: string;
}) {
  const id = uuid();
  const ts = now();
  getDb()
    .insert(collections)
    .values({
      id,
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      name: input.name,
      description: input.description ?? '',
      sortOrder: 0,
      variables: '[]',
      dirty: true,
      remoteRevision: '0',
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  markWorkspaceDirty(input.workspaceId);
  return getCollection(id);
}

export function getCollection(id: string) {
  const row = getDb().select().from(collections).where(eq(collections.id, id)).get();
  return row ? parseCollection(row) : null;
}

export function listCollections(workspaceId: string) {
  const rows = getDb()
    .select()
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), isNull(collections.deletedAt)))
    .orderBy(asc(collections.sortOrder), asc(collections.name))
    .all();
  return rows.map(parseCollection);
}

export function updateCollection(
  id: string,
  patch: {
    name?: string;
    parentId?: string | null;
    description?: string;
    sortOrder?: number;
    variables?: unknown;
  },
) {
  const existing = getDb().select().from(collections).where(eq(collections.id, id)).get();
  if (!existing) return null;

  getDb()
    .update(collections)
    .set({
      name: patch.name ?? existing.name,
      parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
      description: patch.description ?? existing.description,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      variables: patch.variables !== undefined ? JSON.stringify(patch.variables) : existing.variables,
      dirty: true,
      updatedAt: now(),
    })
    .where(eq(collections.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
  return getCollection(id);
}

export function softDeleteCollection(id: string) {
  const existing = getDb().select().from(collections).where(eq(collections.id, id)).get();
  if (!existing) return;
  getDb()
    .update(collections)
    .set({ deletedAt: now(), dirty: true, updatedAt: now() })
    .where(eq(collections.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
}

// ─────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────

export function createRequest(input: {
  workspaceId: string;
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  headers?: unknown;
  queryParams?: unknown;
  bodyType?: string;
  body?: unknown;
  auth?: unknown;
  preRequestScript?: string;
  postResponseScript?: string;
  description?: string;
  examples?: unknown;
  sortOrder?: number;
  /** Explicit id (used by duplicate). */
  id?: string;
}) {
  const id = input.id ?? uuid();
  const ts = now();
  getDb()
    .insert(apiRequests)
    .values({
      id,
      workspaceId: input.workspaceId,
      collectionId: input.collectionId,
      name: input.name,
      method: input.method,
      url: input.url,
      headers: JSON.stringify(input.headers ?? []),
      queryParams: JSON.stringify(input.queryParams ?? []),
      bodyType: input.bodyType ?? 'none',
      body: JSON.stringify(input.body ?? { type: 'none' }),
      auth: JSON.stringify(input.auth ?? { type: 'none' }),
      preRequestScript: input.preRequestScript ?? '',
      postResponseScript: input.postResponseScript ?? '',
      description: input.description ?? '',
      examples: JSON.stringify(input.examples ?? []),
      sortOrder: input.sortOrder ?? 0,
      dirty: true,
      remoteRevision: '0',
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  markWorkspaceDirty(input.workspaceId);
  return getRequest(id);
}

export function getRequest(id: string) {
  const row = getDb().select().from(apiRequests).where(eq(apiRequests.id, id)).get();
  return row ? parseRequest(row) : null;
}

export function listRequests(workspaceId: string, collectionId?: string | null) {
  const conditions = [eq(apiRequests.workspaceId, workspaceId), isNull(apiRequests.deletedAt)];
  if (collectionId !== undefined) {
    conditions.push(
      collectionId === null
        ? isNull(apiRequests.collectionId)
        : eq(apiRequests.collectionId, collectionId),
    );
  }
  const rows = getDb()
    .select()
    .from(apiRequests)
    .where(and(...conditions))
    .orderBy(asc(apiRequests.sortOrder), asc(apiRequests.name))
    .all();
  return rows.map(parseRequest);
}

export function updateRequest(
  id: string,
  patch: Partial<{
    name: string;
    collectionId: string | null;
    method: string;
    url: string;
    headers: unknown;
    queryParams: unknown;
    bodyType: string;
    body: unknown;
    auth: unknown;
    preRequestScript: string;
    postResponseScript: string;
    description: string;
    examples: unknown;
    sortOrder: number;
  }>,
) {
  const existing = getDb().select().from(apiRequests).where(eq(apiRequests.id, id)).get();
  if (!existing) return null;

  getDb()
    .update(apiRequests)
    .set({
      name: patch.name ?? existing.name,
      collectionId: patch.collectionId === undefined ? existing.collectionId : patch.collectionId,
      method: patch.method ?? existing.method,
      url: patch.url ?? existing.url,
      headers: patch.headers !== undefined ? JSON.stringify(patch.headers) : existing.headers,
      queryParams:
        patch.queryParams !== undefined ? JSON.stringify(patch.queryParams) : existing.queryParams,
      bodyType: patch.bodyType ?? existing.bodyType,
      body: patch.body !== undefined ? JSON.stringify(patch.body) : existing.body,
      auth: patch.auth !== undefined ? JSON.stringify(patch.auth) : existing.auth,
      preRequestScript: patch.preRequestScript ?? existing.preRequestScript,
      postResponseScript: patch.postResponseScript ?? existing.postResponseScript,
      description: patch.description ?? existing.description,
      examples: patch.examples !== undefined ? JSON.stringify(patch.examples) : existing.examples,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      dirty: true,
      updatedAt: now(),
    })
    .where(eq(apiRequests.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
  return getRequest(id);
}

export function softDeleteRequest(id: string) {
  const existing = getDb().select().from(apiRequests).where(eq(apiRequests.id, id)).get();
  if (!existing) return;
  getDb()
    .update(apiRequests)
    .set({ deletedAt: now(), dirty: true, updatedAt: now() })
    .where(eq(apiRequests.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
}

// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────

export function createEnvironment(input: { workspaceId: string; name: string }) {
  const id = uuid();
  const ts = now();
  getDb()
    .insert(environments)
    .values({
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      sortOrder: 0,
      variables: '[]',
      dirty: true,
      remoteRevision: '0',
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  markWorkspaceDirty(input.workspaceId);
  return getEnvironment(id);
}

export function getEnvironment(id: string) {
  const row = getDb().select().from(environments).where(eq(environments.id, id)).get();
  return row ? parseEnvironment(row) : null;
}

export function listEnvironments(workspaceId: string) {
  const rows = getDb()
    .select()
    .from(environments)
    .where(and(eq(environments.workspaceId, workspaceId), isNull(environments.deletedAt)))
    .orderBy(asc(environments.sortOrder), asc(environments.name))
    .all();
  return rows.map(parseEnvironment);
}

export function updateEnvironment(
  id: string,
  patch: Partial<{ name: string; sortOrder: number; variables: unknown }>,
) {
  const existing = getDb().select().from(environments).where(eq(environments.id, id)).get();
  if (!existing) return null;

  getDb()
    .update(environments)
    .set({
      name: patch.name ?? existing.name,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      variables: patch.variables !== undefined ? JSON.stringify(patch.variables) : existing.variables,
      dirty: true,
      updatedAt: now(),
    })
    .where(eq(environments.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
  return getEnvironment(id);
}

export function softDeleteEnvironment(id: string) {
  const existing = getDb().select().from(environments).where(eq(environments.id, id)).get();
  if (!existing) return;
  getDb()
    .update(environments)
    .set({ deletedAt: now(), dirty: true, updatedAt: now() })
    .where(eq(environments.id, id))
    .run();
  markWorkspaceDirty(existing.workspaceId);
}

// ─────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────

export function recordHistory(input: {
  workspaceId: string;
  requestId: string | null;
  method: string;
  url: string;
  requestSnapshot: object;
  statusCode: number | null;
  responseHeaders: [string, string][] | null;
  responseBody: Buffer | null;
  responseSizeBytes: number | null;
  responseContentType: string | null;
  startedAt: number;
  durationMs: number;
  errorCode: string | null;
}) {
  const id = uuid();
  // Mark dirty so the sync engine picks it up. The sync push only ships
  // metadata (no response body bytes) — see engine.ts.
  const dirty = isCloudWorkspace(input.workspaceId);
  getDb()
    .insert(historyEntries)
    .values({
      id,
      workspaceId: input.workspaceId,
      requestId: input.requestId,
      method: input.method,
      url: input.url,
      requestSnapshot: JSON.stringify(input.requestSnapshot),
      statusCode: input.statusCode,
      responseHeaders: input.responseHeaders ? JSON.stringify(input.responseHeaders) : null,
      responseBody: input.responseBody,
      responseSizeBytes: input.responseSizeBytes,
      responseContentType: input.responseContentType,
      startedAt: input.startedAt,
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      dirty,
      remoteRevision: '0',
      deletedAt: null,
      pinned: false,
    })
    .run();
  return id;
}

export function listHistory(input: {
  workspaceId: string;
  limit: number;
  cursor?: number;  // startedAt cursor for pagination
  search?: string;
}) {
  const conditions = [
    eq(historyEntries.workspaceId, input.workspaceId),
    isNull(historyEntries.deletedAt),
  ];
  if (input.cursor !== undefined) {
    conditions.push(sql`${historyEntries.startedAt} < ${input.cursor}`);
  }
  if (input.search) {
    conditions.push(
      or(
        like(historyEntries.url, `%${input.search}%`),
        like(historyEntries.method, `%${input.search.toUpperCase()}%`),
      )!,
    );
  }
  const rows = getDb()
    .select({
      id: historyEntries.id,
      requestId: historyEntries.requestId,
      workspaceId: historyEntries.workspaceId,
      method: historyEntries.method,
      url: historyEntries.url,
      requestSnapshot: historyEntries.requestSnapshot,
      statusCode: historyEntries.statusCode,
      startedAt: historyEntries.startedAt,
      durationMs: historyEntries.durationMs,
      errorCode: historyEntries.errorCode,
      pinned: historyEntries.pinned,
    })
    .from(historyEntries)
    .where(and(...conditions))
    .orderBy(desc(historyEntries.startedAt))
    .limit(input.limit)
    .all();
  return rows;
}

export function getHistoryEntry(id: string) {
  return getDb().select().from(historyEntries).where(eq(historyEntries.id, id)).get();
}

export function clearHistory(workspaceId: string) {
  // For cloud workspaces, soft-delete + mark dirty so the deletions propagate
  // to backend via the sync engine. For local-only workspaces, hard delete is
  // fine — there's nothing to sync to.
  if (isCloudWorkspace(workspaceId)) {
    const result = getDb()
      .update(historyEntries)
      .set({ deletedAt: now(), dirty: true })
      .where(and(eq(historyEntries.workspaceId, workspaceId), isNull(historyEntries.deletedAt)))
      .run();
    return result.changes;
  }
  const result = getDb()
    .delete(historyEntries)
    .where(eq(historyEntries.workspaceId, workspaceId))
    .run();
  return result.changes;
}

// ─────────────────────────────────────────────────────────
// Conflict log
// ─────────────────────────────────────────────────────────

export function recordConflict(input: {
  workspaceId: string;
  table: 'collection' | 'request' | 'environment';
  rowId: string;
  previousState: object;
  overwrittenByName: string;
  overwrittenByUserId: string;
  overwrittenAt: number;
}) {
  const id = uuid();
  getDb()
    .insert(conflictLog)
    .values({
      id,
      workspaceId: input.workspaceId,
      table: input.table,
      rowId: input.rowId,
      previousState: JSON.stringify(input.previousState),
      overwrittenByName: input.overwrittenByName,
      overwrittenByUserId: input.overwrittenByUserId,
      overwrittenAt: input.overwrittenAt,
      dismissedAt: null,
    })
    .run();
  return id;
}

export function listActiveConflicts(workspaceId: string) {
  return getDb()
    .select()
    .from(conflictLog)
    .where(and(eq(conflictLog.workspaceId, workspaceId), isNull(conflictLog.dismissedAt)))
    .orderBy(desc(conflictLog.overwrittenAt))
    .all();
}

export function dismissConflict(id: string) {
  getDb()
    .update(conflictLog)
    .set({ dismissedAt: now() })
    .where(eq(conflictLog.id, id))
    .run();
}

// ─────────────────────────────────────────────────────────
// Sync helpers
// ─────────────────────────────────────────────────────────

export function listDirtyRows(workspaceId: string) {
  const [colls, reqs, envs, hist] = [
    getDb()
      .select()
      .from(collections)
      .where(and(eq(collections.workspaceId, workspaceId), eq(collections.dirty, true)))
      .all(),
    getDb()
      .select()
      .from(apiRequests)
      .where(and(eq(apiRequests.workspaceId, workspaceId), eq(apiRequests.dirty, true)))
      .all(),
    getDb()
      .select()
      .from(environments)
      .where(and(eq(environments.workspaceId, workspaceId), eq(environments.dirty, true)))
      .all(),
    getDb()
      .select()
      .from(historyEntries)
      .where(and(eq(historyEntries.workspaceId, workspaceId), eq(historyEntries.dirty, true)))
      .all(),
  ];
  return { collections: colls, requests: reqs, environments: envs, history: hist };
}

/**
 * Check whether a workspace participates in cloud sync (not local-only).
 * Returns false if the workspace doesn't exist — fail safe to local.
 */
function isCloudWorkspace(workspaceId: string): boolean {
  const ws = getDb().select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  return !!ws && !ws.localOnly;
}

export function clearDirtyFlags(
  workspaceId: string,
  applied: Array<{ table: string; rowId: string; revision: string }>,
) {
  // After server confirms push, clear dirty=0 and write remoteRevision on the
  // applied rows. We do this in a transaction.
  const db = getDb();
  db.transaction((tx) => {
    for (const a of applied) {
      const table =
        a.table === 'collection'
          ? collections
          : a.table === 'request'
            ? apiRequests
            : a.table === 'environment'
              ? environments
              : historyEntries;
      tx
        .update(table)
        .set({ dirty: false, remoteRevision: a.revision })
        .where(eq(table.id, a.rowId))
        .run();
    }
    // Workspace dirty flag stays on if any other tables still have dirty=1.
    const stillDirty = countDirtyTx(tx, workspaceId);
    if (stillDirty === 0) {
      tx.update(workspaces).set({ dirty: false }).where(eq(workspaces.id, workspaceId)).run();
    }
  });
}

function countDirtyTx(tx: any, workspaceId: string): number {
  const c1 = tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), eq(collections.dirty, true)))
    .get();
  const c2 = tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(apiRequests)
    .where(and(eq(apiRequests.workspaceId, workspaceId), eq(apiRequests.dirty, true)))
    .get();
  const c3 = tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(environments)
    .where(and(eq(environments.workspaceId, workspaceId), eq(environments.dirty, true)))
    .get();
  const c4 = tx
    .select({ count: sql<number>`COUNT(*)` })
    .from(historyEntries)
    .where(and(eq(historyEntries.workspaceId, workspaceId), eq(historyEntries.dirty, true)))
    .get();
  return (c1?.count ?? 0) + (c2?.count ?? 0) + (c3?.count ?? 0) + (c4?.count ?? 0);
}

export function applyPulledChange(
  workspaceId: string,
  change: {
    op: 'upsert' | 'delete';
    table: 'collection' | 'request' | 'environment' | 'history';
    rowId: string;
    revision: string;
    data?: Record<string, unknown>;
  },
): { conflict: { previousState: object } | null } {
  // Apply a change received from server pull.
  // If local row has dirty=1 and revision < incoming, this is an overwrite
  // (the conflict log on backend already captured prior state, but we also
  // record locally so the UI can show banner).
  const db = getDb();
  return db.transaction((tx) => {
    let conflict: { previousState: object } | null = null;

    if (change.table === 'collection') {
      const existing = tx
        .select()
        .from(collections)
        .where(eq(collections.id, change.rowId))
        .get();
      if (existing?.dirty) {
        conflict = { previousState: parseCollection(existing) };
      }
      if (change.op === 'delete') {
        tx
          .update(collections)
          .set({ deletedAt: now(), dirty: false, remoteRevision: change.revision })
          .where(eq(collections.id, change.rowId))
          .run();
      } else {
        const d = change.data ?? {};
        if (existing) {
          tx
            .update(collections)
            .set({
              parentId: (d.parentId as string | null) ?? null,
              name: (d.name as string) ?? existing.name,
              description: (d.description as string | undefined) ?? existing.description ?? '',
              sortOrder: (d.sortOrder as number) ?? existing.sortOrder,
              variables: JSON.stringify(d.variables ?? []),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              updatedAt: now(),
            })
            .where(eq(collections.id, change.rowId))
            .run();
        } else {
          tx
            .insert(collections)
            .values({
              id: change.rowId,
              workspaceId,
              parentId: (d.parentId as string | null) ?? null,
              name: (d.name as string) ?? 'Untitled',
              description: (d.description as string | undefined) ?? '',
              sortOrder: (d.sortOrder as number) ?? 0,
              variables: JSON.stringify(d.variables ?? []),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              createdAt: now(),
              updatedAt: now(),
            })
            .run();
        }
      }
    } else if (change.table === 'request') {
      const existing = tx
        .select()
        .from(apiRequests)
        .where(eq(apiRequests.id, change.rowId))
        .get();
      if (existing?.dirty) {
        conflict = { previousState: parseRequest(existing) };
      }
      if (change.op === 'delete') {
        tx
          .update(apiRequests)
          .set({ deletedAt: now(), dirty: false, remoteRevision: change.revision })
          .where(eq(apiRequests.id, change.rowId))
          .run();
      } else {
        const d = change.data ?? {};
        if (existing) {
          tx
            .update(apiRequests)
            .set({
              collectionId: (d.collectionId as string | null) ?? null,
              name: (d.name as string) ?? existing.name,
              method: (d.method as string) ?? existing.method,
              url: (d.url as string) ?? existing.url,
              headers: JSON.stringify(d.headers ?? []),
              queryParams: JSON.stringify(d.queryParams ?? []),
              bodyType: (d.bodyType as string) ?? existing.bodyType,
              body: JSON.stringify(d.body ?? {}),
              auth: JSON.stringify(d.auth ?? { type: 'none' }),
              preRequestScript:
                (d.preRequestScript as string | undefined) ?? existing.preRequestScript ?? '',
              postResponseScript:
                (d.postResponseScript as string | undefined) ?? existing.postResponseScript ?? '',
              description:
                (d.description as string | undefined) ?? existing.description ?? '',
              examples: JSON.stringify(d.examples ?? safeJsonParse(existing.examples, [])),
              sortOrder: (d.sortOrder as number) ?? existing.sortOrder,
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              updatedAt: now(),
            })
            .where(eq(apiRequests.id, change.rowId))
            .run();
        } else {
          tx
            .insert(apiRequests)
            .values({
              id: change.rowId,
              workspaceId,
              collectionId: (d.collectionId as string | null) ?? null,
              name: (d.name as string) ?? 'Untitled',
              method: (d.method as string) ?? 'GET',
              url: (d.url as string) ?? '',
              headers: JSON.stringify(d.headers ?? []),
              queryParams: JSON.stringify(d.queryParams ?? []),
              bodyType: (d.bodyType as string) ?? 'none',
              body: JSON.stringify(d.body ?? {}),
              auth: JSON.stringify(d.auth ?? { type: 'none' }),
              preRequestScript: (d.preRequestScript as string | undefined) ?? '',
              postResponseScript: (d.postResponseScript as string | undefined) ?? '',
              description: (d.description as string | undefined) ?? '',
              examples: JSON.stringify(d.examples ?? []),
              sortOrder: (d.sortOrder as number) ?? 0,
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              createdAt: now(),
              updatedAt: now(),
            })
            .run();
        }
      }
    } else if (change.table === 'environment') {
      const existing = tx
        .select()
        .from(environments)
        .where(eq(environments.id, change.rowId))
        .get();
      if (existing?.dirty) {
        conflict = { previousState: parseEnvironment(existing) };
      }
      if (change.op === 'delete') {
        tx
          .update(environments)
          .set({ deletedAt: now(), dirty: false, remoteRevision: change.revision })
          .where(eq(environments.id, change.rowId))
          .run();
      } else {
        const d = change.data ?? {};
        if (existing) {
          tx
            .update(environments)
            .set({
              name: (d.name as string) ?? existing.name,
              sortOrder: (d.sortOrder as number) ?? existing.sortOrder,
              variables: JSON.stringify(d.variables ?? []),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              updatedAt: now(),
            })
            .where(eq(environments.id, change.rowId))
            .run();
        } else {
          tx
            .insert(environments)
            .values({
              id: change.rowId,
              workspaceId,
              name: (d.name as string) ?? 'Environment',
              sortOrder: (d.sortOrder as number) ?? 0,
              variables: JSON.stringify(d.variables ?? []),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
              createdAt: now(),
              updatedAt: now(),
            })
            .run();
        }
      }
    } else if (change.table === 'history') {
      // History rows are mostly append-only; pinned flag is the only edit.
      // Response body bytes are never round-tripped through the backend, so
      // existing local responseBody (if any) is preserved on update.
      const existing = tx
        .select()
        .from(historyEntries)
        .where(eq(historyEntries.id, change.rowId))
        .get();
      if (change.op === 'delete') {
        tx
          .update(historyEntries)
          .set({ deletedAt: now(), dirty: false, remoteRevision: change.revision })
          .where(eq(historyEntries.id, change.rowId))
          .run();
      } else {
        const d = change.data ?? {};
        if (existing) {
          tx
            .update(historyEntries)
            .set({
              pinned: Boolean(d.pinned ?? existing.pinned),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
            })
            .where(eq(historyEntries.id, change.rowId))
            .run();
        } else {
          tx
            .insert(historyEntries)
            .values({
              id: change.rowId,
              workspaceId,
              requestId: (d.requestId as string | null) ?? null,
              method: (d.method as string) ?? 'GET',
              url: (d.url as string) ?? '',
              requestSnapshot: JSON.stringify(d.requestSnapshot ?? {}),
              statusCode: (d.statusCode as number | null) ?? null,
              responseHeaders:
                d.responseHeaders != null ? JSON.stringify(d.responseHeaders) : null,
              // Body bytes aren't synced.
              responseBody: null,
              responseSizeBytes: (d.responseSizeBytes as number | null) ?? null,
              responseContentType: (d.responseContentType as string | null) ?? null,
              startedAt: (d.startedAt as number) ?? Date.now(),
              durationMs: (d.durationMs as number) ?? 0,
              errorCode: (d.errorCode as string | null) ?? null,
              pinned: Boolean(d.pinned ?? false),
              dirty: false,
              remoteRevision: change.revision,
              deletedAt: null,
            })
            .run();
        }
      }
    }

    return { conflict };
  });
}

export function setWorkspaceRemoteRevision(workspaceId: string, revision: string) {
  getDb()
    .update(workspaces)
    .set({ remoteRevision: revision })
    .where(eq(workspaces.id, workspaceId))
    .run();
}

// ─────────────────────────────────────────────────────────
// App state — uses raw SQLite for the single-table key-value store
// ─────────────────────────────────────────────────────────

import { getRawDb } from './connection';

export function getState(key: string): string | null {
  const stmt = getRawDb().prepare('SELECT value FROM app_state WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setState(key: string, value: string) {
  getRawDb()
    .prepare('INSERT INTO app_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}
export function deleteState(key: string) {
  getRawDb().prepare('DELETE FROM app_state WHERE key = ?').run(key);
}

// ─────────────────────────────────────────────────────────
// Globals — per-device key/value scratch space settable from pre/post scripts.
// Stored in app_state under a 'globals.' prefix so they survive restarts.
// Values are JSON-encoded so they round-trip non-string types correctly.
// ─────────────────────────────────────────────────────────

const GLOBAL_PREFIX = 'globals.';

export function listGlobals(): Record<string, unknown> {
  const rows = getRawDb()
    .prepare(`SELECT key, value FROM app_state WHERE key LIKE ?`)
    .all(`${GLOBAL_PREFIX}%`) as Array<{ key: string; value: string }>;
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const name = row.key.slice(GLOBAL_PREFIX.length);
    try {
      out[name] = JSON.parse(row.value);
    } catch {
      out[name] = row.value;
    }
  }
  return out;
}

export function getGlobal(key: string): unknown {
  const raw = getState(GLOBAL_PREFIX + key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setGlobal(key: string, value: unknown): void {
  setState(GLOBAL_PREFIX + key, JSON.stringify(value ?? null));
}

export function deleteGlobal(key: string): void {
  deleteState(GLOBAL_PREFIX + key);
}

// ─────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────

function markWorkspaceDirty(workspaceId: string) {
  // Only set dirty if workspace is not localOnly (no point in tracking for unsynced)
  const ws = getDb().select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!ws || ws.localOnly) return;
  if (!ws.dirty) {
    getDb()
      .update(workspaces)
      .set({ dirty: true, updatedAt: now() })
      .where(eq(workspaces.id, workspaceId))
      .run();
  }
}

function parseCollection(row: typeof collections.$inferSelect) {
  return {
    ...row,
    variables: safeJsonParse(row.variables, []),
  };
}

function parseRequest(row: typeof apiRequests.$inferSelect) {
  return {
    ...row,
    headers: safeJsonParse(row.headers, []),
    queryParams: safeJsonParse(row.queryParams, []),
    body: safeJsonParse(row.body, { type: 'none' }),
    auth: safeJsonParse(row.auth, { type: 'none' }),
    examples: safeJsonParse(row.examples, []),
  };
}

function parseEnvironment(row: typeof environments.$inferSelect) {
  return {
    ...row,
    variables: safeJsonParse(row.variables, []),
  };
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
