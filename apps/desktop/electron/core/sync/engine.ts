// Local sync engine.
//
// Responsibilities:
//   1. Watch local DB for dirty rows; debounce-push every 5s
//   2. Poll-pull every 30s
//   3. Maintain SSE stream for real-time push notifications
//   4. Handle 409 conflict via pull-first-then-repush
//   5. Emit `sync:stateChanged`, `data:changed`, `sync:conflictDetected` events
//   6. Update conflict log when local dirty changes get overwritten by pulls

import { BrowserWindow } from 'electron';
import {
  SYNC_PULL_INTERVAL_MS,
  SYNC_PUSH_DEBOUNCE_MS,
  type SyncChange,
  type SyncPullOutput,
  type SyncPushOutput,
} from '@volt/shared';

import {
  applyPulledChange,
  clearDirtyFlags,
  listDirtyRows,
  listWorkspaces,
  recordConflict,
  setWorkspaceRemoteRevision,
} from '../db/queries';
import { authedFetch, currentSessionToken, getApiBase } from '../auth/manager';

type SyncState = 'offline' | 'syncing' | 'synced' | 'conflict' | 'error';

let pushTimer: NodeJS.Timeout | null = null;
let pullTimer: NodeJS.Timeout | null = null;
let sseControllers = new Map<string, AbortController>();
let currentState: SyncState = 'offline';
let lastSyncedAt: number | null = null;
let lastError: string | undefined;

// ─────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────

export function startSync() {
  if (!currentSessionToken()) {
    setState('offline');
    return;
  }
  setState('synced');
  schedulePush();
  schedulePull();
  openStreams();
}

export function stopSync() {
  if (pushTimer) clearInterval(pushTimer);
  if (pullTimer) clearInterval(pullTimer);
  pushTimer = null;
  pullTimer = null;
  for (const controller of sseControllers.values()) controller.abort();
  sseControllers.clear();
  setState('offline');
}

/**
 * Called from IPC handlers after any local write — triggers a push soon
 * (within debounce window) rather than waiting for the interval.
 */
export function notifyDirty() {
  if (!currentSessionToken()) return;
  // The schedulePush interval already runs; this is a hint that work exists.
  // A more aggressive implementation would reset the timer to push now.
  // For MVP, the 5s interval is fine.
}

// ─────────────────────────────────────────────────────────
// Push loop
// ─────────────────────────────────────────────────────────

function schedulePush() {
  pushTimer = setInterval(() => {
    void runPushOnce();
  }, SYNC_PUSH_DEBOUNCE_MS);
}

async function runPushOnce() {
  if (currentState === 'syncing') return; // already in progress
  const all = listWorkspaces();
  const workspacesToSync = all.filter((w) => !w.localOnly && w.dirty);
  if (workspacesToSync.length === 0) {
    // Loud diagnostic: explain why nothing was pushed. Only log once per
    // 10s window so this doesn't drown the terminal.
    if (Date.now() - (lastIdleLogAt ?? 0) > 10_000) {
      lastIdleLogAt = Date.now();
      const totals = {
        total: all.length,
        localOnly: all.filter((w) => w.localOnly).length,
        cloudClean: all.filter((w) => !w.localOnly && !w.dirty).length,
        cloudDirty: all.filter((w) => !w.localOnly && w.dirty).length,
        loggedIn: !!currentSessionToken(),
      };
      console.log('[sync] nothing to push', totals);
    }
    return;
  }

  for (const ws of workspacesToSync) {
    try {
      console.log(`[sync] pushing workspace ${ws.id} (${ws.name}) baseRev=${ws.remoteRevision}`);
      await pushWorkspace(ws.id, ws.remoteRevision);
      console.log(`[sync] push ok for ${ws.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync] push FAILED for ${ws.id}:`, msg);
      lastError = msg;
      setState('error');
    }
  }
}

let lastIdleLogAt: number | null = null;

