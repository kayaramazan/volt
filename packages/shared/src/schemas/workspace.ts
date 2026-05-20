import { z } from 'zod';

const uuid = z.string().uuid();

// Variable: key-value, optionally a reference into the OS keychain for secrets.
// On the client, secretRef points to a keychain entry; the actual value is
// never persisted in the SQLite or Postgres DB.
export const Variable = z.object({
  key: z.string().min(1).max(200),
  value: z.string().max(10_000),
  // If present, value is empty and the real value lives in OS keychain at this ref.
  secretRef: z.string().nullable().optional(),
});
export type Variable = z.infer<typeof Variable>;

// ─────────────────────────────────────────────────────────
// Team management
// ─────────────────────────────────────────────────────────

export const CreateTeamInput = z.object({
  name: z.string().min(1).max(120),
});

export const InviteTeamMemberInput = z.object({
  teamId: uuid,
  email: z.string().email(),
});

export const AcceptInviteInput = z.object({
  code: z.string().min(8).max(64),
});

export const UpdateMemberRoleInput = z.object({
  teamId: uuid,
  userId: uuid,
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

// ─────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────

export const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(120),
  teamId: uuid.optional(), // omit = personal workspace
  // Optional client-supplied id. Lets the local-first desktop create the same
  // workspace row on backend and locally so sync push can find it.
  id: uuid.optional(),
});

export const RenameWorkspaceInput = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
});

export const Workspace = z.object({
  id: uuid,
  name: z.string(),
  ownerUserId: uuid.nullable(),
  ownerTeamId: uuid.nullable(),
  currentRevision: z.union([z.bigint(), z.number(), z.string()]).transform((v) => String(v)),
  createdAt: z.string().datetime(),
});

// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────

export const Collection = z.object({
  id: uuid,
  workspaceId: uuid,
  parentId: uuid.nullable(),
  name: z.string().min(1).max(200),
  // Free-form documentation for the collection (markdown). Shown in the
  // "Documentation" modal and synced like any other collection field.
  description: z.string().max(200_000).default(''),
  sortOrder: z.number().int().default(0),
  variables: z.array(Variable).default([]),
  // Only set when the row was loaded from server (not for local-only).
  revision: z.string().optional(),
});
export type Collection = z.infer<typeof Collection>;

// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────

export const Environment = z.object({
  id: uuid,
  workspaceId: uuid,
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().default(0),
  variables: z.array(Variable).default([]),
  revision: z.string().optional(),
});
export type Environment = z.infer<typeof Environment>;
