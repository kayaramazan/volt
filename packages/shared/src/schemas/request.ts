import { z } from 'zod';

const uuid = z.string().uuid();

// ─────────────────────────────────────────────────────────
// Headers / params / body / auth — the request shape
// ─────────────────────────────────────────────────────────

export const HeaderRow = z.object({
  id: z.string(), // client-side stable id (uuid)
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});
export type HeaderRow = z.infer<typeof HeaderRow>;

export const QueryParam = HeaderRow; // same shape
export type QueryParam = z.infer<typeof QueryParam>;

// Body — discriminated union by type
export const RawBody = z.object({
  type: z.literal('raw'),
  language: z.enum(['json', 'xml', 'html', 'text', 'javascript']),
  content: z.string(),
});
export const FormBody = z.object({
  type: z.literal('form'),
  fields: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      // 'text' or 'file' field
      kind: z.enum(['text', 'file']),
      value: z.string(), // for file: absolute path
      enabled: z.boolean().default(true),
    }),
  ),
});
export const UrlEncodedBody = z.object({
  type: z.literal('urlencoded'),
  fields: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      value: z.string(),
      enabled: z.boolean().default(true),
    }),
  ),
});
export const BinaryBody = z.object({
  type: z.literal('binary'),
  filePath: z.string(), // absolute path on disk
});
export const GraphQLBody = z.object({
  type: z.literal('graphql'),
  query: z.string().default(''),
  variables: z.string().default(''), // JSON string entered by the user
  operationName: z.string().optional(),
});
// gRPC request — the request method/url/headers/auth from ApiRequest are
// unused for gRPC; instead, `address` is the server target (host:port), the
// proto file path is on disk (so we don't have to embed large .proto blobs
// in JSON), and `service`/`method` pick which unary call to invoke. `message`
// is a JSON-encoded representation of the request protobuf, deserialized by
// proto-loader on the main process. `metadata` is per-call gRPC metadata,
// analogous to HTTP headers.
export const GrpcBody = z.object({
  type: z.literal('grpc'),
  address: z.string().default('localhost:50051'),
  protoPath: z.string().default(''),
  service: z.string().default(''),
  method: z.string().default(''),
  message: z.string().default('{}'),
  metadata: z
    .array(z.object({ id: z.string(), key: z.string(), value: z.string(), enabled: z.boolean().default(true) }))
    .default([]),
});
export const NoBody = z.object({
  type: z.literal('none'),
});
export const RequestBody = z.discriminatedUnion('type', [
  NoBody,
  RawBody,
  FormBody,
  UrlEncodedBody,
  BinaryBody,
  GraphQLBody,
  GrpcBody,
]);
export type RequestBody = z.infer<typeof RequestBody>;

// Auth — also a discriminated union
export const NoAuth = z.object({ type: z.literal('none') });
export const BearerAuth = z.object({
  type: z.literal('bearer'),
  token: z.string(),
});
export const BasicAuth = z.object({
  type: z.literal('basic'),
  username: z.string(),
  password: z.string(),
});
export const ApiKeyAuth = z.object({
  type: z.literal('apiKey'),
  key: z.string(),
  value: z.string(),
  placement: z.enum(['header', 'query']),
});
// OAuth 2.0 — a few common grants. The actual access token (and any refresh
// token) is stored in the app_state KV under `oauth.<key>` so it survives
// restarts. The auth config here only holds the issuer details + grant params.
export const OAuth2Auth = z.object({
  type: z.literal('oauth2'),
  grant: z.enum(['client_credentials', 'password', 'authorization_code']),
  tokenUrl: z.string().default(''),
  // authorization_code only
  authUrl: z.string().optional(),
  redirectUri: z.string().optional(),
  // common
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  scope: z.string().optional(),
  // password grant only
  username: z.string().optional(),
  password: z.string().optional(),
  // where the resolver will inject the access token (Authorization header by default)
  headerPrefix: z.string().default('Bearer'),
  // stable id used to look up persisted token in app_state
  tokenCacheKey: z.string().default(''),
});

export const RequestAuth = z.discriminatedUnion('type', [
  NoAuth,
  BearerAuth,
  BasicAuth,
  ApiKeyAuth,
  OAuth2Auth,
]);
export type RequestAuth = z.infer<typeof RequestAuth>;

// ─────────────────────────────────────────────────────────
// API request (stored in DB)
// ─────────────────────────────────────────────────────────

// A frozen snapshot of a sent request + its response, saved under a request.
// Useful for documenting expected responses or replaying examples later.
//
// We keep this loose on purpose — examples are user-saved snapshots, not a
// stable contract, and strict shape validation only causes pain when older
// rows drift. Just check the fields the UI lists/searches over.
export const RequestExample = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(200),
    createdAt: z.number().int(),
    request: z.unknown().optional(),
    response: z.unknown().nullable().optional(),
  })
  .passthrough();
export type RequestExample = z.infer<typeof RequestExample>;