async function pushWorkspace(workspaceId: string, baseRevision: string): Promise<void> {
  setState('syncing');
  const dirty = listDirtyRows(workspaceId);
  const changes: SyncChange[] = [
    ...dirty.collections.map<SyncChange>((c) =>
      c.deletedAt
        ? { op: 'delete', table: 'collection', rowId: c.id }
        : {
            op: 'upsert',
            table: 'collection',
            rowId: c.id,
            data: {
              id: c.id,
              parentId: c.parentId,
              name: c.name,
              description: c.description ?? '',
              sortOrder: c.sortOrder,
              variables: JSON.parse(c.variables),
            },
          },
    ),
    ...dirty.requests.map<SyncChange>((r) =>
      r.deletedAt
        ? { op: 'delete', table: 'request', rowId: r.id }
        : {
            op: 'upsert',
            table: 'request',
            rowId: r.id,
            data: {
              id: r.id,
              collectionId: r.collectionId,
              name: r.name,
              method: r.method,
              url: r.url,
              headers: JSON.parse(r.headers),
              queryParams: JSON.parse(r.queryParams),
              bodyType: r.bodyType,
              body: JSON.parse(r.body),
              auth: JSON.parse(r.auth),
              preRequestScript: r.preRequestScript,
              postResponseScript: r.postResponseScript,
              description: r.description ?? '',
              examples: safeParse(r.examples, []),
              sortOrder: r.sortOrder,
            },
          },
    ),
    ...dirty.environments.map<SyncChange>((e) =>
      e.deletedAt
        ? { op: 'delete', table: 'environment', rowId: e.id }
        : {
            op: 'upsert',
            table: 'environment',
            rowId: e.id,
            data: {
              id: e.id,
              name: e.name,
              sortOrder: e.sortOrder,
              variables: JSON.parse(e.variables),
            },
          },
    ),
    // History rows: metadata only (no response body bytes leave the device).
    ...dirty.history.map<SyncChange>((h) =>
      h.deletedAt
        ? { op: 'delete', table: 'history', rowId: h.id }
        : {
            op: 'upsert',
            table: 'history',
            rowId: h.id,
            data: {
              id: h.id,
              requestId: h.requestId,
              method: h.method,
              url: h.url,
              requestSnapshot: safeParse(h.requestSnapshot, {}),
              statusCode: h.statusCode,
              responseHeaders: h.responseHeaders ? safeParse(h.responseHeaders, null) : null,
              responseSizeBytes: h.responseSizeBytes,
              responseContentType: h.responseContentType,
              startedAt: h.startedAt,
              durationMs: h.durationMs,
              errorCode: h.errorCode,
              pinned: h.pinned,
            },
          },
    ),
  ];

  if (changes.length === 0) {
    setState('synced');
    return;
  }

  const res = await authedFetch('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ workspaceId, baseRevision, changes }),
  });

  if (res.status === 409) {
    // Stale baseRevision — pull first, then will retry on next push tick.
    const body = (await res.json()) as { currentRevision: string };
    setWorkspaceRemoteRevision(workspaceId, body.currentRevision);
    await pullWorkspace(workspaceId);
    return; // next interval will re-push remaining dirty
  }

  if (!res.ok) {
    throw new Error(`Push failed: ${res.status}`);
  }

  const result = (await res.json()) as SyncPushOutput;
  clearDirtyFlags(workspaceId, result.applied);
  setWorkspaceRemoteRevision(workspaceId, result.newRevision);
  lastSyncedAt = Date.now();
  setState('synced');
  emitDataChanged(workspaceId);
}

// ─────────────────────────────────────────────────────────
// Pull loop
// ─────────────────────────────────────────────────────────

function schedulePull() {
  pullTimer = setInterval(() => {
    void runPullOnce();
  }, SYNC_PULL_INTERVAL_MS);
}

async function runPullOnce() {
  if (currentState === 'syncing') return;
  const wss = listWorkspaces().filter((w) => !w.localOnly);
  for (const ws of wss) {
    try {
      await pullWorkspace(ws.id);
    } catch (err) {
      // Single workspace failing is non-fatal — log and continue
      console.error(`Pull failed for workspace ${ws.id}:`, err);
    }
  }
}

async function pullWorkspace(workspaceId: string): Promise<void> {
  const ws = listWorkspaces().find((w) => w.id === workspaceId);
  if (!ws) return;
  const since = ws.remoteRevision;

  const res = await authedFetch(`/api/sync/pull?workspaceId=${workspaceId}&since=${since}`);
  if (!res.ok) {
    if (res.status === 401) {
      // Session expired — stop syncing
      stopSync();
      return;
    }
    throw new Error(`Pull failed: ${res.status}`);
  }
  const data = (await res.json()) as SyncPullOutput;
  if (data.changes.length === 0 && data.currentRevision === since) {
    return; // nothing new
  }

  const conflicts: Array<{ table: string; rowId: string; previousState: object }> = [];

  for (const change of data.changes) {
    const result = applyPulledChange(workspaceId, change);
    if (result.conflict) {
      conflicts.push({
        table: change.table,
        rowId: change.rowId,
        previousState: result.conflict.previousState,
      });
    }
  }

  setWorkspaceRemoteRevision(workspaceId, data.currentRevision);

  // Record overwrites in local conflict log (also exists on server, but local
  // copy makes UI banner offline-resilient).
  if (conflicts.length > 0) {
    // We don't know overwrittenByName here without an extra fetch; fall back to "Teammate"
    for (const c of conflicts) {
      recordConflict({
        workspaceId,
        table: c.table as 'collection' | 'request' | 'environment',
        rowId: c.rowId,
        previousState: c.previousState,
        overwrittenByName: 'A teammate',
        overwrittenByUserId: '00000000-0000-0000-0000-000000000000',
        overwrittenAt: Date.now(),
      });
      emitConflict(workspaceId, c.table, c.rowId);
    }
    setState('conflict');
  } else {
    lastSyncedAt = Date.now();
    setState('synced');
  }

  emitDataChanged(workspaceId);
}

