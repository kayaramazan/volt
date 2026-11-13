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
  MockDefinition,
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

// Save the body of the last response to a user-chosen file. Caller passes
// either base64-encoded body (small responses) or a temp file path (large
// responses that were streamed to disk).
export const ResponseSaveBodyContract = {
  input: z
    .object({
      defaultName: z.string(),
      contentBase64: z.string().nullable().optional(),
      tempPath: z.string().nullable().optional(),
    })
    .refine((d) => Boolean(d.contentBase64) || Boolean(d.tempPath), {
      message: 'Either contentBase64 or tempPath must be provided',
    }),
  output: z.object({
    success: z.boolean(),
    cancelled: z.boolean().optional(),
    path: z.string().optional(),
    errorMessage: z.string().optional(),
  }),
} as const;

// gRPC — proto loading + unary call. Streaming + reflection come in a
// follow-up milestone. The proto file is referenced by absolute path on
// disk; the renderer picks it via a file dialog and stores the path on the
// request's body.
export const GrpcLoadProtoContract = {
  input: z.object({ protoPath: z.string().min(1) }),
  output: z.object({
    ok: z.boolean(),
    services: z
      .array(
        z.object({
          name: z.string(),
          methods: z.array(
            z.object({
              name: z.string(),
              requestStream: z.boolean(),
              responseStream: z.boolean(),
              requestType: z.string(),
              responseType: z.string(),
            }),
          ),
        }),
      )
      .default([]),
    error: z.string().optional(),
  }),
} as const;

export const GrpcInvokeContract = {
  input: z.object({
    address: z.string().min(1),
    protoPath: z.string().min(1),
    service: z.string().min(1),
    method: z.string().min(1),
    message: z.string().default('{}'),
    metadata: z.record(z.string()).optional(),
    timeoutMs: z.number().int().min(0).optional(),
  }),
  output: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      response: z.unknown(),
      durationMs: z.number(),
    }),
    z.object({
      ok: z.literal(false),
      errorCode: z.string(),
      errorMessage: z.string(),
      durationMs: z.number(),
    }),
  ]),
} as const;

// Streaming RPCs — open returns a connectionId; the renderer drives further
// sends via grpc:streamSend / grpc:streamHalfClose and tears down via
// grpc:streamClose. Server → client messages and state changes are pushed
// back as `grpc:stream:message` / `grpc:stream:state` events.
export const GrpcOpenStreamContract = {
  input: z.object({
    address: z.string().min(1),
    protoPath: z.string().min(1),
    service: z.string().min(1),
    method: z.string().min(1),
    message: z.string().optional(),
    metadata: z.record(z.string()).optional(),
  }),
  output: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      connectionId: z.string(),
      mode: z.enum(['server', 'client', 'bidi']),
    }),
    z.object({
      ok: z.literal(false),
      errorCode: z.string(),
      errorMessage: z.string(),
    }),
  ]),
} as const;

export const GrpcStreamSendContract = {
  input: z.object({ connectionId: z.string(), message: z.string() }),
  output: z.object({ ok: z.boolean(), error: z.string().optional() }),
} as const;

export const GrpcStreamHalfCloseContract = {
  input: z.object({ connectionId: z.string() }),
  output: z.object({ ok: z.boolean(), error: z.string().optional() }),
} as const;

export const GrpcStreamCloseContract = {
  input: z.object({ connectionId: z.string() }),
  output: z.object({ ok: z.boolean() }),
} as const;

// Plugin runtime — discovers user-supplied .js files under the plugins
// folder, evaluates each in its own vm context, and exposes registered
// response-body transformers. UI surfaces include a Plugins modal (list +
// reload + open folder) and a Transform dropdown in the response viewer.
const TransformerInfoSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  localId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  matchContentType: z.string().optional(),
});
const PluginInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().optional(),
  filePath: z.string(),
  error: z.string().nullable(),
  transformers: z.array(TransformerInfoSchema),
});

export const PluginsListContract = {
  input: z.object({}),
  output: z.object({
    plugins: z.array(PluginInfoSchema),
    dir: z.string(),
  }),
} as const;

export const PluginsReloadContract = {
  input: z.object({}),
  output: z.object({
    loaded: z.number().int(),
    errored: z.number().int(),
    dir: z.string(),
    plugins: z.array(PluginInfoSchema),
  }),
} as const;

export const PluginsOpenFolderContract = {
  input: z.object({}),
  output: z.object({ ok: z.boolean(), dir: z.string() }),
} as const;

export const PluginsApplyTransformerContract = {
  input: z.object({
    transformerId: z.string(),
    body: z.string(),
    contentType: z.string().nullable().optional(),
    headers: z.record(z.string()).optional(),
  }),
  output: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      body: z.string(),
      contentType: z.string().nullable(),
    }),
    z.object({ ok: z.literal(false), error: z.string() }),
  ]),
} as const;