export const ApiRequest = z.object({
  id: uuid,
  workspaceId: uuid,
  collectionId: uuid.nullable(),
  name: z.string().min(1).max(200),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string().max(8_000), // before variable resolution; can contain {{vars}}
  headers: z.array(HeaderRow).default([]),
  queryParams: z.array(QueryParam).default([]),
  body: RequestBody.default({ type: 'none' }),
  auth: RequestAuth.default({ type: 'none' }),
  // JavaScript run in a sandboxed vm before/after sending. Empty = no-op.
  // Pre-request can mutate `volt.request` and call `volt.globals.set(...)`.
  // Post-response sees a read-only `volt.response` and can also set globals.
  preRequestScript: z.string().max(50_000).default(''),
  postResponseScript: z.string().max(50_000).default(''),
  // Markdown documentation for this endpoint.
  description: z.string().max(200_000).default(''),
  // Saved request/response snapshots — populated via "Add example" menu item.
  examples: z.array(RequestExample).default([]),
  sortOrder: z.number().int().default(0),
  revision: z.string().optional(),
});
export type ApiRequest = z.infer<typeof ApiRequest>;

// ─────────────────────────────────────────────────────────
// Resolved request (after variable substitution, ready to send)
// ─────────────────────────────────────────────────────────

export const ResolvedRequest = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  // Was strict URL; relaxed so pre-request scripts can supply a final URL
  // that's still being built (or contains template segments). The engine
  // will fail with a clear error if it isn't fetchable.
  url: z.string().min(1),
  headers: z.record(z.string()), // flat map after resolution
  body: z.union([
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('raw'), content: z.string() }),
    z.object({ type: z.literal('form'), fields: z.array(z.object({ key: z.string(), kind: z.enum(['text', 'file']), value: z.string() })) }),
    z.object({ type: z.literal('urlencoded'), content: z.string() }),
    z.object({ type: z.literal('binary'), filePath: z.string() }),
    z.object({
      type: z.literal('graphql'),
      query: z.string().default(''),
      variables: z.string().default(''),
      operationName: z.string().optional(),
    }),
  ]),
  // Resolved auth merged into headers/url, so no separate auth field here.
  timeoutMs: z.number().int().min(0).default(60_000),
  followRedirects: z.boolean().default(true),
  ignoreTlsErrors: z.boolean().default(false),
});
export type ResolvedRequest = z.infer<typeof ResolvedRequest>;

// ─────────────────────────────────────────────────────────
// Send request input + output (IPC contract)
// ─────────────────────────────────────────────────────────

export const SendRequestInput = z.object({
  // The request id is included so the renderer can show "in-flight" state
  // and the main process can cancel by id.
  inFlightId: z.string(),
  request: ResolvedRequest,
  // Optional pre/post-request scripts. Run in a sandboxed vm in the main
  // process around the HTTP dispatch.
  preRequestScript: z.string().optional(),
  postResponseScript: z.string().optional(),
  // Variables map the renderer used for resolution — passed through so
  // scripts can call `volt.variables.get('foo')` and see the same values.
  variables: z.record(z.string()).optional(),
  // Workspace context for `volt.environment.*` writes. When provided, scripts
  // can mutate the active environment's variables and changes are persisted.
  workspaceId: uuid.optional(),
  environmentId: uuid.nullable().optional(),
});
export type SendRequestInput = z.infer<typeof SendRequestInput>;

export const ResponseTiming = z.object({
  dnsMs: z.number().nullable(),
  tcpMs: z.number().nullable(),
  tlsMs: z.number().nullable(),
  ttfbMs: z.number().nullable(),
  downloadMs: z.number().nullable(),
  totalMs: z.number(),
});
export type ResponseTiming = z.infer<typeof ResponseTiming>;

export const ScriptOutput = z.object({
  logs: z.array(z.string()),
  error: z.string().nullable(),
});

export const SuccessResponse = z.object({
  ok: z.literal(true),
  statusCode: z.number().int(),
  statusText: z.string(),
  headers: z.array(z.tuple([z.string(), z.string()])),
  // Body returned as base64 + content-type — renderer decodes for display.
  // For large bodies (>10 MB) we return only metadata + a tempfile path.
  bodyBase64: z.string().nullable(),
  bodyTempFile: z.string().nullable(),
  bodyContentType: z.string().nullable(),
  bodySizeBytes: z.number().int(),
  timing: ResponseTiming,
  // Output of pre/post-request scripts, if any ran.
  preScript: ScriptOutput.optional(),
  postScript: ScriptOutput.optional(),
});

export const ErrorResponse = z.object({
  ok: z.literal(false),
  errorCode: z.string(), // e.g., "ENOTFOUND", "ETIMEDOUT", "ABORT"
  errorMessage: z.string(),
  timing: ResponseTiming.nullable(),
  preScript: ScriptOutput.optional(),
  postScript: ScriptOutput.optional(),
});

export const SendRequestOutput = z.discriminatedUnion('ok', [SuccessResponse, ErrorResponse]);
export type SendRequestOutput = z.infer<typeof SendRequestOutput>;

// ─────────────────────────────────────────────────────────
// History (local only — never synced)
// ─────────────────────────────────────────────────────────

export const HistoryEntry = z.object({
  id: uuid,
  requestId: uuid.nullable(),
  workspaceId: uuid,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string(),
  requestSnapshot: z.string(), // JSON-serialized resolved request
  statusCode: z.number().int().nullable(),
  durationMs: z.number().int(),
  startedAt: z.string().datetime(),
  errorCode: z.string().nullable(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;
