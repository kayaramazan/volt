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
  port: readStoredPort(),
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
    srv.close(() => {
      state.server = null;
      broadcastStatus();
      resolve({ running: false });
    });
  });
}

export function setAutostart(on: boolean) {
  setState(STATE_AUTOSTART_KEY, on ? '1' : '0');
}

// Called from main.ts after DB is ready.
export async function bootMockServer() {
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
  for (const m of getAllActiveMocks()) {
    if (m.method !== '*' && m.method.toUpperCase() !== upperMethod) continue;
    if (matchPath(m.pathPattern, urlPath)) return m;
  }
  return null;
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
    return patternToRegex(pattern).test(path);
  } catch {
    return false;
  }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';
  const mock = findMatchingMock(method, url.pathname);

  // Always drain the body so the connection cleanly closes.
  await drainRequest(req);

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