// Mock server — local HTTP server that answers matching requests with
// predefined responses (per-collection mocks). Status broadcast on change.
export const MockStatusContract = {
  input: z.object({}),
  output: z.object({
    running: z.boolean(),
    port: z.number().int().min(1).max(65535),
    activeMockCount: z.number().int(),
    error: z.string().optional(),
  }),
} as const;
export const MockStartContract = {
  input: z.object({ port: z.number().int().min(1).max(65535).optional() }),
  output: z.object({
    running: z.boolean(),
    port: z.number().int().min(1).max(65535),
    error: z.string().optional(),
  }),
} as const;
export const MockStopContract = {
  input: z.object({}),
  output: z.object({ running: z.literal(false) }),
} as const;

// WebSocket — persistent connection lives in main; messages are pushed back
// to the renderer via 'volt:event' with kind 'ws:message' or 'ws:state'.
export const WsOpenContract = {
  input: z.object({
    url: z.string(),
    headers: z.record(z.string()).optional(),
    protocols: z.array(z.string()).optional(),
  }),
  output: z.object({ connectionId: z.string(), ok: z.boolean(), error: z.string().optional() }),
} as const;
export const WsSendContract = {
  input: z.object({ connectionId: z.string(), text: z.string() }),
  output: z.object({ ok: z.boolean(), error: z.string().optional() }),
} as const;
export const WsCloseContract = {
  input: z.object({
    connectionId: z.string(),
    code: z.number().int().optional(),
    reason: z.string().optional(),
  }),
  output: z.object({ ok: z.boolean() }),
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

// ─────────────────────────────────────────────────────────
// Desktop widget (macOS "Volt Quick Run")
// ─────────────────────────────────────────────────────────

export const WidgetFavoritesContract = {
  input: z.object({}),
  output: z.object({ requestIds: z.array(z.string()), supported: z.boolean() }),
} as const;

export const WidgetSetFavoriteContract = {
  input: z.object({ requestId: uuid, favorite: z.boolean() }),
  output: z.object({ requestIds: z.array(z.string()) }),
} as const;

export const WidgetReadyContract = {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
} as const;

export const WidgetRunResultContract = {
  input: z.object({ runId: z.string().min(1).max(64), ok: z.boolean(), error: z.string().max(500).optional() }),
  output: z.object({ ok: z.boolean() }),
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
    mocks: z.array(MockDefinition).optional(),
  }),
  output: Collection,
} as const;

export const CollectionDeleteContract = {
  input: z.object({ id: uuid }),
  output: z.object({ deleted: z.boolean() }),
} as const;

/** Deep-copy a collection (sub-folders + requests) next to the original. */
export const CollectionDuplicateContract = {
  input: z.object({ id: uuid }),
  output: Collection.nullable(),
} as const;

