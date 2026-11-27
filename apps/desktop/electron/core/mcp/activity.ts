// In-memory record of who is using the local MCP server and what they did,
// shown in the app's MCP panel. Nothing here is persisted: it resets when
// Volt restarts.
//
// Clients are identified by the Mcp-Session-Id we hand out on `initialize`
// (with the clientInfo they sent). A client that kept a session id from
// before a restart shows up as an unidentified session until it reconnects.

import { BrowserWindow } from 'electron';

const MAX_CALLS = 300;
const MAX_TEXT = 4000;
/** A client seen within this window counts as connected. */
const ACTIVE_WINDOW_MS = 5 * 60_000;

export interface McpClient {
  sessionId: string;
  name: string;
  version: string | null;
  protocolVersion: string | null;
  userAgent: string | null;
  connectedAt: number;
  lastSeenAt: number;
  callCount: number;
  closed: boolean;
}

export interface McpCall {
  id: number;
  at: number;
  sessionId: string | null;
  clientName: string;
  tool: string;
  args: string;
  ok: boolean;
  error: string | null;
  result: string | null;
  durationMs: number;
}

const clients = new Map<string, McpClient>();
const calls: McpCall[] = [];
let nextCallId = 1;

export function registerClient(
  sessionId: string,
  info: { name?: unknown; version?: unknown } | undefined,
  protocolVersion: string | null,
  userAgent: string | null,
) {
  const now = Date.now();
  clients.set(sessionId, {
    sessionId,
    name: typeof info?.name === 'string' && info.name ? info.name : 'Unknown client',
    version: typeof info?.version === 'string' ? info.version : null,
    protocolVersion,
    userAgent,
    connectedAt: now,
    lastSeenAt: now,
    callCount: 0,
    closed: false,
  });
  notifyRenderer();
}

/** Mark a session as active; creates a placeholder for unknown session ids. */
export function touchClient(sessionId: string | null, userAgent: string | null): McpClient | null {
  if (!sessionId) return null;
  let c = clients.get(sessionId);
  if (!c) {
    c = {
      sessionId,
      name: 'Unidentified session',
      version: null,
      protocolVersion: null,
      userAgent,
      connectedAt: Date.now(),
      lastSeenAt: Date.now(),
      callCount: 0,
      closed: false,
    };
    clients.set(sessionId, c);
  }
  c.lastSeenAt = Date.now();
  c.closed = false;
  return c;
}

export function closeClient(sessionId: string) {
  const c = clients.get(sessionId);
  if (!c) return;
  c.closed = true;
  notifyRenderer();
}

export function recordCall(entry: {
  sessionId: string | null;
  userAgent: string | null;
  tool: string;
  args: unknown;
  ok: boolean;
  error?: string | null;
  result?: unknown;
  durationMs: number;
}) {
  const client = entry.sessionId ? clients.get(entry.sessionId) : undefined;
  if (client) client.callCount += 1;
  calls.unshift({
    id: nextCallId++,
    at: Date.now(),
    sessionId: entry.sessionId,
    clientName: client?.name ?? entry.userAgent ?? 'Unknown client',
    tool: entry.tool,
    args: clip(entry.args),
    ok: entry.ok,
    error: entry.error ?? null,
    result: entry.result === undefined ? null : clip(entry.result),
    durationMs: Math.round(entry.durationMs),
  });
  if (calls.length > MAX_CALLS) calls.length = MAX_CALLS;
  notifyRenderer();
}

export function getActivity() {
  const now = Date.now();
  return {
    clients: [...clients.values()]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((c) => ({ ...c, active: !c.closed && now - c.lastSeenAt < ACTIVE_WINDOW_MS })),
    calls: [...calls],
  };
}

export function clearActivity() {
  calls.length = 0;
  for (const [id, c] of clients) {
    if (c.closed) clients.delete(id);
    else c.callCount = 0;
  }
  notifyRenderer();
}

function clip(value: unknown): string {
  let s: string;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    s = String(value);
  }
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}\n… (${s.length - MAX_TEXT} more chars)` : s;
}

// Coalesce bursts (an agent firing many calls) into one renderer refetch.
let notifyTimer: NodeJS.Timeout | null = null;
function notifyRenderer() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('volt:event', { kind: 'mcp:activity' });
    }
  }, 150);
}
