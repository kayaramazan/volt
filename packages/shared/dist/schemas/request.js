"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryEntry = exports.SendRequestOutput = exports.ErrorResponse = exports.SuccessResponse = exports.ScriptOutput = exports.ScriptTestResult = exports.ResponseTiming = exports.SendRequestInput = exports.ResolvedRequest = exports.ApiRequest = exports.RequestExample = exports.RequestAuth = exports.OAuth2Auth = exports.ApiKeyAuth = exports.BasicAuth = exports.BearerAuth = exports.NoAuth = exports.RequestBody = exports.NoBody = exports.GrpcBody = exports.GraphQLBody = exports.BinaryBody = exports.UrlEncodedBody = exports.FormBody = exports.RawBody = exports.PathVariable = exports.QueryParam = exports.HeaderRow = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
// ─────────────────────────────────────────────────────────
// Headers / params / body / auth — the request shape
// ─────────────────────────────────────────────────────────
exports.HeaderRow = zod_1.z.object({
    id: zod_1.z.string(), // client-side stable id (uuid)
    key: zod_1.z.string(),
    value: zod_1.z.string(),
    enabled: zod_1.z.boolean().default(true),
    description: zod_1.z.string().optional(),
});
exports.QueryParam = exports.HeaderRow; // same shape
exports.PathVariable = exports.HeaderRow; // same shape: { id, key, value, enabled, description? }
// Body — discriminated union by type
exports.RawBody = zod_1.z.object({
    type: zod_1.z.literal('raw'),
    language: zod_1.z.enum(['json', 'xml', 'html', 'text', 'javascript']),
    content: zod_1.z.string(),
});
exports.FormBody = zod_1.z.object({
    type: zod_1.z.literal('form'),
    fields: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        key: zod_1.z.string(),
        // 'text' or 'file' field
        kind: zod_1.z.enum(['text', 'file']),
        value: zod_1.z.string(), // for file: absolute path
        enabled: zod_1.z.boolean().default(true),
    })),
});
exports.UrlEncodedBody = zod_1.z.object({
    type: zod_1.z.literal('urlencoded'),
    fields: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        key: zod_1.z.string(),
        value: zod_1.z.string(),
        enabled: zod_1.z.boolean().default(true),
    })),
});
exports.BinaryBody = zod_1.z.object({
    type: zod_1.z.literal('binary'),
    filePath: zod_1.z.string(), // absolute path on disk
});
exports.GraphQLBody = zod_1.z.object({
    type: zod_1.z.literal('graphql'),
    query: zod_1.z.string().default(''),
    variables: zod_1.z.string().default(''), // JSON string entered by the user
    operationName: zod_1.z.string().optional(),
});
// gRPC request — the request method/url/headers/auth from ApiRequest are
// unused for gRPC; instead, `address` is the server target (host:port), the
// proto file path is on disk (so we don't have to embed large .proto blobs
// in JSON), and `service`/`method` pick which unary call to invoke. `message`
// is a JSON-encoded representation of the request protobuf, deserialized by
// proto-loader on the main process. `metadata` is per-call gRPC metadata,
// analogous to HTTP headers.
exports.GrpcBody = zod_1.z.object({
    type: zod_1.z.literal('grpc'),
    address: zod_1.z.string().default('localhost:50051'),
    protoPath: zod_1.z.string().default(''),
    service: zod_1.z.string().default(''),
    method: zod_1.z.string().default(''),
    message: zod_1.z.string().default('{}'),
    metadata: zod_1.z
        .array(zod_1.z.object({ id: zod_1.z.string(), key: zod_1.z.string(), value: zod_1.z.string(), enabled: zod_1.z.boolean().default(true) }))
        .default([]),
});
exports.NoBody = zod_1.z.object({
    type: zod_1.z.literal('none'),
});
exports.RequestBody = zod_1.z.discriminatedUnion('type', [
    exports.NoBody,
    exports.RawBody,
    exports.FormBody,
    exports.UrlEncodedBody,
    exports.BinaryBody,
    exports.GraphQLBody,
    exports.GrpcBody,
]);
// Auth — also a discriminated union
exports.NoAuth = zod_1.z.object({ type: zod_1.z.literal('none') });
exports.BearerAuth = zod_1.z.object({
    type: zod_1.z.literal('bearer'),
    token: zod_1.z.string(),
});
exports.BasicAuth = zod_1.z.object({
    type: zod_1.z.literal('basic'),
    username: zod_1.z.string(),
    password: zod_1.z.string(),
});
exports.ApiKeyAuth = zod_1.z.object({
    type: zod_1.z.literal('apiKey'),
    key: zod_1.z.string(),
    value: zod_1.z.string(),
    placement: zod_1.z.enum(['header', 'query']),
});
// OAuth 2.0 — a few common grants. The actual access token (and any refresh
// token) is stored in the app_state KV under `oauth.<key>` so it survives
// restarts. The auth config here only holds the issuer details + grant params.
exports.OAuth2Auth = zod_1.z.object({
    type: zod_1.z.literal('oauth2'),
    grant: zod_1.z.enum(['client_credentials', 'password', 'authorization_code']),
    tokenUrl: zod_1.z.string().default(''),
    // authorization_code only
    authUrl: zod_1.z.string().optional(),
    redirectUri: zod_1.z.string().optional(),
    // common
    clientId: zod_1.z.string().default(''),
    clientSecret: zod_1.z.string().default(''),
    scope: zod_1.z.string().optional(),
    // password grant only
    username: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
    // where the resolver will inject the access token (Authorization header by default)
    headerPrefix: zod_1.z.string().default('Bearer'),
    // stable id used to look up persisted token in app_state
    tokenCacheKey: zod_1.z.string().default(''),
});
exports.RequestAuth = zod_1.z.discriminatedUnion('type', [
    exports.NoAuth,
    exports.BearerAuth,
    exports.BasicAuth,
    exports.ApiKeyAuth,
    exports.OAuth2Auth,
]);
// ─────────────────────────────────────────────────────────
// API request (stored in DB)
// ─────────────────────────────────────────────────────────
// A frozen snapshot of a sent request + its response, saved under a request.
// Useful for documenting expected responses or replaying examples later.
//
// We keep this loose on purpose — examples are user-saved snapshots, not a
// stable contract, and strict shape validation only causes pain when older
// rows drift. Just check the fields the UI lists/searches over.
exports.RequestExample = zod_1.z
    .object({
    id: zod_1.z.string(),
    name: zod_1.z.string().min(1).max(200),
    createdAt: zod_1.z.number().int(),
    request: zod_1.z.unknown().optional(),
    response: zod_1.z.unknown().nullable().optional(),
})
    .passthrough();
