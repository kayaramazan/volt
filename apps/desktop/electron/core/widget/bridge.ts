// macOS desktop widget bridge ("Volt Quick Run", native/VoltWidget).
//
// Electron can't host WidgetKit, so the widget is a small native extension
// embedded in Volt.app. This module is Volt's half of the contract:
//
//   • widget.json in the shared App Group container — display data only
//     (name, method, collection, last status/latency) plus the loopback
//     port + token. Never URLs, headers, bodies or secrets.
//   • a loopback HTTP server (127.0.0.1, random port, random token) the
//     widget's button intent calls: POST /run {requestId}. Volt then sends
//     the saved request through the renderer exactly like the Send button,
//     so env vars, auth and scripts apply and secrets stay inside Volt.
//   • volt://run/<id> and volt://open[/<id>] deep links (used when Volt
//     isn't running, and when the widget background is clicked).
//
// Favourites are per machine (userData/widget.json) — they are a personal
// shortcut list, not team data, so they don't sync.

import { app, type BrowserWindow, type WebContents } from 'electron';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { getActiveEnvironment, getCollection, getEnvironment, getRequest, getWorkspace } from '../db/queries';

const APP_GROUP = '2WPVK976M4.dev.volt.shared';
export const MAX_WIDGET_FAVORITES = 8;
const RUN_TIMEOUT_MS = 90_000;

interface LastRun {
  ok: boolean;
  status?: number;
  ms?: number;
  at: number;
  error?: string;
}

interface LocalState {
  favorites: string[];
  last: Record<string, LastRun>;
}

let enabled = false;
let state: LocalState = { favorites: [], last: {} };
let bridge: { port: number; token: string } | null = null;
let getWindow: () => BrowserWindow = () => {
  throw new Error('widget bridge not initialised');
};

// Renderer handshake: runs wait until the renderer has mounted its listener.
let rendererReady: WebContents | null = null;
let readyWaiters: Array<() => void> = [];
const pendingRuns = new Map<string, { resolve: (r: { ok: boolean; error?: string }) => void; timer: NodeJS.Timeout }>();

export function isWidgetSupported(): boolean {
  return enabled;
}

// ─────────────────────────────────────────────────────────
// Local state (favourites + last results)
// ─────────────────────────────────────────────────────────

function statePath() {
  return path.join(app.getPath('userData'), 'widget.json');
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), 'utf8')) as Partial<LocalState>;
    state = {
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter((x) => typeof x === 'string') : [],
      last: raw.last && typeof raw.last === 'object' ? raw.last : {},
    };
  } catch {
    state = { favorites: [], last: {} };
  }
}

function saveState() {
  try {
    writeAtomic(statePath(), JSON.stringify(state));
  } catch (err) {
    console.warn('[widget] could not save state:', (err as Error).message);
  }
}

export function getWidgetFavorites(): string[] {
  return [...state.favorites];
}

export function setWidgetFavorite(requestId: string, favorite: boolean): string[] {
  const has = state.favorites.includes(requestId);
  if (favorite && !has) {
    if (state.favorites.length >= MAX_WIDGET_FAVORITES) {
      throw new Error(`The widget holds up to ${MAX_WIDGET_FAVORITES} requests. Remove one first.`);
    }
    state.favorites.push(requestId);
  } else if (!favorite && has) {
    state.favorites = state.favorites.filter((id) => id !== requestId);
    delete state.last[requestId];
  } else {
    return getWidgetFavorites();
  }
  saveState();
  scheduleSnapshot();
  return getWidgetFavorites();
}

/** Called after every request:send — keeps the widget's status in step with the app. */
export function recordWidgetResult(
  requestId: string | null | undefined,
  output: { ok?: boolean; statusCode?: number; timing?: { totalMs?: number } | null; errorMessage?: string },
) {
  if (!requestId || !state.favorites.includes(requestId)) return;
  const status = typeof output.statusCode === 'number' ? output.statusCode : undefined;
  state.last[requestId] = {
    ok: Boolean(output.ok) && (status === undefined || status < 400),
    status,
    ms: output.timing?.totalMs ?? undefined,
    at: Date.now(),
    error: output.ok ? undefined : shortError(output.errorMessage),
  };
  saveState();
  scheduleSnapshot();
}

