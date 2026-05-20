// IPC contract registry.
// Every channel between renderer and main is declared here with input/output
// Zod schemas. The preload script uses this list to auto-generate a typed
// window.volt API for the renderer.
//
// Naming convention: <domain>:<verb>  (e.g., "request:send", "collection:list")

import { z } from 'zod';
import {
  ApiRequest,
  Collection,
  Environment,
  HistoryEntry,
  SendRequestInput,
  SendRequestOutput,
  Workspace,
  Variable,
} from '../index';

const uuid = z.string().uuid();

// ─────────────────────────────────────────────────────────
// Request execution
// ─────────────────────────────────────────────────────────

export const RequestSendContract = {
  input: SendRequestInput,
  output: SendRequestOutput,
} as const;

export const RequestCancelContract = {
  input: z.object({ inFlightId: z.string() }),
  output: z.object({ cancelled: z.boolean() }),
} as const;

// ─────────────────────────────────────────────────────────
// Workspaces (local DB)
// ─────────────────────────────────────────────────────────

export const WorkspaceListContract = {
  input: z.object({}),
  output: z.object({
    personal: z.array(Workspace),
    team: z.array(Workspace),
  }),
} as const;

export const WorkspaceCreateContract = {
  input: z.object({ name: z.string().min(1).max(120), teamId: uuid.optional() }),
  output: Workspace,
} as const;

export const WorkspaceRenameContract = {
  input: z.object({ id: uuid, name: z.string().min(1).max(120) }),
  output: Workspace,
} as const;

export const WorkspaceDeleteContract = {
  input: z.object({ id: uuid }),
  output: z.object({ deleted: z.boolean() }),
} as const;

// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────

export const CollectionListContract = {
  input: z.object({ workspaceId: uuid }),
  output: z.array(Collection),
} as const;

export const CollectionCreateContract = {
  input: z.object({
    workspaceId: uuid,
    parentId: uuid.nullable(),
    name: z.string().min(1).max(200),
  }),
  output: Collection,
} as const;

export const CollectionUpdateContract = {
  input: z.object({
    id: uuid,
    name: z.string().min(1).max(200).optional(),
    parentId: uuid.nullable().optional(),
    description: z.string().max(200_000).optional(),
    sortOrder: z.number().int().optional(),
    variables: z.array(Variable).optional(),
  }),
  output: Collection,
} as const;

export const CollectionDeleteContract = {
  input: z.object({ id: uuid }),
  output: z.object({ deleted: z.boolean() }),
} as const;

// ─────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────

export const RequestListContract = {
  input: z.object({ workspaceId: uuid, collectionId: uuid.nullable().optional() }),
  output: z.array(ApiRequest),
} as const;

export const RequestGetContract = {
  input: z.object({ id: uuid }),
  output: ApiRequest,
} as const;

export const RequestCreateContract = {
  input: ApiRequest.omit({ id: true, revision: true }).partial({
    headers: true,
    queryParams: true,
    body: true,
    auth: true,
    sortOrder: true,
  }),
  output: ApiRequest,
} as const;

export const RequestUpdateContract = {
  input: ApiRequest.partial().required({ id: true }),
  output: ApiRequest,
} as const;

export const RequestDeleteContract = {
  input: z.object({ id: uuid }),
  output: z.object({ deleted: z.boolean() }),
} as const;

// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────

export const EnvListContract = {
  input: z.object({ workspaceId: uuid }),
  output: z.array(Environment),
} as const;

export const EnvCreateContract = {
  input: z.object({ workspaceId: uuid, name: z.string().min(1).max(120) }),
  output: Environment,
} as const;

export const EnvUpdateContract = {
  input: Environment.partial().required({ id: true }),
  output: Environment,
} as const;

export const EnvDeleteContract = {
  input: z.object({ id: uuid }),
  output: z.object({ deleted: z.boolean() }),
} as const;

// "Active" env is a per-workspace local-only setting (not synced).
export const EnvSetActiveContract = {
  input: z.object({ workspaceId: uuid, environmentId: uuid.nullable() }),
  output: z.object({ ok: z.literal(true) }),
} as const;

export const EnvGetActiveContract = {
  input: z.object({ workspaceId: uuid }),
  output: z.object({ environmentId: uuid.nullable() }),
} as const;