exports.ApiRequest = zod_1.z.object({
    id: uuid,
    workspaceId: uuid,
    collectionId: uuid.nullable(),
    name: zod_1.z.string().min(1).max(200),
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: zod_1.z.string().max(8_000), // before variable resolution; can contain {{vars}}
    headers: zod_1.z.array(exports.HeaderRow).default([]),
    queryParams: zod_1.z.array(exports.QueryParam).default([]),
    // Postman-style path variables: `/users/:id` + { key: 'id', value: '42' }.
    // Resolved in the renderer at send time; imported from Postman url.variable[]
    // and OpenAPI path parameters.
    pathVariables: zod_1.z.array(exports.PathVariable).default([]),
    body: exports.RequestBody.default({ type: 'none' }),
    auth: exports.RequestAuth.default({ type: 'none' }),
    // JavaScript run in a sandboxed vm before/after sending. Empty = no-op.
    // Pre-request can mutate `volt.request` and call `volt.globals.set(...)`.
    // Post-response sees a read-only `volt.response` and can also set globals.
    preRequestScript: zod_1.z.string().max(50_000).default(''),
    postResponseScript: zod_1.z.string().max(50_000).default(''),
    // Markdown documentation for this endpoint.
    description: zod_1.z.string().max(200_000).default(''),
    // Saved request/response snapshots — populated via "Add example" menu item.
    examples: zod_1.z.array(exports.RequestExample).default([]),
    sortOrder: zod_1.z.number().int().default(0),
    revision: zod_1.z.string().optional(),
});
// ─────────────────────────────────────────────────────────
// Resolved request (after variable substitution, ready to send)
// ─────────────────────────────────────────────────────────
exports.ResolvedRequest = zod_1.z.object({
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    // Was strict URL; relaxed so pre-request scripts can supply a final URL
    // that's still being built (or contains template segments). The engine
    // will fail with a clear error if it isn't fetchable.
    url: zod_1.z.string().min(1),
    headers: zod_1.z.record(zod_1.z.string()), // flat map after resolution
    body: zod_1.z.union([
        zod_1.z.object({ type: zod_1.z.literal('none') }),
        zod_1.z.object({ type: zod_1.z.literal('raw'), content: zod_1.z.string() }),
        zod_1.z.object({ type: zod_1.z.literal('form'), fields: zod_1.z.array(zod_1.z.object({ key: zod_1.z.string(), kind: zod_1.z.enum(['text', 'file']), value: zod_1.z.string() })) }),
        zod_1.z.object({ type: zod_1.z.literal('urlencoded'), content: zod_1.z.string() }),
        zod_1.z.object({ type: zod_1.z.literal('binary'), filePath: zod_1.z.string() }),
        zod_1.z.object({
            type: zod_1.z.literal('graphql'),
            query: zod_1.z.string().default(''),
            variables: zod_1.z.string().default(''),
            operationName: zod_1.z.string().optional(),
        }),
    ]),
    // Resolved auth merged into headers/url, so no separate auth field here.
    timeoutMs: zod_1.z.number().int().min(0).default(60_000),
    followRedirects: zod_1.z.boolean().default(true),
    ignoreTlsErrors: zod_1.z.boolean().default(false),
});
// ─────────────────────────────────────────────────────────
// Send request input + output (IPC contract)
// ─────────────────────────────────────────────────────────
exports.SendRequestInput = zod_1.z.object({
    // The request id is included so the renderer can show "in-flight" state
    // and the main process can cancel by id.
    inFlightId: zod_1.z.string(),
    // The saved request this send came from (null for ad-hoc sends), so the
    // history row can link back to it.
    requestId: uuid.nullable().optional(),
    // Display name of the request, surfaced to scripts as pm.info.requestName.
    requestName: zod_1.z.string().optional(),
    request: exports.ResolvedRequest,
    // Optional pre/post-request scripts. Run in a sandboxed vm in the main
    // process around the HTTP dispatch.
    preRequestScript: zod_1.z.string().optional(),
    postResponseScript: zod_1.z.string().optional(),
    // Variables map the renderer used for resolution — passed through so
    // scripts can call `volt.variables.get('foo')` and see the same values.
    variables: zod_1.z.record(zod_1.z.string()).optional(),
    // Workspace context for `volt.environment.*` writes. When provided, scripts
    // can mutate the active environment's variables and changes are persisted.
    workspaceId: uuid.optional(),
    environmentId: uuid.nullable().optional(),
});
exports.ResponseTiming = zod_1.z.object({
    dnsMs: zod_1.z.number().nullable(),
    tcpMs: zod_1.z.number().nullable(),
    tlsMs: zod_1.z.number().nullable(),
    ttfbMs: zod_1.z.number().nullable(),
    downloadMs: zod_1.z.number().nullable(),
    totalMs: zod_1.z.number(),
});
exports.ScriptTestResult = zod_1.z.object({
    name: zod_1.z.string(),
    passed: zod_1.z.boolean(),
    // Assertion / exception message for failed tests.
    error: zod_1.z.string().nullable().optional(),
    skipped: zod_1.z.boolean().optional(),
});
exports.ScriptOutput = zod_1.z.object({
    logs: zod_1.z.array(zod_1.z.string()),
    error: zod_1.z.string().nullable(),
    // pm.test() results in declaration order.
    tests: zod_1.z.array(exports.ScriptTestResult).optional(),
});
exports.SuccessResponse = zod_1.z.object({
    ok: zod_1.z.literal(true),
    statusCode: zod_1.z.number().int(),
    statusText: zod_1.z.string(),
    headers: zod_1.z.array(zod_1.z.tuple([zod_1.z.string(), zod_1.z.string()])),
    // Body returned as base64 + content-type — renderer decodes for display.
    // For large bodies (>10 MB) we return only metadata + a tempfile path.
    bodyBase64: zod_1.z.string().nullable(),
    bodyTempFile: zod_1.z.string().nullable(),
    bodyContentType: zod_1.z.string().nullable(),
    bodySizeBytes: zod_1.z.number().int(),
    timing: exports.ResponseTiming,
    // Output of pre/post-request scripts, if any ran.
    preScript: exports.ScriptOutput.optional(),
    postScript: exports.ScriptOutput.optional(),
});
exports.ErrorResponse = zod_1.z.object({
    ok: zod_1.z.literal(false),
    errorCode: zod_1.z.string(), // e.g., "ENOTFOUND", "ETIMEDOUT", "ABORT"
    errorMessage: zod_1.z.string(),
    timing: exports.ResponseTiming.nullable(),
    preScript: exports.ScriptOutput.optional(),
    postScript: exports.ScriptOutput.optional(),
});
exports.SendRequestOutput = zod_1.z.discriminatedUnion('ok', [exports.SuccessResponse, exports.ErrorResponse]);
// ─────────────────────────────────────────────────────────
// History (local only — never synced)
// ─────────────────────────────────────────────────────────
exports.HistoryEntry = zod_1.z.object({
    id: uuid,
    requestId: uuid.nullable(),
    workspaceId: uuid,
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: zod_1.z.string(),
    requestSnapshot: zod_1.z.string(), // JSON-serialized resolved request
    statusCode: zod_1.z.number().int().nullable(),
    durationMs: zod_1.z.number().int(),
    startedAt: zod_1.z.string().datetime(),
    errorCode: zod_1.z.string().nullable(),
});
//# sourceMappingURL=request.js.map