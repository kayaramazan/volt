// Local HTTP mock server. Listens on a user-configurable port and answers
// incoming requests with the first matching MockDefinition found across all
// collections. Mocks live on the collection row (synced via the existing
// collection sync), so sharing a mock = sharing the collection.
//
// First milestone: method + path-pattern matching only. Body matchers and
// per-collection toggles come later.

import http from 'node:http';
import { BrowserWindow } from 'electron';

import type { MockDefinition } from '@volt/shared';
import { listCollections, listWorkspaces, getState, setState } from '../db/queries';

const STATE_PORT_KEY = 'mock.port';
const STATE_AUTOSTART_KEY = 'mock.autostart';
export const DEFAULT_PORT = 3001;

interface RuntimeState {
  server: http.Server | null;
  port: number;
  lastError: string | null;
}

const state: RuntimeState = {
  server: null,
  // Real value is read from the DB in bootMockServer(), once the DB is ready.
  port: DEFAULT_PORT,
  lastError: null,
};

function readStoredPort(): number {
  const raw = getState(STATE_PORT_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

export interface MockStatus {
  running: boolean;
  port: number;
  activeMockCount: number;
  error?: string;
}

export function getMockStatus(): MockStatus {
  return {
    running: state.server != null && state.server.listening,
    port: state.port,
    activeMockCount: safe(() => countActiveMocks(), 0),
    error: state.lastError ?? undefined,
  };
}

export async function startMockServer(
  port?: number,
): Promise<{ running: boolean; port: number; error?: string }> {
  if (state.server) {
    await stopMockServer();
  }
  const finalPort = port ?? state.port;
  state.port = finalPort;
  state.lastError = null;

  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      handleRequest(req, res).catch((e) => {
        // Defensive — handler shouldn't throw, but if it does, write a 500.
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
      });
    });
    srv.on('error', (e: NodeJS.ErrnoException) => {
      state.lastError = humanizeListenError(e, finalPort);
      state.server = null;
      broadcastStatus();
      resolve({ running: false, port: finalPort, error: state.lastError });
    });
    srv.listen(finalPort, '127.0.0.1', () => {
      state.server = srv;
      setState(STATE_PORT_KEY, String(finalPort));
      broadcastStatus();
      resolve({ running: true, port: finalPort });
    });
  });
}

export async function stopMockServer(): Promise<{ running: false }> {
  return new Promise((resolve) => {
    const srv = state.server;
    if (!srv) {
      broadcastStatus();
      resolve({ running: false });
      return;
    }
    // Detach immediately so a Stop → Start on the same port doesn't race
    // against lingering keep-alive sockets (close() alone waits for them).
    state.server = null;
    srv.close(() => {
      broadcastStatus();
      resolve({ running: false });
    });
    srv.closeAllConnections();
  });
}

export function setAutostart(on: boolean) {
  setState(STATE_AUTOSTART_KEY, on ? '1' : '0');
}

// Called from main.ts after DB is ready.
export async function bootMockServer() {
  state.port = readStoredPort();
  if (getState(STATE_AUTOSTART_KEY) === '1') {
    await startMockServer().catch(() => {
      // Boot failure is non-fatal — the user can retry from the UI.
    });
  }
}

// ─────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────

function countActiveMocks(): number {
  let total = 0;
  for (const ws of listWorkspaces() as Array<{ id: string }>) {
    for (const c of listCollections(ws.id) as Array<{ mocks?: MockDefinition[] }>) {
      const mocks = c.mocks ?? [];
      for (const m of mocks) if (m.enabled !== false) total++;
    }
  }
  return total;
}

function getAllActiveMocks(): MockDefinition[] {
  const out: MockDefinition[] = [];
  for (const ws of listWorkspaces() as Array<{ id: string }>) {
    for (const c of listCollections(ws.id) as Array<{ mocks?: MockDefinition[] }>) {
      for (const m of c.mocks ?? []) {
        if (m.enabled !== false) out.push(m);
      }
    }
  }
  return out;
}

function findMatchingMock(method: string, urlPath: string): MockDefinition | null {
  const upperMethod = method.toUpperCase();
  // Most specific first, so `/users/me` beats `/users/:id` beats `/users/*`
  // and an exact-method mock beats a `*` one, regardless of list order.
  const candidates = getAllActiveMocks()
    .filter((m) => m.method === '*' || m.method.toUpperCase() === upperMethod)
    .map((m, idx) => ({ m, idx, score: specificity(m) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  for (const { m } of candidates) {
    if (matchPath(m.pathPattern, urlPath)) return m;
  }
  return null;
}

function specificity(m: MockDefinition): number {
  const pattern = m.pathPattern ?? '';
  const params = (pattern.match(/:[A-Za-z_]\w*/g) ?? []).length;
  const wildcards = (pattern.match(/\*/g) ?? []).length;
  const literal = pattern.replace(/:[A-Za-z_]\w*/g, '').replace(/\*/g, '').length;
  return literal * 10 - params * 100 - wildcards * 1000 + (m.method === '*' ? 0 : 1);
}

/** Converts a route pattern like `/users/:id` or `/api/*` into a regex. */
function patternToRegex(pattern: string): RegExp {
  // Escape regex specials EXCEPT `:` (params) and `*` (wildcards).
  let p = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Named params: `:foo` matches a single non-slash segment.
  p = p.replace(/:[A-Za-z_]\w*/g, '([^/]+)');
  // Wildcards: `*` matches anything (greedy).
  p = p.replace(/\*/g, '.*');
  return new RegExp(`^${p}$`);
}

function matchPath(pattern: string, path: string): boolean {
  try {
    // Tolerate a missing leading slash in the pattern and a trailing slash
    // on either side (`/users` ≡ `/users/`), like Postman's mock router.
    const p = normalizePath(pattern);
    return patternToRegex(p).test(normalizePath(path));
  } catch {
    return false;
  }
}

function normalizePath(p: string): string {
  let s = p.trim();
  if (!s.startsWith('/')) s = `/${s}`;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';
  const mock = findMatchingMock(method, url.pathname);

  // Always drain the body so the connection cleanly closes.
  await drainRequest(req);

  // Browser callers (a frontend pointed at the mock) need CORS; answer the
  // preflight ourselves unless the user defined an OPTIONS mock for it.
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] ?? '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  if (!mock && method.toUpperCase() === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!mock) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'No matching mock',
        method,
        path: url.pathname,
      }),
    );
    return;
  }

  if (mock.delayMs > 0) {
    await new Promise((r) => setTimeout(r, mock.delayMs));
  }

  res.statusCode = mock.status;
  if (mock.contentType) res.setHeader('content-type', mock.contentType);
  for (const h of mock.headers ?? []) {
    if (h.key) res.setHeader(h.key, h.value);
  }
  res.end(mock.body ?? '');
}

function drainRequest(req: http.IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    req.on('data', () => undefined);
    req.on('end', () => resolve());
    req.on('error', () => resolve());
  });
}

function humanizeListenError(e: NodeJS.ErrnoException, port: number): string {
  if (e.code === 'EADDRINUSE') return `Port ${port} is already in use.`;
  if (e.code === 'EACCES') return `Permission denied binding to port ${port}.`;
  return e.message;
}

function broadcastStatus() {
  const status = getMockStatus();
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('volt:event', { kind: 'mock:status', ...status });
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
