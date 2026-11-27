// MCP tool catalogue for the local Volt MCP server (see ./server.ts).
//
// Each tool mirrors something the UI can do. Writes go through the same
// core/db query helpers as the IPC handlers, then (a) mark the workspace
// dirty for sync, (b) tell the open window to refetch, (c) refresh the
// desktop widget snapshot — so agent edits look exactly like user edits.

import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { RequestAuth, RequestBody, Variable } from '@volt/shared';

import {
  createCollection,
  createEnvironment,
  createRequest,
  createWorkspace,
  getActiveEnvironment,
  getCollection,
  getEnvironment,
  getRequest,
  getWorkspace,
  listCollections,
  listEnvironments,
  listRequests,
  listWorkspaces,
  setActiveEnvironment,
  softDeleteCollection,
  softDeleteRequest,
  updateCollection,
  updateEnvironment,
  updateRequest,
} from '../db/queries';
import { currentUser } from '../auth/manager';
import { notifyDirty } from '../sync/engine';
import { runFavorite, scheduleSnapshot } from '../widget/bridge';
import { runImport } from '../import/run';
import { exportPostman } from '../export/postman';
import { exportInsomnia } from '../export/insomnia';
import { exportOpenAPI } from '../export/openapi';
import { exportDocs } from '../export/docs';
import { beginCapture, endCapture } from './capture';

export class ToolInputError extends Error {}

type Json = Record<string, unknown>;

interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>) => Promise<Json> | Json;
}

// ─────────────────────────────────────────────────────────
// Shared input schemas (zod for validation, JSON Schema for tools/list)
// ─────────────────────────────────────────────────────────

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const id = z.string().uuid();

const Row = z.object({
  key: z.string(),
  value: z.string().default(''),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});
const RowsJson = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      value: { type: 'string' },
      enabled: { type: 'boolean', default: true },
      description: { type: 'string' },
    },
    required: ['key'],
  },
};

const BodyJson = {
  type: 'object',
  description:
    'Request body. Shapes: {type:"none"} | {type:"raw", language:"json"|"xml"|"html"|"text"|"javascript", content} | ' +
    '{type:"urlencoded", fields:[{key,value}]} | {type:"form", fields:[{key,value,kind:"text"|"file"}]} | ' +
    '{type:"graphql", query, variables?} | {type:"binary", filePath}',
  properties: { type: { type: 'string', enum: ['none', 'raw', 'urlencoded', 'form', 'graphql', 'binary'] } },
  required: ['type'],
};

const AuthJson = {
  type: 'object',
  description:
    'Auth. Shapes: {type:"none"} | {type:"bearer", token} | {type:"basic", username, password} | ' +
    '{type:"apiKey", key, value, placement:"header"|"query"}. Values may use {{variables}}.',
  properties: { type: { type: 'string', enum: ['none', 'bearer', 'basic', 'apiKey', 'oauth2'] } },
  required: ['type'],
};

const RequestFields = z.object({
  name: z.string().min(1).max(200),
  method: z.enum(METHODS),
  url: z.string().max(8000),
  headers: z.array(Row),
  queryParams: z.array(Row),
  pathVariables: z.array(Row),
  body: z.record(z.unknown()),
  auth: z.record(z.unknown()),
  description: z.string().max(200_000),
  preRequestScript: z.string().max(50_000),
  postResponseScript: z.string().max(50_000),
});

const RequestFieldsJson: Json = {
  name: { type: 'string' },
  method: { type: 'string', enum: METHODS },
  url: { type: 'string', description: 'May contain {{variables}} and :pathVars' },
  headers: RowsJson,
  queryParams: RowsJson,
  pathVariables: { ...RowsJson, description: 'Values for :name segments in the URL' },
  body: BodyJson,
  auth: AuthJson,
  description: { type: 'string', description: 'Markdown docs for the endpoint' },
  preRequestScript: { type: 'string', description: 'JavaScript run before sending (pm/volt API)' },
  postResponseScript: { type: 'string', description: 'JavaScript run after the response, e.g. pm.test(...)' },
};

function parse<T extends z.ZodTypeAny>(schema: T, args: unknown): z.infer<T> {
  const r = schema.safeParse(args);
  if (!r.success) {
    const issue = r.error.errors[0];
    throw new ToolInputError(`${issue?.path.join('.') || 'input'}: ${issue?.message ?? 'invalid'}`);
  }
  return r.data;
}