function recordFailure(requestId: string, error: string) {
  if (!state.favorites.includes(requestId)) return;
  state.last[requestId] = { ok: false, at: Date.now(), error: shortError(error) };
  saveState();
  scheduleSnapshot();
}

function shortError(msg: string | undefined) {
  if (!msg) return 'Failed';
  return msg.length > 60 ? `${msg.slice(0, 57)}…` : msg;
}

// ─────────────────────────────────────────────────────────
// Shared snapshot for the widget
// ─────────────────────────────────────────────────────────

function groupDir() {
  return path.join(os.homedir(), 'Library', 'Group Containers', APP_GROUP);
}

let snapshotTimer: NodeJS.Timeout | null = null;
let lastSnapshotBody = '';

/** Debounced: coalesces bursts (typing in a request name, sync pulls). */
export function scheduleSnapshot() {
  if (!enabled) return;
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    writeSnapshot();
  }, 400);
}

function buildItems() {
  const items: Array<{
    id: string;
    name: string;
    method: string;
    collection?: string;
    workspace?: string;
    last?: LastRun;
  }> = [];
  const workspaces = new Set<string>();
  for (const id of state.favorites) {
    let req: ReturnType<typeof getRequest> = null;
    try {
      req = getRequest(id);
    } catch {
      req = null;
    }
    // Deleted (locally or by a teammate): hide it but keep the favourite, so
    // an undo / re-sync brings it back.
    if (!req || (req as { deletedAt?: unknown }).deletedAt) continue;
    const r = req as { name: string; method: string; collectionId?: string | null; workspaceId: string };
    workspaces.add(r.workspaceId);
    const col = r.collectionId ? getCollection(r.collectionId) : null;
    items.push({
      id,
      name: r.name || 'Untitled request',
      method: r.method,
      collection: (col as { name?: string } | null)?.name,
      workspace: (getWorkspace(r.workspaceId) as { name?: string } | undefined)?.name,
      last: state.last[id],
    });
  }
  // Environment chip only when every favourite lives in one workspace —
  // otherwise "the" active environment is ambiguous.
  let environment: string | undefined;
  if (workspaces.size === 1) {
    const envId = getActiveEnvironment([...workspaces][0]!);
    environment = envId ? (getEnvironment(envId) as { name?: string } | null)?.name : undefined;
  }
  return { items, environment };
}

function writeSnapshot() {
  if (!enabled) return;
  try {
    const { items, environment } = buildItems();
    const body = JSON.stringify({ version: 1, environment, bridge, items });
    if (body === lastSnapshotBody) return;
    lastSnapshotBody = body;
    const snapshot = { ...(JSON.parse(body) as object), updatedAt: Date.now() };
    fs.mkdirSync(groupDir(), { recursive: true });
    writeAtomic(path.join(groupDir(), 'widget.json'), JSON.stringify(snapshot), 0o600);
    reloadWidgetTimelines();
  } catch (err) {
    console.warn('[widget] snapshot write failed:', (err as Error).message);
  }
}

function writeAtomic(file: string, data: string, mode = 0o644) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

/** WidgetKit reload via the bundled helper (Contents/MacOS/volt-widget-reload). */
function reloadWidgetTimelines() {
  const helper = path.join(path.dirname(process.execPath), 'volt-widget-reload');
  if (!fs.existsSync(helper)) return;
  execFile(helper, { timeout: 5000 }, (err) => {
    if (err) console.warn('[widget] reload helper failed:', err.message);
  });
}

// ─────────────────────────────────────────────────────────
// Running a request through the renderer
// ─────────────────────────────────────────────────────────