// ─────────────────────────────────────────────────────────
// SSE streams — one per workspace
// ─────────────────────────────────────────────────────────

function openStreams() {
  const wss = listWorkspaces().filter((w) => !w.localOnly);
  for (const ws of wss) {
    if (sseControllers.has(ws.id)) continue;
    openStream(ws.id);
  }
}

function openStream(workspaceId: string) {
  const token = currentSessionToken();
  if (!token) return;

  const controller = new AbortController();
  sseControllers.set(workspaceId, controller);

  void (async () => {
    try {
      // EventSource doesn't ship in Node natively; we use fetch + manual chunk parsing.
      // This is robust enough for SSE's simple format.
      const res = await fetch(
        `${getApiBase()}/api/sync/stream?workspaceId=${workspaceId}&token=${token}`,
        {
          signal: controller.signal,
          headers: { Accept: 'text/event-stream' },
        },
      );
      if (!res.ok || !res.body) {
        // Will retry via reconnect
        scheduleSseReconnect(workspaceId);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const evt of events) {
          handleSseEvent(workspaceId, evt);
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // "other side closed" / UND_ERR_SOCKET is normal when the backend
      // restarts or the connection is idle-pruned. We auto-reconnect below.
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code === 'UND_ERR_SOCKET') {
        console.log('[sync] SSE disconnected, will reconnect');
      } else {
        console.warn('[sync] SSE error:', err);
      }
    } finally {
      sseControllers.delete(workspaceId);
      if (!controller.signal.aborted) scheduleSseReconnect(workspaceId);
    }
  })();
}

function scheduleSseReconnect(workspaceId: string) {
  setTimeout(() => {
    if (currentSessionToken()) openStream(workspaceId);
  }, 5_000);
}

function handleSseEvent(workspaceId: string, rawEvent: string) {
  const lines = rawEvent.split('\n').filter((l) => l.length > 0);
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'change') {
      // Server says "new changes available" — trigger pull immediately
      void pullWorkspace(workspaceId);
    }
    // heartbeat: do nothing, keep connection alive
  } catch {
    /* ignore malformed */
  }
}

// ─────────────────────────────────────────────────────────
// State + event emission
// ─────────────────────────────────────────────────────────

function setState(next: SyncState) {
  if (next === currentState) return;
  currentState = next;
  if (next !== 'error') lastError = undefined;
  emitStateChanged();
}

function getPendingChangesCount(): number {
  return listWorkspaces()
    .filter((w) => !w.localOnly)
    .reduce((sum, w) => {
      if (!w.dirty) return sum;
      const d = listDirtyRows(w.id);
      return sum + d.collections.length + d.requests.length + d.environments.length;
    }, 0);
}

function emitStateChanged() {
  broadcast({
    type: 'sync:stateChanged',
    state: currentState,
    pendingChanges: getPendingChangesCount(),
  });
}

function emitDataChanged(workspaceId: string) {
  broadcast({ type: 'data:changed', workspaceId, table: 'request' });
  broadcast({ type: 'data:changed', workspaceId, table: 'collection' });
  broadcast({ type: 'data:changed', workspaceId, table: 'environment' });
}

function emitConflict(workspaceId: string, table: string, rowId: string) {
  broadcast({
    type: 'sync:conflictDetected',
    workspaceId,
    rowId,
    table,
    overwrittenByName: 'A teammate',
  });
}

function broadcast(event: object) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('volt:event', event);
  }
}

export function getSyncStatus() {
  return {
    state: currentState,
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
    pendingChanges: getPendingChangesCount(),
    errorMessage: lastError,
  };
}

export async function forceSync(workspaceId?: string) {
  if (workspaceId) {
    const ws = listWorkspaces().find((w) => w.id === workspaceId);
    if (ws && !ws.localOnly) {
      await pushWorkspace(workspaceId, ws.remoteRevision);
      await pullWorkspace(workspaceId);
    }
  } else {
    await runPushOnce();
    await runPullOnce();
  }
}

function safeParse<T>(s: string | null, fallback: T): T {
  if (s == null) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