/** Rows coming from MCP have no client ids; the UI needs stable ones. */
function withIds<T extends object>(rows: T[] | undefined) {
  return rows?.map((r) => ({ id: nanoid(), ...r }));
}

function normalizeBody(body: Record<string, unknown> | undefined) {
  if (!body) return undefined;
  const b: Record<string, unknown> = { ...body };
  if (b.type === 'raw' && b.language === undefined) b.language = 'json';
  if ((b.type === 'urlencoded' || b.type === 'form') && Array.isArray(b.fields)) {
    b.fields = (b.fields as Record<string, unknown>[]).map((f) => ({
      id: nanoid(),
      enabled: true,
      value: '',
      ...(b.type === 'form' ? { kind: 'text' } : {}),
      ...f,
    }));
  }
  return parse(RequestBody, b);
}

function normalizeAuth(auth: Record<string, unknown> | undefined) {
  if (!auth) return undefined;
  return parse(RequestAuth, auth);
}

/** Build the DB patch shared by create_request / update_request. */
function requestPatch(f: Partial<z.infer<typeof RequestFields>>) {
  const body = normalizeBody(f.body);
  return {
    ...(f.name !== undefined && { name: f.name }),
    ...(f.method !== undefined && { method: f.method }),
    ...(f.url !== undefined && { url: f.url }),
    ...(f.headers !== undefined && { headers: withIds(f.headers) }),
    ...(f.queryParams !== undefined && { queryParams: withIds(f.queryParams) }),
    ...(f.pathVariables !== undefined && { pathVariables: withIds(f.pathVariables) }),
    ...(body !== undefined && { body, bodyType: body.type }),
    ...(f.auth !== undefined && { auth: normalizeAuth(f.auth) }),
    ...(f.description !== undefined && { description: f.description }),
    ...(f.preRequestScript !== undefined && { preRequestScript: f.preRequestScript }),
    ...(f.postResponseScript !== undefined && { postResponseScript: f.postResponseScript }),
  };
}

// ─────────────────────────────────────────────────────────
// Lookups + change notification
// ─────────────────────────────────────────────────────────

function requireWorkspace(workspaceId: string) {
  const ws = getWorkspace(workspaceId);
  if (!ws || (ws as { deletedAt?: unknown }).deletedAt) throw new Error(`Workspace not found: ${workspaceId}`);
  return ws;
}

function requireCollection(collectionId: string, workspaceId?: string) {
  const c = getCollection(collectionId);
  if (!c || c.deletedAt) throw new Error(`Collection/folder not found: ${collectionId}`);
  if (workspaceId && c.workspaceId !== workspaceId) {
    throw new Error(`Collection ${collectionId} belongs to another workspace`);
  }
  return c;
}

function requireRequest(requestId: string) {
  const r = getRequest(requestId);
  if (!r || r.deletedAt) throw new Error(`Request not found: ${requestId}`);
  return r;
}

function requireEnvironment(environmentId: string) {
  const e = getEnvironment(environmentId);
  if (!e || e.deletedAt) throw new Error(`Environment not found: ${environmentId}`);
  return e;
}

type Table = 'collection' | 'request' | 'environment';

function changed(workspaceId: string, ...tables: Table[]) {
  notifyDirty();
  scheduleSnapshot();
  for (const win of BrowserWindow.getAllWindows()) {
    for (const table of tables) win.webContents.send('volt:event', { type: 'data:changed', workspaceId, table });
  }
}

function requestSummary(r: { id: string; name: string; method: string; url: string; collectionId: string | null }) {
  return { id: r.id, name: r.name, method: r.method, url: r.url, collectionId: r.collectionId };
}

function maskVariables(vars: z.infer<typeof Variable>[]) {
  return vars.map((v) => ({
    key: v.key,
    value: v.secret || v.secretRef ? '••••••' : v.value,
    enabled: v.enabled !== false,
    ...(v.secret || v.secretRef ? { secret: true } : {}),
  }));
}

const BODY_PREVIEW_BYTES = 100_000;

