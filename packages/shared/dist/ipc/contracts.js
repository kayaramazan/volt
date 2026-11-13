"use strict";
// IPC contract registry.
// Every channel between renderer and main is declared here with input/output
// Zod schemas. The preload script uses this list to auto-generate a typed
// window.volt API for the renderer.
//
// Naming convention: <domain>:<verb>  (e.g., "request:send", "collection:list")
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRegisterContract = exports.AuthLoginContract = exports.AuthStatusContract = exports.HistoryClearContract = exports.HistoryGetContract = exports.HistoryListContract = exports.EnvGetActiveContract = exports.EnvSetActiveContract = exports.EnvDeleteContract = exports.EnvUpdateContract = exports.EnvCreateContract = exports.EnvListContract = exports.RequestDeleteContract = exports.RequestUpdateContract = exports.RequestCreateContract = exports.RequestGetContract = exports.RequestListContract = exports.CollectionExportContract = exports.CollectionDuplicateContract = exports.CollectionDeleteContract = exports.CollectionUpdateContract = exports.CollectionCreateContract = exports.CollectionListContract = exports.WorkspaceDeleteContract = exports.WorkspaceRenameContract = exports.WidgetRunResultContract = exports.WidgetReadyContract = exports.WidgetSetFavoriteContract = exports.WidgetFavoritesContract = exports.WorkspaceCreateContract = exports.WorkspaceListContract = exports.WsCloseContract = exports.WsSendContract = exports.WsOpenContract = exports.MockStopContract = exports.MockStartContract = exports.MockStatusContract = exports.PluginsApplyTransformerContract = exports.PluginsOpenFolderContract = exports.PluginsReloadContract = exports.PluginsListContract = exports.GrpcStreamCloseContract = exports.GrpcStreamHalfCloseContract = exports.GrpcStreamSendContract = exports.GrpcOpenStreamContract = exports.GrpcInvokeContract = exports.GrpcLoadProtoContract = exports.ResponseSaveBodyContract = exports.RequestCancelContract = exports.RequestSendContract = void 0;
exports.MainEvent = exports.DataChangedEvent = exports.ConflictDetectedEvent = exports.SyncStateChangedEvent = exports.IPC = exports.AutoHeadersSetContract = exports.AutoHeadersGetContract = exports.OAuthExchangeCodeContract = exports.OAuthGetAuthUrlContract = exports.OAuthEnsureTokenContract = exports.GlobalsDeleteContract = exports.GlobalsSetContract = exports.GlobalsListContract = exports.TeamAuditLogContract = exports.TeamBillingPortalContract = exports.TeamBillingCheckoutContract = exports.TeamBillingContract = exports.TeamAcceptInviteContract = exports.TeamInviteContract = exports.TeamCreateContract = exports.TeamListContract = exports.ReadFileTextContract = exports.ShowFilePickerContract = exports.OpenExternalContract = exports.AppInfoContract = exports.ImportSourceContract = exports.ConflictRestoreContract = exports.ConflictDismissContract = exports.ConflictListContract = exports.SyncForceContract = exports.SyncStatusContract = exports.AuthLogoutContract = void 0;
const zod_1 = require("zod");
const index_1 = require("../index");
const uuid = zod_1.z.string().uuid();
// ─────────────────────────────────────────────────────────
// Request execution
// ─────────────────────────────────────────────────────────
exports.RequestSendContract = {
    input: index_1.SendRequestInput,
    output: index_1.SendRequestOutput,
};
exports.RequestCancelContract = {
    input: zod_1.z.object({ inFlightId: zod_1.z.string() }),
    output: zod_1.z.object({ cancelled: zod_1.z.boolean() }),
};
// Save the body of the last response to a user-chosen file. Caller passes
// either base64-encoded body (small responses) or a temp file path (large
// responses that were streamed to disk).
exports.ResponseSaveBodyContract = {
    input: zod_1.z
        .object({
        defaultName: zod_1.z.string(),
        contentBase64: zod_1.z.string().nullable().optional(),
        tempPath: zod_1.z.string().nullable().optional(),
    })
        .refine((d) => Boolean(d.contentBase64) || Boolean(d.tempPath), {
        message: 'Either contentBase64 or tempPath must be provided',
    }),
    output: zod_1.z.object({
        success: zod_1.z.boolean(),
        cancelled: zod_1.z.boolean().optional(),
        path: zod_1.z.string().optional(),
        errorMessage: zod_1.z.string().optional(),
    }),
};
// gRPC — proto loading + unary call. Streaming + reflection come in a
// follow-up milestone. The proto file is referenced by absolute path on
// disk; the renderer picks it via a file dialog and stores the path on the
// request's body.
exports.GrpcLoadProtoContract = {
    input: zod_1.z.object({ protoPath: zod_1.z.string().min(1) }),
    output: zod_1.z.object({
        ok: zod_1.z.boolean(),
        services: zod_1.z
            .array(zod_1.z.object({
            name: zod_1.z.string(),
            methods: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(),
                requestStream: zod_1.z.boolean(),
                responseStream: zod_1.z.boolean(),
                requestType: zod_1.z.string(),
                responseType: zod_1.z.string(),
            })),
        }))
            .default([]),
        error: zod_1.z.string().optional(),
    }),
};
exports.GrpcInvokeContract = {
    input: zod_1.z.object({
        address: zod_1.z.string().min(1),
        protoPath: zod_1.z.string().min(1),
        service: zod_1.z.string().min(1),
        method: zod_1.z.string().min(1),
        message: zod_1.z.string().default('{}'),
        metadata: zod_1.z.record(zod_1.z.string()).optional(),
        timeoutMs: zod_1.z.number().int().min(0).optional(),
    }),
    output: zod_1.z.discriminatedUnion('ok', [
        zod_1.z.object({
            ok: zod_1.z.literal(true),
            response: zod_1.z.unknown(),
            durationMs: zod_1.z.number(),
        }),
        zod_1.z.object({
            ok: zod_1.z.literal(false),
            errorCode: zod_1.z.string(),
            errorMessage: zod_1.z.string(),
            durationMs: zod_1.z.number(),
        }),
    ]),
};
// Streaming RPCs — open returns a connectionId; the renderer drives further
// sends via grpc:streamSend / grpc:streamHalfClose and tears down via
// grpc:streamClose. Server → client messages and state changes are pushed
// back as `grpc:stream:message` / `grpc:stream:state` events.
exports.GrpcOpenStreamContract = {
    input: zod_1.z.object({
        address: zod_1.z.string().min(1),
        protoPath: zod_1.z.string().min(1),
        service: zod_1.z.string().min(1),
        method: zod_1.z.string().min(1),
        message: zod_1.z.string().optional(),
        metadata: zod_1.z.record(zod_1.z.string()).optional(),
    }),
    output: zod_1.z.discriminatedUnion('ok', [
        zod_1.z.object({
            ok: zod_1.z.literal(true),
            connectionId: zod_1.z.string(),
            mode: zod_1.z.enum(['server', 'client', 'bidi']),
        }),
        zod_1.z.object({
            ok: zod_1.z.literal(false),
            errorCode: zod_1.z.string(),
            errorMessage: zod_1.z.string(),
        }),
    ]),
};
exports.GrpcStreamSendContract = {
    input: zod_1.z.object({ connectionId: zod_1.z.string(), message: zod_1.z.string() }),
    output: zod_1.z.object({ ok: zod_1.z.boolean(), error: zod_1.z.string().optional() }),
};
exports.GrpcStreamHalfCloseContract = {
    input: zod_1.z.object({ connectionId: zod_1.z.string() }),
    output: zod_1.z.object({ ok: zod_1.z.boolean(), error: zod_1.z.string().optional() }),
};
exports.GrpcStreamCloseContract = {
    input: zod_1.z.object({ connectionId: zod_1.z.string() }),
    output: zod_1.z.object({ ok: zod_1.z.boolean() }),
};
// Plugin runtime — discovers user-supplied .js files under the plugins
// folder, evaluates each in its own vm context, and exposes registered
// response-body transformers. UI surfaces include a Plugins modal (list +
// reload + open folder) and a Transform dropdown in the response viewer.
const TransformerInfoSchema = zod_1.z.object({
    id: zod_1.z.string(),
    pluginId: zod_1.z.string(),
    localId: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    matchContentType: zod_1.z.string().optional(),
});
const PluginInfoSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    filePath: zod_1.z.string(),
    error: zod_1.z.string().nullable(),
    transformers: zod_1.z.array(TransformerInfoSchema),
});
exports.PluginsListContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        plugins: zod_1.z.array(PluginInfoSchema),
        dir: zod_1.z.string(),
    }),
};
exports.PluginsReloadContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        loaded: zod_1.z.number().int(),
        errored: zod_1.z.number().int(),
        dir: zod_1.z.string(),
        plugins: zod_1.z.array(PluginInfoSchema),
    }),
};
exports.PluginsOpenFolderContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({ ok: zod_1.z.boolean(), dir: zod_1.z.string() }),
};
exports.PluginsApplyTransformerContract = {
    input: zod_1.z.object({
        transformerId: zod_1.z.string(),
        body: zod_1.z.string(),
        contentType: zod_1.z.string().nullable().optional(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
    }),
    output: zod_1.z.discriminatedUnion('ok', [
        zod_1.z.object({
            ok: zod_1.z.literal(true),
            body: zod_1.z.string(),
            contentType: zod_1.z.string().nullable(),
        }),
        zod_1.z.object({ ok: zod_1.z.literal(false), error: zod_1.z.string() }),
    ]),
};
// Mock server — local HTTP server that answers matching requests with
// predefined responses (per-collection mocks). Status broadcast on change.
exports.MockStatusContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        running: zod_1.z.boolean(),
        port: zod_1.z.number().int().min(1).max(65535),
        activeMockCount: zod_1.z.number().int(),
        error: zod_1.z.string().optional(),
    }),
};
exports.MockStartContract = {
    input: zod_1.z.object({ port: zod_1.z.number().int().min(1).max(65535).optional() }),
    output: zod_1.z.object({
        running: zod_1.z.boolean(),
        port: zod_1.z.number().int().min(1).max(65535),
        error: zod_1.z.string().optional(),
    }),
};
exports.MockStopContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({ running: zod_1.z.literal(false) }),
};
// WebSocket — persistent connection lives in main; messages are pushed back
// to the renderer via 'volt:event' with kind 'ws:message' or 'ws:state'.
exports.WsOpenContract = {
    input: zod_1.z.object({
        url: zod_1.z.string(),
        headers: zod_1.z.record(zod_1.z.string()).optional(),
        protocols: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    output: zod_1.z.object({ connectionId: zod_1.z.string(), ok: zod_1.z.boolean(), error: zod_1.z.string().optional() }),
};
exports.WsSendContract = {
    input: zod_1.z.object({ connectionId: zod_1.z.string(), text: zod_1.z.string() }),
    output: zod_1.z.object({ ok: zod_1.z.boolean(), error: zod_1.z.string().optional() }),
};
exports.WsCloseContract = {
    input: zod_1.z.object({
        connectionId: zod_1.z.string(),
        code: zod_1.z.number().int().optional(),
        reason: zod_1.z.string().optional(),
    }),
    output: zod_1.z.object({ ok: zod_1.z.boolean() }),
};
// ─────────────────────────────────────────────────────────
// Workspaces (local DB)
// ─────────────────────────────────────────────────────────
exports.WorkspaceListContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        personal: zod_1.z.array(index_1.Workspace),
        team: zod_1.z.array(index_1.Workspace),
    }),
};
exports.WorkspaceCreateContract = {
    input: zod_1.z.object({ name: zod_1.z.string().min(1).max(120), teamId: uuid.optional() }),
    output: index_1.Workspace,
};
// ─────────────────────────────────────────────────────────
// Desktop widget (macOS "Volt Quick Run")
// ─────────────────────────────────────────────────────────
exports.WidgetFavoritesContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({ requestIds: zod_1.z.array(zod_1.z.string()), supported: zod_1.z.boolean() }),
};
exports.WidgetSetFavoriteContract = {
    input: zod_1.z.object({ requestId: uuid, favorite: zod_1.z.boolean() }),
    output: zod_1.z.object({ requestIds: zod_1.z.array(zod_1.z.string()) }),
};
exports.WidgetReadyContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({ ok: zod_1.z.boolean() }),
};
exports.WidgetRunResultContract = {
    input: zod_1.z.object({ runId: zod_1.z.string().min(1).max(64), ok: zod_1.z.boolean(), error: zod_1.z.string().max(500).optional() }),
    output: zod_1.z.object({ ok: zod_1.z.boolean() }),
};
exports.WorkspaceRenameContract = {
    input: zod_1.z.object({ id: uuid, name: zod_1.z.string().min(1).max(120) }),
    output: index_1.Workspace,
};
exports.WorkspaceDeleteContract = {
    input: zod_1.z.object({ id: uuid }),
    output: zod_1.z.object({ deleted: zod_1.z.boolean() }),
};
// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────
exports.CollectionListContract = {
    input: zod_1.z.object({ workspaceId: uuid }),
    output: zod_1.z.array(index_1.Collection),
};
exports.CollectionCreateContract = {
    input: zod_1.z.object({
        workspaceId: uuid,
        parentId: uuid.nullable(),
        name: zod_1.z.string().min(1).max(200),
    }),
    output: index_1.Collection,
};
exports.CollectionUpdateContract = {
    input: zod_1.z.object({
        id: uuid,
        name: zod_1.z.string().min(1).max(200).optional(),
        parentId: uuid.nullable().optional(),
        description: zod_1.z.string().max(200_000).optional(),
        sortOrder: zod_1.z.number().int().optional(),
        variables: zod_1.z.array(index_1.Variable).optional(),
        mocks: zod_1.z.array(index_1.MockDefinition).optional(),
    }),
    output: index_1.Collection,
};
exports.CollectionDeleteContract = {
    input: zod_1.z.object({ id: uuid }),
    output: zod_1.z.object({ deleted: zod_1.z.boolean() }),
};
/** Deep-copy a collection (sub-folders + requests) next to the original. */
exports.CollectionDuplicateContract = {
    input: zod_1.z.object({ id: uuid }),
    output: index_1.Collection.nullable(),
};
exports.CollectionExportContract = {
    input: zod_1.z.object({
        workspaceId: uuid,
        // If omitted, exports everything in the workspace under a synthetic root.
        collectionId: uuid.optional(),
        format: zod_1.z.enum(['postman', 'insomnia', 'openapi', 'markdown']),
    }),
    output: zod_1.z.object({
        success: zod_1.z.boolean(),
        /** Absolute path of the written file on disk. */
        path: zod_1.z.string().optional(),
        /** "User cancelled" when the save dialog was dismissed. */
        cancelled: zod_1.z.boolean().optional(),
        errorMessage: zod_1.z.string().optional(),
    }),
};
// ─────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────
exports.RequestListContract = {
    input: zod_1.z.object({ workspaceId: uuid, collectionId: uuid.nullable().optional() }),
    output: zod_1.z.array(index_1.ApiRequest),
};
exports.RequestGetContract = {
    input: zod_1.z.object({ id: uuid }),
    output: index_1.ApiRequest,
};
exports.RequestCreateContract = {
    input: index_1.ApiRequest.omit({ id: true, revision: true }).partial({
        headers: true,
        queryParams: true,
        body: true,
        auth: true,
        sortOrder: true,
    }),
    output: index_1.ApiRequest,
};
exports.RequestUpdateContract = {
    input: index_1.ApiRequest.partial().required({ id: true }),
    output: index_1.ApiRequest,
};
exports.RequestDeleteContract = {
    input: zod_1.z.object({ id: uuid }),
    output: zod_1.z.object({ deleted: zod_1.z.boolean() }),
};
// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────
exports.EnvListContract = {
    input: zod_1.z.object({ workspaceId: uuid }),
    output: zod_1.z.array(index_1.Environment),
};
exports.EnvCreateContract = {
    input: zod_1.z.object({ workspaceId: uuid, name: zod_1.z.string().min(1).max(120) }),
    output: index_1.Environment,
};
exports.EnvUpdateContract = {
    input: index_1.Environment.partial().required({ id: true }),
    output: index_1.Environment,
};
exports.EnvDeleteContract = {
    input: zod_1.z.object({ id: uuid }),
    output: zod_1.z.object({ deleted: zod_1.z.boolean() }),
};
// "Active" env is a per-workspace local-only setting (not synced).
exports.EnvSetActiveContract = {
    input: zod_1.z.object({ workspaceId: uuid, environmentId: uuid.nullable() }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
exports.EnvGetActiveContract = {
    input: zod_1.z.object({ workspaceId: uuid }),
    output: zod_1.z.object({ environmentId: uuid.nullable() }),
};
// ─────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────
exports.HistoryListContract = {
    input: zod_1.z.object({
        workspaceId: uuid,
        limit: zod_1.z.number().int().min(1).max(500).default(50),
        cursor: zod_1.z.string().datetime().optional(),
        search: zod_1.z.string().optional(),
    }),
    output: zod_1.z.object({
        entries: zod_1.z.array(index_1.HistoryEntry),
        nextCursor: zod_1.z.string().datetime().nullable(),
    }),
};
exports.HistoryGetContract = {
    input: zod_1.z.object({ id: uuid }),
    output: index_1.HistoryEntry.extend({
        responseHeaders: zod_1.z.array(zod_1.z.tuple([zod_1.z.string(), zod_1.z.string()])).nullable(),
        responseBodyBase64: zod_1.z.string().nullable(),
        responseBodyTempFile: zod_1.z.string().nullable(),
        responseContentType: zod_1.z.string().nullable(),
        responseSizeBytes: zod_1.z.number().int().nullable(),
    }),
};
exports.HistoryClearContract = {
    input: zod_1.z.object({ workspaceId: uuid }),
    output: zod_1.z.object({ cleared: zod_1.z.number().int() }),
};
// ─────────────────────────────────────────────────────────
// Auth (talks to backend on behalf of renderer)
// ─────────────────────────────────────────────────────────
exports.AuthStatusContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        loggedIn: zod_1.z.boolean(),
        email: zod_1.z.string().email().nullable(),
        name: zod_1.z.string().nullable(),
    }),
};
exports.AuthLoginContract = {
    input: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
    }),
    output: zod_1.z.object({
        success: zod_1.z.boolean(),
        errorMessage: zod_1.z.string().optional(),
    }),
};
exports.AuthRegisterContract = {
    input: zod_1.z.object({
        email: zod_1.z.string().email(),
        name: zod_1.z.string().min(1).max(120),
        password: zod_1.z.string().min(8),
    }),
    output: zod_1.z.object({
        success: zod_1.z.boolean(),
        errorMessage: zod_1.z.string().optional(),
    }),
};
exports.AuthLogoutContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
// ─────────────────────────────────────────────────────────
// Sync
// ─────────────────────────────────────────────────────────
exports.SyncStatusContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        state: zod_1.z.enum(['offline', 'syncing', 'synced', 'conflict', 'error']),
        lastSyncedAt: zod_1.z.string().datetime().nullable(),
        pendingChanges: zod_1.z.number().int(),
        errorMessage: zod_1.z.string().optional(),
    }),
};
exports.SyncForceContract = {
    input: zod_1.z.object({ workspaceId: uuid.optional() }),
    output: zod_1.z.object({ started: zod_1.z.boolean() }),
};
// Local conflict log — populated by the sync engine when a pull overwrites
// a row that had unpushed local edits. The renderer reads this list to
// show the conflict banner + the resolution modal; restore re-applies the
// captured previousState as a fresh local edit so the next push wins.
const ConflictRowSchema = zod_1.z.object({
    id: zod_1.z.string(),
    workspaceId: uuid,
    table: zod_1.z.enum(['collection', 'request', 'environment']),
    rowId: zod_1.z.string(),
    previousState: zod_1.z.unknown(),
    overwrittenByName: zod_1.z.string(),
    overwrittenByUserId: zod_1.z.string(),
    overwrittenAt: zod_1.z.number().int(),
    dismissedAt: zod_1.z.number().int().nullable(),
});
exports.ConflictListContract = {
    input: zod_1.z.object({ workspaceId: uuid }),
    output: zod_1.z.array(ConflictRowSchema),
};
exports.ConflictDismissContract = {
    input: zod_1.z.object({ id: zod_1.z.string() }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
exports.ConflictRestoreContract = {
    input: zod_1.z.object({ id: zod_1.z.string() }),
    output: zod_1.z.object({
        ok: zod_1.z.boolean(),
        error: zod_1.z.string().optional(),
    }),
};
// ─────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────
exports.ImportSourceContract = {
    input: zod_1.z.object({
        workspaceId: uuid,
        source: zod_1.z.enum(['postman', 'insomnia', 'openapi', 'curl', 'har']),
        // Either a file path on disk OR raw content (used for curl paste)
        filePath: zod_1.z.string().optional(),
        content: zod_1.z.string().optional(),
    }),
    output: zod_1.z.object({
        success: zod_1.z.boolean(),
        collectionId: uuid.optional(),
        requestId: uuid.optional(),
        summary: zod_1.z.object({
            collections: zod_1.z.number().int(),
            requests: zod_1.z.number().int(),
            environments: zod_1.z.number().int(),
            warnings: zod_1.z.array(zod_1.z.string()),
        }),
        errorMessage: zod_1.z.string().optional(),
    }),
};
// ─────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────
exports.AppInfoContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.object({
        version: zod_1.z.string(),
        platform: zod_1.z.enum(['macos', 'windows', 'linux']),
        dbPath: zod_1.z.string(),
    }),
};
exports.OpenExternalContract = {
    input: zod_1.z.object({ url: zod_1.z.string().url() }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
exports.ShowFilePickerContract = {
    input: zod_1.z.object({
        filters: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), extensions: zod_1.z.array(zod_1.z.string()) })).optional(),
    }),
    output: zod_1.z.object({
        cancelled: zod_1.z.boolean(),
        filePath: zod_1.z.string().optional(),
    }),
};
exports.ReadFileTextContract = {
    input: zod_1.z.object({
        filePath: zod_1.z.string(),
        /** Read at most this many bytes (default 4 MiB). Used by import preview. */
        maxBytes: zod_1.z.number().int().positive().optional(),
    }),
    output: zod_1.z.object({
        content: zod_1.z.string(),
        truncated: zod_1.z.boolean(),
        error: zod_1.z.string().optional(),
    }),
};
// ─────────────────────────────────────────────────────────
// Teams (proxied to backend on the user's behalf)
// ─────────────────────────────────────────────────────────
exports.TeamListContract = {
    input: zod_1.z.object({}),
    // Backend returns nested Prisma rows; keep loose since output isn't validated.
    output: zod_1.z.array(zod_1.z.any()),
};
exports.TeamCreateContract = {
    input: zod_1.z.object({ name: zod_1.z.string().min(1).max(120) }),
    output: zod_1.z.any(),
};
exports.TeamInviteContract = {
    input: zod_1.z.object({ teamId: uuid, email: zod_1.z.string().email() }),
    output: zod_1.z.any(),
};
exports.TeamAcceptInviteContract = {
    input: zod_1.z.object({ code: zod_1.z.string().min(1) }),
    output: zod_1.z.any(),
};
// ─────────────────────────────────────────────────────────
// Billing & audit log (proxied to backend)
// ─────────────────────────────────────────────────────────
exports.TeamBillingContract = {
    input: zod_1.z.object({ teamId: uuid }),
    // The backend returns plan, status, currentPeriodEnd, cancelAtPeriodEnd,
    // and a `configured` flag indicating whether Stripe env vars are set.
    output: zod_1.z.any(),
};
exports.TeamBillingCheckoutContract = {
    input: zod_1.z.object({ teamId: uuid }),
    // Returns { url, sessionId }. The desktop handler opens `url` in the
    // default browser via shell.openExternal as a convenience.
    output: zod_1.z.any(),
};
exports.TeamBillingPortalContract = {
    input: zod_1.z.object({ teamId: uuid }),
    output: zod_1.z.any(),
};
exports.TeamAuditLogContract = {
    input: zod_1.z.object({ teamId: uuid, limit: zod_1.z.number().int().optional() }),
    output: zod_1.z.any(),
};
// ─────────────────────────────────────────────────────────
// Globals — per-device key/value set from pre/post-request scripts.
// ─────────────────────────────────────────────────────────
exports.GlobalsListContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.record(zod_1.z.unknown()),
};
exports.GlobalsSetContract = {
    input: zod_1.z.object({ key: zod_1.z.string().min(1), value: zod_1.z.unknown() }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
exports.GlobalsDeleteContract = {
    input: zod_1.z.object({ key: zod_1.z.string().min(1) }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
const OAuth2ConfigSchema = zod_1.z.object({
    grant: zod_1.z.enum(['client_credentials', 'password', 'authorization_code']),
    tokenUrl: zod_1.z.string(),
    authUrl: zod_1.z.string().optional(),
    redirectUri: zod_1.z.string().optional(),
    clientId: zod_1.z.string(),
    clientSecret: zod_1.z.string().optional(),
    scope: zod_1.z.string().optional(),
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    tokenCacheKey: zod_1.z.string(),
});
exports.OAuthEnsureTokenContract = {
    input: OAuth2ConfigSchema,
    output: zod_1.z.object({
        ok: zod_1.z.boolean(),
        accessToken: zod_1.z.string().optional(),
        tokenType: zod_1.z.string().optional(),
        expiresAt: zod_1.z.number().optional(),
        error: zod_1.z.string().optional(),
    }),
};
exports.OAuthGetAuthUrlContract = {
    input: OAuth2ConfigSchema,
    output: zod_1.z.object({ url: zod_1.z.string(), verifier: zod_1.z.string() }),
};
exports.OAuthExchangeCodeContract = {
    input: OAuth2ConfigSchema.extend({
        code: zod_1.z.string(),
        verifier: zod_1.z.string(),
    }),
    output: zod_1.z.object({
        ok: zod_1.z.boolean(),
        accessToken: zod_1.z.string().optional(),
        error: zod_1.z.string().optional(),
    }),
};
// Auto headers attached to every outgoing request unless overridden by the
// user's request headers (case-insensitive). Stored globally per-device.
const AutoHeaderSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(200),
    value: zod_1.z.string().max(2_000),
    enabled: zod_1.z.boolean(),
    builtin: zod_1.z.boolean().optional(),
    description: zod_1.z.string().optional(),
});
exports.AutoHeadersGetContract = {
    input: zod_1.z.object({}),
    output: zod_1.z.array(AutoHeaderSchema),
};
exports.AutoHeadersSetContract = {
    input: zod_1.z.object({ items: zod_1.z.array(AutoHeaderSchema) }),
    output: zod_1.z.object({ ok: zod_1.z.literal(true) }),
};
// ─────────────────────────────────────────────────────────
// Channel registry — single source of truth for the bridge.
// The preload script reads this to build the typed window.volt API.
// ─────────────────────────────────────────────────────────
exports.IPC = {
    'request:send': exports.RequestSendContract,
    'request:cancel': exports.RequestCancelContract,
    'response:saveBody': exports.ResponseSaveBodyContract,
    'ws:open': exports.WsOpenContract,
    'ws:send': exports.WsSendContract,
    'ws:close': exports.WsCloseContract,
    'grpc:loadProto': exports.GrpcLoadProtoContract,
    'grpc:invoke': exports.GrpcInvokeContract,
    'grpc:openStream': exports.GrpcOpenStreamContract,
    'grpc:streamSend': exports.GrpcStreamSendContract,
    'grpc:streamHalfClose': exports.GrpcStreamHalfCloseContract,
    'grpc:streamClose': exports.GrpcStreamCloseContract,
    'mock:status': exports.MockStatusContract,
    'mock:start': exports.MockStartContract,
    'mock:stop': exports.MockStopContract,
    'plugins:list': exports.PluginsListContract,
    'plugins:reload': exports.PluginsReloadContract,
    'plugins:openFolder': exports.PluginsOpenFolderContract,
    'plugins:applyTransformer': exports.PluginsApplyTransformerContract,
    'workspace:list': exports.WorkspaceListContract,
    'workspace:create': exports.WorkspaceCreateContract,
    'workspace:rename': exports.WorkspaceRenameContract,
    'workspace:delete': exports.WorkspaceDeleteContract,
    'collection:list': exports.CollectionListContract,
    'collection:create': exports.CollectionCreateContract,
    'collection:update': exports.CollectionUpdateContract,
    'collection:delete': exports.CollectionDeleteContract,
    'collection:duplicate': exports.CollectionDuplicateContract,
    'collection:export': exports.CollectionExportContract,
    'apiRequest:list': exports.RequestListContract,
    'apiRequest:get': exports.RequestGetContract,
    'apiRequest:create': exports.RequestCreateContract,
    'apiRequest:update': exports.RequestUpdateContract,
    'apiRequest:delete': exports.RequestDeleteContract,
    'env:list': exports.EnvListContract,
    'env:create': exports.EnvCreateContract,
    'env:update': exports.EnvUpdateContract,
    'env:delete': exports.EnvDeleteContract,
    'env:setActive': exports.EnvSetActiveContract,
    'env:getActive': exports.EnvGetActiveContract,
    'history:list': exports.HistoryListContract,
    'history:get': exports.HistoryGetContract,
    'history:clear': exports.HistoryClearContract,
    'auth:status': exports.AuthStatusContract,
    'auth:login': exports.AuthLoginContract,
    'auth:register': exports.AuthRegisterContract,
    'auth:logout': exports.AuthLogoutContract,
    'team:list': exports.TeamListContract,
    'team:create': exports.TeamCreateContract,
    'team:invite': exports.TeamInviteContract,
    'team:acceptInvite': exports.TeamAcceptInviteContract,
    'team:billing': exports.TeamBillingContract,
    'team:billingCheckout': exports.TeamBillingCheckoutContract,
    'team:billingPortal': exports.TeamBillingPortalContract,
    'team:auditLog': exports.TeamAuditLogContract,
    'widget:favorites': exports.WidgetFavoritesContract,
    'widget:setFavorite': exports.WidgetSetFavoriteContract,
    'widget:ready': exports.WidgetReadyContract,
    'widget:runResult': exports.WidgetRunResultContract,
    'globals:list': exports.GlobalsListContract,
    'globals:set': exports.GlobalsSetContract,
    'globals:delete': exports.GlobalsDeleteContract,
    'oauth:ensureToken': exports.OAuthEnsureTokenContract,
    'oauth:getAuthUrl': exports.OAuthGetAuthUrlContract,
    'oauth:exchangeCode': exports.OAuthExchangeCodeContract,
    'autoHeaders:get': exports.AutoHeadersGetContract,
    'autoHeaders:set': exports.AutoHeadersSetContract,
    'sync:status': exports.SyncStatusContract,
    'sync:force': exports.SyncForceContract,
    'conflict:list': exports.ConflictListContract,
    'conflict:dismiss': exports.ConflictDismissContract,
    'conflict:restore': exports.ConflictRestoreContract,
    'import:source': exports.ImportSourceContract,
    'app:info': exports.AppInfoContract,
    'app:openExternal': exports.OpenExternalContract,
    'app:showFilePicker': exports.ShowFilePickerContract,
    'app:readFileText': exports.ReadFileTextContract,
};
// ─────────────────────────────────────────────────────────
// Push-from-main events (one-way: main → renderer)
// Examples: "your sync state changed", "a conflict was detected"
// ─────────────────────────────────────────────────────────
exports.SyncStateChangedEvent = zod_1.z.object({
    type: zod_1.z.literal('sync:stateChanged'),
    state: zod_1.z.enum(['offline', 'syncing', 'synced', 'conflict', 'error']),
    pendingChanges: zod_1.z.number().int(),
});
exports.ConflictDetectedEvent = zod_1.z.object({
    type: zod_1.z.literal('sync:conflictDetected'),
    workspaceId: zod_1.z.string().uuid(),
    rowId: zod_1.z.string().uuid(),
    table: zod_1.z.enum(['collection', 'request', 'environment']),
    overwrittenByName: zod_1.z.string(),
});
exports.DataChangedEvent = zod_1.z.object({
    // Fired whenever local DB changes (push, pull, or local edit).
    // Renderer invalidates relevant TanStack Query keys.
    type: zod_1.z.literal('data:changed'),
    table: zod_1.z.enum(['collection', 'request', 'environment', 'workspace']),
    workspaceId: zod_1.z.string().uuid().optional(),
});
exports.MainEvent = zod_1.z.discriminatedUnion('type', [
    exports.SyncStateChangedEvent,
    exports.ConflictDetectedEvent,
    exports.DataChangedEvent,
]);
//# sourceMappingURL=contracts.js.map