export const CollectionExportContract = {
  input: z.object({
    workspaceId: uuid,
    // If omitted, exports everything in the workspace under a synthetic root.
    collectionId: uuid.optional(),
    format: z.enum(['postman', 'insomnia', 'openapi', 'markdown']),
  }),
  output: z.object({
    success: z.boolean(),
    /** Absolute path of the written file on disk. */
    path: z.string().optional(),
    /** "User cancelled" when the save dialog was dismissed. */
    cancelled: z.boolean().optional(),
    errorMessage: z.string().optional(),
  }),
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

// Local conflict log — populated by the sync engine when a pull overwrites
// a row that had unpushed local edits. The renderer reads this list to
// show the conflict banner + the resolution modal; restore re-applies the
// captured previousState as a fresh local edit so the next push wins.
const ConflictRowSchema = z.object({
  id: z.string(),
  workspaceId: uuid,
  table: z.enum(['collection', 'request', 'environment']),
  rowId: z.string(),
  previousState: z.unknown(),
  overwrittenByName: z.string(),
  overwrittenByUserId: z.string(),
  overwrittenAt: z.number().int(),
  dismissedAt: z.number().int().nullable(),
});

export const ConflictListContract = {
  input: z.object({ workspaceId: uuid }),
  output: z.array(ConflictRowSchema),
} as const;

export const ConflictDismissContract = {
  input: z.object({ id: z.string() }),
  output: z.object({ ok: z.literal(true) }),
} as const;

export const ConflictRestoreContract = {
  input: z.object({ id: z.string() }),
  output: z.object({
    ok: z.boolean(),
    error: z.string().optional(),
  }),
} as const;

// ─────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────

export const ImportSourceContract = {
  input: z.object({
    workspaceId: uuid,
    source: z.enum(['postman', 'insomnia', 'openapi', 'curl', 'har']),
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

export const ReadFileTextContract = {
  input: z.object({
    filePath: z.string(),
    /** Read at most this many bytes (default 4 MiB). Used by import preview. */
    maxBytes: z.number().int().positive().optional(),
  }),
  output: z.object({
    content: z.string(),
    truncated: z.boolean(),
    error: z.string().optional(),
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
// Billing & audit log (proxied to backend)
// ─────────────────────────────────────────────────────────

export const TeamBillingContract = {
  input: z.object({ teamId: uuid }),
  // The backend returns plan, status, currentPeriodEnd, cancelAtPeriodEnd,
  // and a `configured` flag indicating whether Stripe env vars are set.
  output: z.any(),
} as const;

export const TeamBillingCheckoutContract = {
  input: z.object({ teamId: uuid }),
  // Returns { url, sessionId }. The desktop handler opens `url` in the
  // default browser via shell.openExternal as a convenience.
  output: z.any(),
} as const;

export const TeamBillingPortalContract = {
  input: z.object({ teamId: uuid }),
  output: z.any(),
} as const;

export const TeamAuditLogContract = {
  input: z.object({ teamId: uuid, limit: z.number().int().optional() }),
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

const OAuth2ConfigSchema = z.object({
  grant: z.enum(['client_credentials', 'password', 'authorization_code']),
  tokenUrl: z.string(),
  authUrl: z.string().optional(),
  redirectUri: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  tokenCacheKey: z.string(),
});

export const OAuthEnsureTokenContract = {
  input: OAuth2ConfigSchema,
  output: z.object({
    ok: z.boolean(),
    accessToken: z.string().optional(),
    tokenType: z.string().optional(),
    expiresAt: z.number().optional(),
    error: z.string().optional(),
  }),
} as const;
export const OAuthGetAuthUrlContract = {
  input: OAuth2ConfigSchema,
  output: z.object({ url: z.string(), verifier: z.string() }),
} as const;
export const OAuthExchangeCodeContract = {
  input: OAuth2ConfigSchema.extend({
    code: z.string(),
    verifier: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    accessToken: z.string().optional(),
    error: z.string().optional(),
  }),
} as const;

// Auto headers attached to every outgoing request unless overridden by the
// user's request headers (case-insensitive). Stored globally per-device.
const AutoHeaderSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().max(2_000),
  enabled: z.boolean(),
  builtin: z.boolean().optional(),
  description: z.string().optional(),
});
export const AutoHeadersGetContract = {
  input: z.object({}),
  output: z.array(AutoHeaderSchema),
} as const;
export const AutoHeadersSetContract = {
  input: z.object({ items: z.array(AutoHeaderSchema) }),
  output: z.object({ ok: z.literal(true) }),
} as const;

// ─────────────────────────────────────────────────────────
// Channel registry — single source of truth for the bridge.
// The preload script reads this to build the typed window.volt API.
// ─────────────────────────────────────────────────────────

export const IPC = {
  'request:send': RequestSendContract,
  'request:cancel': RequestCancelContract,
  'response:saveBody': ResponseSaveBodyContract,

  'ws:open': WsOpenContract,
  'ws:send': WsSendContract,
  'ws:close': WsCloseContract,

  'grpc:loadProto': GrpcLoadProtoContract,
  'grpc:invoke': GrpcInvokeContract,
  'grpc:openStream': GrpcOpenStreamContract,
  'grpc:streamSend': GrpcStreamSendContract,
  'grpc:streamHalfClose': GrpcStreamHalfCloseContract,
  'grpc:streamClose': GrpcStreamCloseContract,

  'mock:status': MockStatusContract,
  'mock:start': MockStartContract,
  'mock:stop': MockStopContract,

  'plugins:list': PluginsListContract,
  'plugins:reload': PluginsReloadContract,
  'plugins:openFolder': PluginsOpenFolderContract,
  'plugins:applyTransformer': PluginsApplyTransformerContract,

  'workspace:list': WorkspaceListContract,
  'workspace:create': WorkspaceCreateContract,
  'workspace:rename': WorkspaceRenameContract,
  'workspace:delete': WorkspaceDeleteContract,

  'collection:list': CollectionListContract,
  'collection:create': CollectionCreateContract,
  'collection:update': CollectionUpdateContract,
  'collection:delete': CollectionDeleteContract,
  'collection:duplicate': CollectionDuplicateContract,
  'collection:export': CollectionExportContract,

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
  'team:billing': TeamBillingContract,
  'team:billingCheckout': TeamBillingCheckoutContract,
  'team:billingPortal': TeamBillingPortalContract,
  'team:auditLog': TeamAuditLogContract,

  'widget:favorites': WidgetFavoritesContract,
  'widget:setFavorite': WidgetSetFavoriteContract,
  'widget:ready': WidgetReadyContract,
  'widget:runResult': WidgetRunResultContract,

  'globals:list': GlobalsListContract,
  'globals:set': GlobalsSetContract,
  'globals:delete': GlobalsDeleteContract,

  'oauth:ensureToken': OAuthEnsureTokenContract,
  'oauth:getAuthUrl': OAuthGetAuthUrlContract,
  'oauth:exchangeCode': OAuthExchangeCodeContract,

  'autoHeaders:get': AutoHeadersGetContract,
  'autoHeaders:set': AutoHeadersSetContract,

  'sync:status': SyncStatusContract,
  'sync:force': SyncForceContract,

  'conflict:list': ConflictListContract,
  'conflict:dismiss': ConflictDismissContract,
  'conflict:restore': ConflictRestoreContract,

  'import:source': ImportSourceContract,

  'app:info': AppInfoContract,
  'app:openExternal': OpenExternalContract,
  'app:showFilePicker': ShowFilePickerContract,
  'app:readFileText': ReadFileTextContract,
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