// ─────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────

export const HistoryListContract = {
  input: z.object({
    workspaceId: uuid,
    limit: z.number().int().min(1).max(500).default(50),
    cursor: z.string().datetime().optional(),
    search: z.string().optional(),
  }),
  output: z.object({
    entries: z.array(HistoryEntry),
    nextCursor: z.string().datetime().nullable(),
  }),
} as const;

export const HistoryGetContract = {
  input: z.object({ id: uuid }),
  output: HistoryEntry.extend({
    responseHeaders: z.array(z.tuple([z.string(), z.string()])).nullable(),
    responseBodyBase64: z.string().nullable(),
    responseBodyTempFile: z.string().nullable(),
    responseContentType: z.string().nullable(),
    responseSizeBytes: z.number().int().nullable(),
  }),
} as const;

export const HistoryClearContract = {
  input: z.object({ workspaceId: uuid }),
  output: z.object({ cleared: z.number().int() }),
} as const;

// ─────────────────────────────────────────────────────────
// Auth (talks to backend on behalf of renderer)
// ─────────────────────────────────────────────────────────

export const AuthStatusContract = {
  input: z.object({}),
  output: z.object({
    loggedIn: z.boolean(),
    email: z.string().email().nullable(),
    name: z.string().nullable(),
  }),
} as const;

export const AuthLoginContract = {
  input: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  output: z.object({
    success: z.boolean(),
    errorMessage: z.string().optional(),
  }),
} as const;

export const AuthRegisterContract = {
  input: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    password: z.string().min(8),
  }),
  output: z.object({
    success: z.boolean(),
    errorMessage: z.string().optional(),
  }),
} as const;

export const AuthLogoutContract = {
  input: z.object({}),
  output: z.object({ ok: z.literal(true) }),
} as const;

// ─────────────────────────────────────────────────────────
// Sync
// ─────────────────────────────────────────────────────────

export const SyncStatusContract = {
  input: z.object({}),
  output: z.object({
    state: z.enum(['offline', 'syncing', 'synced', 'conflict', 'error']),
    lastSyncedAt: z.string().datetime().nullable(),
    pendingChanges: z.number().int(),
    errorMessage: z.string().optional(),
  }),
} as const;

export const SyncForceContract = {
  input: z.object({ workspaceId: uuid.optional() }),
  output: z.object({ started: z.boolean() }),
} as const;

// ─────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────

export const ImportSourceContract = {
  input: z.object({
    workspaceId: uuid,
    source: z.enum(['postman', 'insomnia', 'openapi', 'curl']),
    // Either a file path on disk OR raw content (used for curl paste)
    filePath: z.string().optional(),
    content: z.string().optional(),
  }),
  output: z.object({
    success: z.boolean(),
    collectionId: uuid.optional(),
    requestId: uuid.optional(),
    summary: z.object({
      collections: z.number().int(),
      requests: z.number().int(),
      environments: z.number().int(),
      warnings: z.array(z.string()),
    }),
    errorMessage: z.string().optional(),
  }),
} as const;

// ─────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────

export const AppInfoContract = {
  input: z.object({}),
  output: z.object({
    version: z.string(),
    platform: z.enum(['macos', 'windows', 'linux']),
    dbPath: z.string(),
  }),
} as const;

export const OpenExternalContract = {
  input: z.object({ url: z.string().url() }),
  output: z.object({ ok: z.literal(true) }),
} as const;

export const ShowFilePickerContract = {
  input: z.object({
    filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional(),
  }),
  output: z.object({
    cancelled: z.boolean(),
    filePath: z.string().optional(),
  }),
} as const;

// ─────────────────────────────────────────────────────────
// Teams (proxied to backend on the user's behalf)
// ─────────────────────────────────────────────────────────

export const TeamListContract = {
  input: z.object({}),
  // Backend returns nested Prisma rows; keep loose since output isn't validated.
  output: z.array(z.any()),
} as const;

export const TeamCreateContract = {
  input: z.object({ name: z.string().min(1).max(120) }),
  output: z.any(),
} as const;

export const TeamInviteContract = {
  input: z.object({ teamId: uuid, email: z.string().email() }),
  output: z.any(),
} as const;

export const TeamAcceptInviteContract = {
  input: z.object({ code: z.string().min(1) }),
  output: z.any(),
} as const;

