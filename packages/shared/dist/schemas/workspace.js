"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = exports.Collection = exports.MockDefinition = exports.Workspace = exports.RenameWorkspaceInput = exports.CreateWorkspaceInput = exports.UpdateMemberRoleInput = exports.AcceptInviteInput = exports.InviteTeamMemberInput = exports.CreateTeamInput = exports.Variable = void 0;
const zod_1 = require("zod");
const uuid = zod_1.z.string().uuid();
// Variable: key-value, optionally a reference into the OS keychain for secrets.
// On the client, secretRef points to a keychain entry; the actual value is
// never persisted in the SQLite or Postgres DB.
exports.Variable = zod_1.z.object({
    key: zod_1.z.string().min(1).max(200),
    value: zod_1.z.string().max(10_000),
    // If present, value is empty and the real value lives in OS keychain at this ref.
    secretRef: zod_1.z.string().nullable().optional(),
    // Postman parity: unchecked rows are kept but skipped during {{}} resolution.
    enabled: zod_1.z.boolean().optional(),
    // Postman "secret" type: value is masked in the UI (still stored as-is).
    secret: zod_1.z.boolean().optional(),
});
// ─────────────────────────────────────────────────────────
// Team management
// ─────────────────────────────────────────────────────────
exports.CreateTeamInput = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
});
exports.InviteTeamMemberInput = zod_1.z.object({
    teamId: uuid,
    email: zod_1.z.string().email(),
});
exports.AcceptInviteInput = zod_1.z.object({
    code: zod_1.z.string().min(8).max(64),
});
exports.UpdateMemberRoleInput = zod_1.z.object({
    teamId: uuid,
    userId: uuid,
    role: zod_1.z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});
// ─────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────
exports.CreateWorkspaceInput = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    teamId: uuid.optional(), // omit = personal workspace
    // Optional client-supplied id. Lets the local-first desktop create the same
    // workspace row on backend and locally so sync push can find it.
    id: uuid.optional(),
});
exports.RenameWorkspaceInput = zod_1.z.object({
    id: uuid,
    name: zod_1.z.string().min(1).max(120),
});
exports.Workspace = zod_1.z.object({
    id: uuid,
    name: zod_1.z.string(),
    ownerUserId: uuid.nullable(),
    ownerTeamId: uuid.nullable(),
    currentRevision: zod_1.z.union([zod_1.z.bigint(), zod_1.z.number(), zod_1.z.string()]).transform((v) => String(v)),
    createdAt: zod_1.z.string().datetime(),
});
// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────
// Mock-server entry attached to a collection. The local mock server (see
// electron/core/mock/server.ts) walks every collection's `mocks[]` and
// answers matching HTTP requests with the configured status/headers/body.
exports.MockDefinition = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().default(''),
    /** HTTP method to match. Use '*' to match any method. */
    method: zod_1.z.string().default('GET'),
    /** Path pattern. `:name` segments match a single non-slash segment;
     *  `*` matches the rest of the path. Anchored to the start of the URL.
     *  Example: `/users/:id` matches `/users/123` but not `/users/123/posts`. */
    pathPattern: zod_1.z.string().default('/'),
    enabled: zod_1.z.boolean().default(true),
    status: zod_1.z.number().int().min(100).max(599).default(200),
    headers: zod_1.z
        .array(zod_1.z.object({ key: zod_1.z.string(), value: zod_1.z.string() }))
        .default([]),
    contentType: zod_1.z.string().default('application/json'),
    body: zod_1.z.string().default(''),
    /** Artificial latency before sending the response. */
    delayMs: zod_1.z.number().int().min(0).max(60_000).default(0),
});
exports.Collection = zod_1.z.object({
    id: uuid,
    workspaceId: uuid,
    parentId: uuid.nullable(),
    name: zod_1.z.string().min(1).max(200),
    // Free-form documentation for the collection (markdown). Shown in the
    // "Documentation" modal and synced like any other collection field.
    description: zod_1.z.string().max(200_000).default(''),
    sortOrder: zod_1.z.number().int().default(0),
    variables: zod_1.z.array(exports.Variable).default([]),
    mocks: zod_1.z.array(exports.MockDefinition).default([]),
    // Only set when the row was loaded from server (not for local-only).
    revision: zod_1.z.string().optional(),
});
// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────
exports.Environment = zod_1.z.object({
    id: uuid,
    workspaceId: uuid,
    name: zod_1.z.string().min(1).max(120),
    sortOrder: zod_1.z.number().int().default(0),
    variables: zod_1.z.array(exports.Variable).default([]),
    revision: zod_1.z.string().optional(),
});
//# sourceMappingURL=workspace.js.map