// ─────────────────────────────────────────────────────────
// Collection tree (get_collection_tree / search_requests)
// ─────────────────────────────────────────────────────────

const TREE_MAX_REQUESTS = 200;

interface TreeRequest {
  id: string;
  name: string;
  method: string;
  url: string;
}

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  folders: TreeNode[];
  requests: TreeRequest[];
  folderCount: number;
  requestCount: number;
}

function buildTree(workspaceId: string) {
  const cols = [...listCollections(workspaceId)].sort((x, y) => x.sortOrder - y.sortOrder);
  const reqs = [...listRequests(workspaceId)].sort((x, y) => x.sortOrder - y.sortOrder);
  const nodes = new Map<string, TreeNode>();
  for (const c of cols) {
    nodes.set(c.id, { id: c.id, name: c.name, parentId: c.parentId, folders: [], requests: [], folderCount: 0, requestCount: 0 });
  }
  const roots: TreeNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.folders.push(n);
    else roots.push(n);
  }
  const rootRequests: TreeRequest[] = [];
  for (const r of reqs) {
    const item = { id: r.id, name: r.name, method: r.method, url: r.url };
    const node = r.collectionId ? nodes.get(r.collectionId) : undefined;
    if (node) node.requests.push(item);
    else rootRequests.push(item);
  }
  const count = (n: TreeNode) => {
    n.folderCount = n.folders.length;
    n.requestCount = n.requests.length;
    for (const f of n.folders) {
      count(f);
      n.folderCount += f.folderCount;
      n.requestCount += f.requestCount;
    }
  };
  roots.forEach(count);
  const pathOf = (nodeId: string) => {
    const parts: string[] = [];
    for (let n = nodes.get(nodeId); n; n = n.parentId ? nodes.get(n.parentId) : undefined) parts.unshift(n.name);
    return parts.join(' / ');
  };
  return { nodes, roots, rootRequests, pathOf };
}

function takeRequests(list: TreeRequest[], budget: { left: number; truncated: boolean }) {
  const out = list.slice(0, Math.max(0, budget.left));
  budget.left -= out.length;
  if (out.length < list.length) budget.truncated = true;
  return out;
}

/**
 * Copy of `node` expanded `depth` folder levels down. A node at the edge
 * (depth 0) is a summary: id, name and recursive counts — open it with
 * collectionId to see inside.
 */
function renderNode(
  node: TreeNode,
  depth: number,
  includeRequests: boolean,
  budget: { left: number; truncated: boolean },
): Json {
  const expanded = depth > 0;
  return {
    id: node.id,
    name: node.name,
    folderCount: node.folderCount,
    requestCount: node.requestCount,
    ...(expanded && includeRequests && node.requests.length > 0 && { requests: takeRequests(node.requests, budget) }),
    ...(expanded && node.folders.length > 0 && {
      folders: node.folders.map((f) => renderNode(f, depth - 1, includeRequests, budget)),
    }),
  };
}

// ─────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────

