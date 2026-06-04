// Shared enums + constants used across desktop and backend.

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const BODY_TYPES = ['none', 'raw', 'form', 'urlencoded', 'binary'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const RAW_BODY_LANGUAGES = ['json', 'xml', 'html', 'text', 'javascript'] as const;
export type RawBodyLanguage = (typeof RAW_BODY_LANGUAGES)[number];

export const AUTH_TYPES = ['none', 'bearer', 'basic', 'apiKey'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const API_KEY_PLACEMENTS = ['header', 'query'] as const;
export type ApiKeyPlacement = (typeof API_KEY_PLACEMENTS)[number];

export const TEAM_ROLES = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PLATFORMS = ['macos', 'windows', 'linux'] as const;
export type Platform = (typeof PLATFORMS)[number];

// Soft cap on response body size stored in local DB (and sent over wire).
// Anything larger gets a "save to file" affordance.
export const RESPONSE_BODY_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Sync constants
export const SYNC_PUSH_DEBOUNCE_MS = 5_000;
export const SYNC_PULL_INTERVAL_MS = 30_000;
export const SYNC_SSE_HEARTBEAT_MS = 30_000;

// Error codes (string identifiers, language-agnostic)
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  // Teams
  NOT_TEAM_MEMBER: 'NOT_TEAM_MEMBER',
  NOT_TEAM_OWNER: 'NOT_TEAM_OWNER',
  CANNOT_REMOVE_LAST_OWNER: 'CANNOT_REMOVE_LAST_OWNER',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_ALREADY_ACCEPTED: 'INVITE_ALREADY_ACCEPTED',
  // Sync
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  // Request
  INVALID_URL: 'INVALID_URL',
  REQUEST_FAILED: 'REQUEST_FAILED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  // Billing / Stripe
  STRIPE_NOT_CONFIGURED: 'STRIPE_NOT_CONFIGURED',
  STRIPE_PRICE_NOT_CONFIGURED: 'STRIPE_PRICE_NOT_CONFIGURED',
  WEBHOOK_SECRET_NOT_SET: 'WEBHOOK_SECRET_NOT_SET',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  NO_STRIPE_CUSTOMER: 'NO_STRIPE_CUSTOMER',
  // RBAC
  TEAM_VIEWER_READ_ONLY: 'TEAM_VIEWER_READ_ONLY',
  // Plan limits (paid tier)
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES_EN: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Try again later.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  NOT_TEAM_MEMBER: 'You are not a member of this team.',
  NOT_TEAM_OWNER: 'Only the team owner can perform this action.',
  CANNOT_REMOVE_LAST_OWNER: 'A team must have at least one owner.',
  INVITE_EXPIRED: 'This invitation has expired.',
  INVITE_ALREADY_ACCEPTED: 'This invitation has already been used.',
  REVISION_CONFLICT: 'Your workspace is out of date. Pulling latest changes...',
  WORKSPACE_NOT_FOUND: 'Workspace not found or you do not have access.',
  INVALID_URL: 'The URL is not valid.',
  REQUEST_FAILED: 'The request failed.',
  REQUEST_TIMEOUT: 'The request timed out.',
  REQUEST_CANCELLED: 'The request was cancelled.',
  STRIPE_NOT_CONFIGURED: 'Billing is not enabled on this server.',
  STRIPE_PRICE_NOT_CONFIGURED: 'No paid plan is configured on this server.',
  WEBHOOK_SECRET_NOT_SET: 'Stripe webhook secret is not configured.',
  MISSING_SIGNATURE: 'Missing Stripe signature header.',
  INVALID_SIGNATURE: 'Invalid Stripe webhook signature.',
  NO_STRIPE_CUSTOMER: 'This team has no Stripe customer yet.',
  TEAM_VIEWER_READ_ONLY: 'Viewers cannot modify team data.',
  PLAN_LIMIT_EXCEEDED: 'Your plan limit has been reached — upgrade to add more.',
};

// ─────────────────────────────────────────────────────────
// Paid-tier plan limits
//
// Free is the default for any team without an active subscription. Pro
// is unlocked once Stripe reports an active/trialing subscription. Limits
// are enforced backend-side in TeamService.invite and WorkspaceService
// (create + moveToTeam). The desktop UI mirrors the same shape so it can
// show "3 / 5 members" indicators without an extra round-trip.
// ─────────────────────────────────────────────────────────

export interface PlanLimits {
  maxMembers: number;
  maxWorkspaces: number;
}

export const PLAN_LIMITS: Record<'FREE' | 'PRO', PlanLimits> = {
  FREE: { maxMembers: 5, maxWorkspaces: 3 },
  PRO: { maxMembers: 100, maxWorkspaces: 25 },
};
