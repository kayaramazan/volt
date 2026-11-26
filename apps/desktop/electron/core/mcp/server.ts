// Local MCP server. While Volt is open it serves the Model Context Protocol
// (Streamable HTTP transport, stateless, JSON responses only) on
//   http://127.0.0.1:<port>/mcp      (default port 7465)
// so AI agents (Claude Code, Cursor, …) can manage the API client the same
// way the UI does: browse collections, add folders/requests, import, export,
// edit environments and send saved requests.
//
//   claude mcp add --transport http volt http://127.0.0.1:7465/mcp
//
// Security: loopback-only bind, Host header must be a loopback name (DNS
// rebinding), and requests carrying a non-loopback Origin are refused, so web
// pages in a browser can't drive it.
//
// Port: VOLT_MCP_PORT env var > app_state `mcp.port` > 7465.

import http from 'node:http';
import { app } from 'electron';

import { getState } from '../db/queries';
import { MCP_TOOLS, callTool, ToolInputError } from './tools';

const DEFAULT_PORT = 7465;
const STATE_PORT_KEY = 'mcp.port';
const MAX_BODY_BYTES = 20 * 1024 * 1024; // imports can be big
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Volt is a local-first API client (like Postman). Data model: workspace → collections (folders nest via parentId) → requests. \
Start with list_workspaces, then get_collection_tree. Requests may use {{variables}} resolved from the active environment, collection variables and globals. \
send_request runs a saved request exactly like the app's Send button (active environment, auth, scripts) and records it in history. \
Changes appear in the open Volt window immediately.`;

interface RuntimeState {
  server: http.Server | null;
  port: number;
  error: string | null;
}

const state: RuntimeState = { server: null, port: DEFAULT_PORT, error: null };

function configuredPort(): number {
  const fromEnv = Number(process.env.VOLT_MCP_PORT);
  if (Number.isInteger(fromEnv) && fromEnv >= 1 && fromEnv <= 65535) return fromEnv;
  const stored = Number(getState(STATE_PORT_KEY));
  if (Number.isInteger(stored) && stored >= 1 && stored <= 65535) return stored;
  return DEFAULT_PORT;
}

export function getMcpStatus() {
  return {
    running: state.server != null && state.server.listening,
    port: state.port,
    url: `http://127.0.0.1:${state.port}/mcp`,
    error: state.error ?? undefined,
  };
}

export function startMcpServer(): Promise<void> {
  if (state.server) return Promise.resolve();
  state.port = configuredPort();
  state.error = null;

  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      handleHttp(req, res).catch((e) => {
        console.error('[mcp] handler crashed:', e);
        if (!res.headersSent) sendJson(res, 500, rpcError(null, -32603, 'Internal error'));
      });
    });
    srv.on('error', (e: NodeJS.ErrnoException) => {
      state.error =
        e.code === 'EADDRINUSE'
          ? `Port ${state.port} is already in use. Set VOLT_MCP_PORT to use another port.`
          : e.message;
      state.server = null;
      console.warn('[mcp] server failed to start:', state.error);
      resolve();
    });
    srv.listen(state.port, '127.0.0.1', () => {
      state.server = srv;
      console.log(`[mcp] listening on http://127.0.0.1:${state.port}/mcp`);
      resolve();
    });
  });
}

export function stopMcpServer() {
  state.server?.close();
  state.server = null;
}

// ─────────────────────────────────────────────────────────
// HTTP layer
// ─────────────────────────────────────────────────────────

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.replace(/:\d+$/, '').toLowerCase();
  return LOOPBACK_HOSTS.has(host);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients don't send Origin
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') {
    return sendJson(res, 404, { error: 'Not found. MCP endpoint is /mcp' });
  }
  if (!isLoopbackHost(req.headers.host) || !isAllowedOrigin(req.headers.origin)) {
    return sendJson(res, 403, rpcError(null, -32000, 'Forbidden origin'));
  }
  if (req.method === 'GET' || req.method === 'DELETE') {
    // Stateless server: no server-initiated SSE stream, no sessions.
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (e) {
    return sendJson(res, 413, rpcError(null, -32600, (e as Error).message));
  }

  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, rpcError(null, -32700, 'Parse error'));
  }

  const messages = Array.isArray(message) ? message : [message];
  const replies: unknown[] = [];
  for (const m of messages) {
    const reply = await handleRpc(m);
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) {
    // Only notifications / responses → 202 Accepted, no body.
    res.writeHead(202).end();
    return;
  }
  sendJson(res, 200, Array.isArray(message) ? replies : replies[0]);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ─────────────────────────────────────────────────────────
// JSON-RPC / MCP layer
// ─────────────────────────────────────────────────────────

type RpcId = string | number | null;

interface RpcMessage {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: RpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleRpc(raw: unknown): Promise<unknown | null> {
  const msg = raw as RpcMessage;
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
    return rpcError(null, -32600, 'Invalid Request');
  }
  const isNotification = msg.id === undefined;
  // Responses to server requests (we never send any) and notifications such
  // as notifications/initialized need no reply.
  if (!msg.method) return null;
  if (isNotification) return null;
  const id = msg.id ?? null;

  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion ?? '');
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'volt', title: 'Volt API Client', version: app.getVersion() },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!MCP_TOOLS.some((t) => t.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }
      console.log(`[mcp] tools/call ${name}`);
      try {
        const result = await callTool(name, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        });
      } catch (e) {
        // Tool failures go back as isError results so the model can recover.
        const message =
          e instanceof ToolInputError ? `Invalid arguments: ${e.message}` : (e as Error).message;
        return rpcResult(id, { content: [{ type: 'text', text: message }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}