export const MCP_TOOLS: ToolDef[] = [
  {
    name: 'list_workspaces',
    title: 'List workspaces',
    description: 'List all workspaces (personal and team) with their active environment.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: () => ({
      workspaces: listWorkspaces()
        .filter((w) => !(w as { deletedAt?: unknown }).deletedAt)
        .map((w) => ({
          id: w.id,
          name: w.name,
          kind: w.ownerTeamId ? 'team' : 'personal',
          localOnly: w.localOnly,
          activeEnvironmentId: w.activeEnvironmentId ?? null,
        })),
    }),
  },
  {
    name: 'create_workspace',
    title: 'Create workspace',
    description:
      'Create a local (personal, not synced) workspace. When signed in to Volt cloud, create workspaces in the app instead.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    run: (args) => {
      const a = parse(z.object({ name: z.string().min(1).max(120) }), args);
      if (currentUser()) {
        throw new Error('Signed in to Volt cloud: create the workspace in the app so it is registered for sync.');
      }
      const ws = createWorkspace({ name: a.name, localOnly: true, ownerUserId: null, ownerTeamId: null });
      if (!ws) throw new Error('Failed to create workspace');
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('volt:event', { type: 'data:changed', table: 'workspace' });
      }
      return { id: ws.id, name: ws.name };
    },
  },
  {
    name: 'get_collection_tree',
    title: 'Get collection tree',
    description:
      'Browse the collections and folders of a workspace. Each node has folderCount/requestCount (recursive totals). ' +
      'Without collectionId: top-level collections and their folders as summaries, no requests. ' +
      'With collectionId: that folder\'s own requests and its sub-folders as summaries; open a sub-folder by its id. ' +
      'depth = folder levels to expand (default 1); ' +
      `at most ${TREE_MAX_REQUESTS} requests are returned per call (truncated: true when cut). Use search_requests to find a request by name/url.`,
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        collectionId: { type: 'string', description: 'Folder/collection to open' },
        depth: { type: 'integer', minimum: 0, maximum: 20, description: 'Folder levels to expand; edge folders show counts only' },
        includeRequests: { type: 'boolean', description: 'List requests inside expanded folders' },
      },
      required: ['workspaceId'],
    },
    annotations: { readOnlyHint: true },
    run: (args) => {
      const a = parse(
        z.object({
          workspaceId: id,
          collectionId: id.optional(),
          depth: z.number().int().min(0).max(20).optional(),
          includeRequests: z.boolean().optional(),
        }),
        args,
      );
      requireWorkspace(a.workspaceId);
      const tree = buildTree(a.workspaceId);
      const depth = a.depth ?? 1;
      const includeRequests = a.includeRequests ?? Boolean(a.collectionId);
      const budget = { left: TREE_MAX_REQUESTS, truncated: false };

      if (a.collectionId) {
        const node = tree.nodes.get(a.collectionId);
        if (!node) throw new Error(`Collection/folder not found: ${a.collectionId}`);
        const collection = renderNode(node, depth, includeRequests, budget);
        return { path: tree.pathOf(node.id), collection, ...(budget.truncated && { truncated: true }) };
      }
      const collections = tree.roots.map((n) => renderNode(n, depth, includeRequests, budget));
      return {
        collections,
        rootRequestCount: tree.rootRequests.length,
        ...(includeRequests && { rootRequests: takeRequests(tree.rootRequests, budget) }),
        ...(budget.truncated && { truncated: true }),
      };
    },
  },
  {
    name: 'search_requests',
    title: 'Search requests',
    description:
      'Find saved requests whose name or URL contains all words of query (case-insensitive), optionally filtered by ' +
      'method and limited to a collection/folder subtree. Returns id, method, name, url and the folder path.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        query: { type: 'string', description: 'Words to match in name or URL, e.g. "user login"' },
        method: { type: 'string', enum: METHODS },
        collectionId: { type: 'string', description: 'Only search inside this collection/folder' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      required: ['workspaceId'],
    },
    annotations: { readOnlyHint: true },
    run: (args) => {
      const a = parse(
        z.object({
          workspaceId: id,
          query: z.string().max(500).optional(),
          method: z.enum(METHODS).optional(),
          collectionId: id.optional(),
          limit: z.number().int().min(1).max(200).default(50),
        }),
        args,
      );
      requireWorkspace(a.workspaceId);
      const tree = buildTree(a.workspaceId);
      let scope: Set<string> | null = null;
      if (a.collectionId) {
        const start = tree.nodes.get(a.collectionId);
        if (!start) throw new Error(`Collection/folder not found: ${a.collectionId}`);
        scope = new Set<string>();
        const walk = (n: TreeNode) => {
          scope!.add(n.id);
          n.folders.forEach(walk);
        };
        walk(start);
      }
      const words = (a.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const matches = listRequests(a.workspaceId).filter((r) => {
        if (a.method && r.method !== a.method) return false;
        if (scope && !(r.collectionId && scope.has(r.collectionId))) return false;
        const hay = `${r.name} ${r.url}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      return {
        total: matches.length,
        requests: matches.slice(0, a.limit).map((r) => ({
          id: r.id,
          method: r.method,
          name: r.name,
          url: r.url,
          path: r.collectionId ? tree.pathOf(r.collectionId) : '',
        })),
        ...(matches.length > a.limit && { truncated: true }),
      };
    },
  },
  {
    name: 'create_collection',
    title: 'Create collection or folder',
    description:
      'Create a top-level collection, or a folder inside a collection/folder when parentId is given.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        name: { type: 'string' },
        parentId: { type: 'string', description: 'Parent collection/folder id. Omit for a top-level collection.' },
        description: { type: 'string', description: 'Markdown documentation' },
      },
      required: ['workspaceId', 'name'],
    },
    run: (args) => {
      const a = parse(
        z.object({
          workspaceId: id,
          name: z.string().min(1).max(200),
          parentId: id.optional(),
          description: z.string().max(200_000).optional(),
        }),
        args,
      );
      requireWorkspace(a.workspaceId);
      if (a.parentId) requireCollection(a.parentId, a.workspaceId);
      const c = createCollection({
        workspaceId: a.workspaceId,
        parentId: a.parentId ?? null,
        name: a.name,
        description: a.description,
      });
      if (!c) throw new Error('Failed to create collection');
      changed(a.workspaceId, 'collection');
      return { id: c.id, name: c.name, parentId: c.parentId };
    },
  },
  {
    name: 'update_collection',
    title: 'Update collection or folder',
    description:
      'Rename, move (parentId; null = top level), document, or replace the variables of a collection/folder.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        parentId: { type: ['string', 'null'] },
        description: { type: 'string' },
        variables: {
          type: 'array',
          description: 'Replaces all collection variables',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, value: { type: 'string' }, enabled: { type: 'boolean' } },
            required: ['key', 'value'],
          },
        },
      },
      required: ['id'],
    },
    run: (args) => {
      const a = parse(
        z.object({
          id,
          name: z.string().min(1).max(200).optional(),
          parentId: id.nullable().optional(),
          description: z.string().max(200_000).optional(),
          variables: z.array(Variable).optional(),
        }),
        args,
      );
      const c = requireCollection(a.id);
      if (a.parentId) {
        requireCollection(a.parentId, c.workspaceId);
        // Refuse cycles: the new parent can't be the folder itself or inside it.
        let cur: string | null = a.parentId;
        while (cur) {
          if (cur === a.id) throw new Error('Cannot move a folder into itself or one of its sub-folders');
          cur = getCollection(cur)?.parentId ?? null;
        }
      }
      const { id: _id, ...patch } = a;
      const updated = updateCollection(a.id, patch);
      changed(c.workspaceId, 'collection');
      return { id: a.id, name: updated?.name ?? c.name, parentId: updated?.parentId ?? null };
    },
  },
  {
    name: 'delete_collection',
    title: 'Delete collection or folder',
    description: 'Delete a collection/folder together with all its sub-folders and requests.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    run: (args) => {
      const a = parse(z.object({ id }), args);
      const c = requireCollection(a.id);
      softDeleteCollection(a.id);
      changed(c.workspaceId, 'collection', 'request');
      return { deleted: true, id: a.id };
    },
  },
  {
    name: 'get_request',
    title: 'Get request',
    description: 'Return the full saved request: url, headers, params, body, auth, scripts, docs.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true },
    run: (args) => {
      const a = parse(z.object({ id }), args);
      const r = requireRequest(a.id);
      const strip = (rows: Array<Record<string, unknown>>) => rows.map(({ id: _rowId, ...rest }) => rest);
      return {
        id: r.id,
        workspaceId: r.workspaceId,
        collectionId: r.collectionId,
        name: r.name,
        method: r.method,
        url: r.url,
        headers: strip(r.headers as Array<Record<string, unknown>>),
        queryParams: strip(r.queryParams as Array<Record<string, unknown>>),
        pathVariables: strip(r.pathVariables as Array<Record<string, unknown>>),
        body: r.body,
        auth: r.auth,
        description: r.description,
        preRequestScript: r.preRequestScript,
        postResponseScript: r.postResponseScript,
        exampleCount: (r.examples as unknown[]).length,
      };
    },
  },
  {
    name: 'create_request',
    title: 'Create request',
    description:
      'Save a new HTTP request into a collection/folder (or the workspace root when collectionId is omitted).',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        collectionId: { type: 'string', description: 'Target collection/folder id' },
        ...RequestFieldsJson,
      },
      required: ['workspaceId', 'name', 'method', 'url'],
    },
    run: (args) => {
      const a = parse(
        RequestFields.partial()
          .required({ name: true, method: true, url: true })
          .extend({ workspaceId: id, collectionId: id.optional() }),
        args,
      );
      requireWorkspace(a.workspaceId);
      if (a.collectionId) requireCollection(a.collectionId, a.workspaceId);
      const r = createRequest({
        workspaceId: a.workspaceId,
        collectionId: a.collectionId ?? null,
        ...requestPatch(a),
        name: a.name,
        method: a.method,
        url: a.url,
      });
      if (!r) throw new Error('Failed to create request');
      changed(a.workspaceId, 'request');
      return requestSummary(r);
    },
  },
  {
    name: 'update_request',
    title: 'Update request',
    description:
      'Change fields of a saved request. Only the given fields change; arrays (headers, queryParams, …) replace the old ones. ' +
      'Set collectionId to move it (null = workspace root).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, collectionId: { type: ['string', 'null'] }, ...RequestFieldsJson },
      required: ['id'],
    },
    run: (args) => {
      const a = parse(RequestFields.partial().extend({ id, collectionId: id.nullable().optional() }), args);
      const existing = requireRequest(a.id);
      if (a.collectionId) requireCollection(a.collectionId, existing.workspaceId);
      const patch = {
        ...requestPatch(a),
        ...(a.collectionId !== undefined && { collectionId: a.collectionId }),
      };
      const r = updateRequest(a.id, patch);
      if (!r) throw new Error(`Request not found: ${a.id}`);
      changed(existing.workspaceId, 'request');
      return requestSummary(r);
    },
  },
  {
    name: 'delete_request',
    title: 'Delete request',
    description: 'Delete a saved request.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    run: (args) => {
      const a = parse(z.object({ id }), args);
      const r = requireRequest(a.id);
      softDeleteRequest(a.id);
      changed(r.workspaceId, 'request');
      return { deleted: true, id: a.id };
    },
  },
  {
    name: 'send_request',
    title: 'Send saved request',
    description:
      "Send a saved request exactly like the app's Send button: active environment, collection variables, globals, " +
      'auth (incl. OAuth), pre/post scripts. Returns status, timing, headers, body (first 100 KB) and script test results. ' +
      'Recorded in history.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Saved request id' },
        includeHeaders: { type: 'boolean', default: true },
      },
      required: ['id'],
    },
    annotations: { openWorldHint: true },
    run: async (args) => {
      const a = parse(z.object({ id, includeHeaders: z.boolean().default(true) }), args);
      requireRequest(a.id);
      beginCapture(a.id);
      let run: { ok: boolean; error?: string };
      let output: unknown;
      try {
        run = await runFavorite(a.id);
      } finally {
        output = endCapture(a.id);
      }
      if (!output) {
        // Failed before the request went out (unresolved variable, OAuth, …).
        return { sent: false, error: run!.error ?? 'Request was not sent' };
      }
      return summarizeSendOutput(output as SendOutput, a.includeHeaders);
    },
  },
  {
    name: 'import_collection',
    title: 'Import collection',
    description:
      'Import into a workspace from Postman (v2.1 JSON), Insomnia (v4 export), OpenAPI 3 / Swagger 2 (JSON or YAML), ' +
      'a cURL command, or a HAR file. Give either the file content or an absolute filePath.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        source: { type: 'string', enum: ['postman', 'insomnia', 'openapi', 'curl', 'har'] },
        content: { type: 'string' },
        filePath: { type: 'string', description: 'Absolute path; .yaml/.yml is parsed as YAML for openapi' },
      },
      required: ['workspaceId', 'source'],
    },
    run: (args) => {
      const a = parse(
        z
          .object({
            workspaceId: id,
            source: z.enum(['postman', 'insomnia', 'openapi', 'curl', 'har']),
            content: z.string().optional(),
            filePath: z.string().optional(),
          })
          .refine((x) => x.content || x.filePath, 'content or filePath is required'),
        args,
      );
      if (a.filePath && !path.isAbsolute(a.filePath)) throw new ToolInputError('filePath must be absolute');
      const r = runImport(a);
      if (!r.success) throw new Error(r.errorMessage ?? 'Import failed');
      changed(a.workspaceId, 'collection', 'request', 'environment');
      return r as unknown as Json;
    },
  },
  {
    name: 'export_collection',
    title: 'Export collection',
    description:
      'Export one collection (or the whole workspace when collectionId is omitted) as Postman v2.1, Insomnia v4, ' +
      'OpenAPI 3 or Markdown docs. Writes to filePath when given, otherwise returns the content.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        collectionId: { type: 'string' },
        format: { type: 'string', enum: ['postman', 'insomnia', 'openapi', 'markdown'] },
        filePath: { type: 'string', description: 'Absolute output path' },
      },
      required: ['workspaceId', 'format'],
    },
    annotations: { readOnlyHint: true },
    run: (args) => {
      const a = parse(
        z.object({
          workspaceId: id,
          collectionId: id.optional(),
          format: z.enum(['postman', 'insomnia', 'openapi', 'markdown']),
          filePath: z.string().optional(),
        }),
        args,
      );
      requireWorkspace(a.workspaceId);
      if (a.collectionId) requireCollection(a.collectionId, a.workspaceId);
      const exporter = {
        postman: exportPostman,
        insomnia: exportInsomnia,
        openapi: exportOpenAPI,
        markdown: exportDocs,
      }[a.format];
      const { content, filename } = exporter(a.workspaceId, a.collectionId ?? null);
      if (a.filePath) {
        if (!path.isAbsolute(a.filePath)) throw new ToolInputError('filePath must be absolute');
        fs.writeFileSync(a.filePath, content, 'utf-8');
        return { written: true, path: a.filePath, bytes: Buffer.byteLength(content) };
      }
      return { filename, content };
    },
  },
  {
    name: 'list_environments',
    title: 'List environments',
    description: 'List environments of a workspace with their variables (secret values masked) and which one is active.',
    inputSchema: { type: 'object', properties: { workspaceId: { type: 'string' } }, required: ['workspaceId'] },
    annotations: { readOnlyHint: true },
    run: (args) => {
      const a = parse(z.object({ workspaceId: id }), args);
      requireWorkspace(a.workspaceId);
      const activeId = getActiveEnvironment(a.workspaceId);
      return {
        activeEnvironmentId: activeId,
        environments: listEnvironments(a.workspaceId).map((e) => ({
          id: e.id,
          name: e.name,
          active: e.id === activeId,
          variables: maskVariables(e.variables as z.infer<typeof Variable>[]),
        })),
      };
    },
  },
  {
    name: 'create_environment',
    title: 'Create environment',
    description: 'Create an environment, optionally with initial variables.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        name: { type: 'string' },
        variables: { type: 'object', additionalProperties: { type: 'string' }, description: '{ key: value }' },
        activate: { type: 'boolean', description: 'Make it the active environment' },
      },
      required: ['workspaceId', 'name'],
    },
    run: (args) => {
      const a = parse(
        z.object({
          workspaceId: id,
          name: z.string().min(1).max(120),
          variables: z.record(z.string()).optional(),
          activate: z.boolean().optional(),
        }),
        args,
      );
      requireWorkspace(a.workspaceId);
      const env = createEnvironment({ workspaceId: a.workspaceId, name: a.name });
      if (!env) throw new Error('Failed to create environment');
      if (a.variables) {
        updateEnvironment(env.id, {
          variables: Object.entries(a.variables).map(([key, value]) => ({ key, value, enabled: true })),
        });
      }
      if (a.activate) setActiveEnvironment(a.workspaceId, env.id);
      changed(a.workspaceId, 'environment');
      return { id: env.id, name: env.name, active: Boolean(a.activate) };
    },
  },
  {
    name: 'update_environment',
    title: 'Update environment variables',
    description:
      'Rename an environment and/or upsert variables (set) and remove variables (unset). Other variables are kept as-is.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        set: { type: 'object', additionalProperties: { type: 'string' }, description: '{ key: value } to add/overwrite' },
        unset: { type: 'array', items: { type: 'string' }, description: 'Keys to remove' },
      },
      required: ['id'],
    },
    run: (args) => {
      const a = parse(
        z.object({
          id,
          name: z.string().min(1).max(120).optional(),
          set: z.record(z.string()).optional(),
          unset: z.array(z.string()).optional(),
        }),
        args,
      );
      const env = requireEnvironment(a.id);
      const drop = new Set(a.unset ?? []);
      const vars = (env.variables as Array<Record<string, unknown>>).filter((v) => !drop.has(String(v.key)));
      for (const [key, value] of Object.entries(a.set ?? {})) {
        const i = vars.findIndex((v) => v.key === key);
        // A plain value replaces any keychain-backed secret for that key.
        const row = { ...(i >= 0 ? vars[i] : { enabled: true }), key, value, secretRef: null };
        if (i >= 0) vars[i] = row;
        else vars.push(row);
      }
      updateEnvironment(a.id, { ...(a.name ? { name: a.name } : {}), variables: vars });
      changed(env.workspaceId, 'environment');
      return { id: a.id, variableCount: vars.length };
    },
  },
  {
    name: 'set_active_environment',
    title: 'Set active environment',
    description: 'Choose the environment used to resolve {{variables}} when sending. Pass null to clear.',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string' }, environmentId: { type: ['string', 'null'] } },
      required: ['workspaceId', 'environmentId'],
    },
    run: (args) => {
      const a = parse(z.object({ workspaceId: id, environmentId: id.nullable() }), args);
      requireWorkspace(a.workspaceId);
      if (a.environmentId) {
        const env = requireEnvironment(a.environmentId);
        if (env.workspaceId !== a.workspaceId) throw new Error('Environment belongs to another workspace');
      }
      setActiveEnvironment(a.workspaceId, a.environmentId);
      changed(a.workspaceId, 'environment');
      return { workspaceId: a.workspaceId, activeEnvironmentId: a.environmentId };
    },
  },
];

export async function callTool(name: string, args: Record<string, unknown>): Promise<Json> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new ToolInputError(`Unknown tool: ${name}`);
  return tool.run(args);
}

// ─────────────────────────────────────────────────────────
// send_request output
// ─────────────────────────────────────────────────────────

interface ScriptOut {
  logs: string[];
  error: string | null;
  tests: Array<{ name: string; passed: boolean; error: string | null; skipped?: boolean }>;
}

type SendOutput =
  | {
      ok: true;
      statusCode: number;
      statusText: string;
      headers: Array<[string, string]>;
      bodyBase64: string | null;
      bodyTempFile: string | null;
      bodyContentType: string | null;
      bodySizeBytes: number;
      timing: { totalMs: number };
      preScript?: ScriptOut;
      postScript?: ScriptOut;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
      timing: { totalMs: number } | null;
      preScript?: ScriptOut;
      postScript?: ScriptOut;
    };

function summarizeSendOutput(o: SendOutput, includeHeaders: boolean): Json {
  const scripts = {
    ...(o.preScript && { preScript: o.preScript }),
    ...(o.postScript && { postScript: o.postScript }),
  };
  const tests = [...(o.preScript?.tests ?? []), ...(o.postScript?.tests ?? [])];
  const testSummary = tests.length
    ? { tests: { passed: tests.filter((t) => t.passed).length, failed: tests.filter((t) => !t.passed && !t.skipped).length } }
    : {};
  if (!o.ok) {
    return { sent: false, errorCode: o.errorCode, error: o.errorMessage, durationMs: o.timing?.totalMs ?? null, ...testSummary, ...scripts };
  }
  let body: string | null = null;
  let truncated = false;
  if (o.bodyBase64) {
    const buf = Buffer.from(o.bodyBase64, 'base64');
    const isText = !o.bodyContentType || /json|text|xml|html|javascript|graphql|x-www-form-urlencoded/i.test(o.bodyContentType);
    if (isText) {
      truncated = buf.length > BODY_PREVIEW_BYTES;
      body = buf.subarray(0, BODY_PREVIEW_BYTES).toString('utf-8');
    } else {
      body = `<${o.bodySizeBytes} bytes of ${o.bodyContentType}>`;
    }
  } else if (o.bodyTempFile) {
    body = `<large body (${o.bodySizeBytes} bytes) saved to ${o.bodyTempFile}>`;
  }
  return {
    sent: true,
    status: o.statusCode,
    statusText: o.statusText,
    durationMs: o.timing.totalMs,
    sizeBytes: o.bodySizeBytes,
    contentType: o.bodyContentType,
    ...(includeHeaders && { headers: o.headers }),
    body,
    ...(truncated && { bodyTruncated: true }),
    ...testSummary,
    ...scripts,
  };
}