/** Renderer calls this (widget:ready) once its widget listener is mounted. */
export function markRendererReady(sender: WebContents) {
  rendererReady = sender;
  // A reload/navigation unmounts the listener; it re-announces itself after.
  sender.once('did-navigate', () => {
    if (rendererReady === sender) rendererReady = null;
  });
  sender.once('destroyed', () => {
    if (rendererReady === sender) rendererReady = null;
  });
  const waiters = readyWaiters;
  readyWaiters = [];
  for (const w of waiters) w();
}

function whenRendererReady(): Promise<WebContents> {
  if (rendererReady && !rendererReady.isDestroyed()) return Promise.resolve(rendererReady);
  getWindow(); // creates the window if it was closed (macOS keeps the app alive)
  return new Promise((resolve) => readyWaiters.push(() => resolve(rendererReady!)));
}

/** Renderer reports completion (widget:runResult). */
export function completeWidgetRun(runId: string, result: { ok: boolean; error?: string }) {
  const p = pendingRuns.get(runId);
  if (!p) return;
  clearTimeout(p.timer);
  pendingRuns.delete(runId);
  p.resolve(result);
}

export async function runFavorite(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const req = getRequest(requestId);
  if (!req || (req as { deletedAt?: unknown }).deletedAt) {
    recordFailure(requestId, 'Request not found');
    return { ok: false, error: 'Request not found' };
  }
  const wc = await whenRendererReady();
  const runId = crypto.randomUUID();
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const timer = setTimeout(() => {
      pendingRuns.delete(runId);
      resolve({ ok: false, error: 'Timed out' });
    }, RUN_TIMEOUT_MS);
    pendingRuns.set(runId, { resolve, timer });
    wc.send('volt:event', { kind: 'widget:run', runId, requestId });
  });
  // Failures before the request went out (unresolved var, OAuth, …) never
  // reach request:send, so record them here.
  if (!result.ok && result.error) recordFailure(requestId, result.error);
  return result;
}

// ─────────────────────────────────────────────────────────
// Loopback server for the widget's button intent
// ─────────────────────────────────────────────────────────

function startServer(): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const server = http.createServer((req, res) => {
    const reply = (code: number, body: object) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST' || req.url !== '/run') return reply(404, { error: 'not found' });
    const given = Buffer.from(String(req.headers['x-volt-widget-token'] ?? ''));
    const want = Buffer.from(token);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
      return reply(403, { error: 'forbidden' });
    }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let requestId = '';
      try {
        requestId = String((JSON.parse(raw) as { requestId?: unknown }).requestId ?? '');
      } catch {
        /* handled below */
      }
      // Only favourites can be triggered from outside the app.
      if (!state.favorites.includes(requestId)) return reply(404, { error: 'not a widget request' });
      runFavorite(requestId).then(
        (r) => reply(200, r),
        (err: Error) => reply(200, { ok: false, error: err.message }),
      );
    });
  });
  return new Promise((resolve) => {
    server.on('error', (err) => {
      console.warn('[widget] bridge server error:', err.message);
      resolve();
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') bridge = { port: addr.port, token };
      server.unref();
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────
// Deep links: volt://run/<id>, volt://open[/<id>]
// ─────────────────────────────────────────────────────────

export function handleVoltUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (url.protocol !== 'volt:') return;
  const action = url.hostname; // volt://run/<id> → host "run", path "/<id>"
  const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const win = getWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (action === 'run' && id) {
    // Show it too: when Volt was closed the user expects to see what ran.
    void whenRendererReady().then((wc) => wc.send('volt:event', { kind: 'widget:open', requestId: id }));
    if (state.favorites.includes(id)) void runFavorite(id);
  } else if (action === 'open' && id) {
    void whenRendererReady().then((wc) => wc.send('volt:event', { kind: 'widget:open', requestId: id }));
  }
}

// ─────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────

export async function initWidgetBridge(opts: { getWindow: () => BrowserWindow }) {
  getWindow = opts.getWindow;
  loadState();
  // Only the installed, signed app has the embedded extension + App Group
  // entitlement. Dev builds keep favourites but don't touch the container.
  enabled = process.platform === 'darwin' && app.isPackaged;
  if (!enabled) return;
  await startServer();
  writeSnapshot();
}