// ─────────────────────────────────────────────────────────
// Globals — per-device key/value set from pre/post-request scripts.
// ─────────────────────────────────────────────────────────

export const GlobalsListContract = {
  input: z.object({}),
  output: z.record(z.unknown()),
} as const;

export const GlobalsSetContract = {
  input: z.object({ key: z.string().min(1), value: z.unknown() }),
  output: z.object({ ok: z.literal(true) }),
} as const;

export const GlobalsDeleteContract = {
  input: z.object({ key: z.string().min(1) }),
  output: z.object({ ok: z.literal(true) }),
} as const;

// ─────────────────────────────────────────────────────────
// Channel registry — single source of truth for the bridge.
// The preload script reads this to build the typed window.volt API.
// ─────────────────────────────────────────────────────────

export const IPC = {
  'request:send': RequestSendContract,
  'request:cancel': RequestCancelContract,

  'workspace:list': WorkspaceListContract,
  'workspace:create': WorkspaceCreateContract,
  'workspace:rename': WorkspaceRenameContract,
  'workspace:delete': WorkspaceDeleteContract,

  'collection:list': CollectionListContract,
  'collection:create': CollectionCreateContract,
  'collection:update': CollectionUpdateContract,
  'collection:delete': CollectionDeleteContract,

  'apiRequest:list': RequestListContract,
  'apiRequest:get': RequestGetContract,
  'apiRequest:create': RequestCreateContract,
  'apiRequest:update': RequestUpdateContract,
  'apiRequest:delete': RequestDeleteContract,

  'env:list': EnvListContract,
  'env:create': EnvCreateContract,
  'env:update': EnvUpdateContract,
  'env:delete': EnvDeleteContract,
  'env:setActive': EnvSetActiveContract,
  'env:getActive': EnvGetActiveContract,

  'history:list': HistoryListContract,
  'history:get': HistoryGetContract,
  'history:clear': HistoryClearContract,

  'auth:status': AuthStatusContract,
  'auth:login': AuthLoginContract,
  'auth:register': AuthRegisterContract,
  'auth:logout': AuthLogoutContract,

  'team:list': TeamListContract,
  'team:create': TeamCreateContract,
  'team:invite': TeamInviteContract,
  'team:acceptInvite': TeamAcceptInviteContract,

  'globals:list': GlobalsListContract,
  'globals:set': GlobalsSetContract,
  'globals:delete': GlobalsDeleteContract,

  'sync:status': SyncStatusContract,
  'sync:force': SyncForceContract,

  'import:source': ImportSourceContract,

  'app:info': AppInfoContract,
  'app:openExternal': OpenExternalContract,
  'app:showFilePicker': ShowFilePickerContract,
} as const;

export type IpcChannel = keyof typeof IPC;
export type IpcInput<C extends IpcChannel> = z.infer<(typeof IPC)[C]['input']>;
export type IpcOutput<C extends IpcChannel> = z.infer<(typeof IPC)[C]['output']>;

// ─────────────────────────────────────────────────────────
// Push-from-main events (one-way: main → renderer)
// Examples: "your sync state changed", "a conflict was detected"
// ─────────────────────────────────────────────────────────

export const SyncStateChangedEvent = z.object({
  type: z.literal('sync:stateChanged'),
  state: z.enum(['offline', 'syncing', 'synced', 'conflict', 'error']),
  pendingChanges: z.number().int(),
});

export const ConflictDetectedEvent = z.object({
  type: z.literal('sync:conflictDetected'),
  workspaceId: z.string().uuid(),
  rowId: z.string().uuid(),
  table: z.enum(['collection', 'request', 'environment']),
  overwrittenByName: z.string(),
});

export const DataChangedEvent = z.object({
  // Fired whenever local DB changes (push, pull, or local edit).
  // Renderer invalidates relevant TanStack Query keys.
  type: z.literal('data:changed'),
  table: z.enum(['collection', 'request', 'environment', 'workspace']),
  workspaceId: z.string().uuid().optional(),
});

export const MainEvent = z.discriminatedUnion('type', [
  SyncStateChangedEvent,
  ConflictDetectedEvent,
  DataChangedEvent,
]);
export type MainEvent = z.infer<typeof MainEvent>;
