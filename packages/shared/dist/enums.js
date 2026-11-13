"use strict";
// Shared enums + constants used across desktop and backend.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = exports.ERROR_MESSAGES_EN = exports.ERROR_CODES = exports.SYNC_SSE_HEARTBEAT_MS = exports.SYNC_PULL_INTERVAL_MS = exports.SYNC_PUSH_DEBOUNCE_MS = exports.RESPONSE_BODY_MAX_BYTES = exports.PLATFORMS = exports.TEAM_ROLES = exports.API_KEY_PLACEMENTS = exports.AUTH_TYPES = exports.RAW_BODY_LANGUAGES = exports.BODY_TYPES = exports.HTTP_METHODS = void 0;
exports.HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
exports.BODY_TYPES = ['none', 'raw', 'form', 'urlencoded', 'binary'];
exports.RAW_BODY_LANGUAGES = ['json', 'xml', 'html', 'text', 'javascript'];
exports.AUTH_TYPES = ['none', 'bearer', 'basic', 'apiKey'];
exports.API_KEY_PLACEMENTS = ['header', 'query'];
exports.TEAM_ROLES = ['OWNER', 'EDITOR', 'VIEWER'];
exports.PLATFORMS = ['macos', 'windows', 'linux'];
// Soft cap on response body size stored in local DB (and sent over wire).
// Anything larger gets a "save to file" affordance.
exports.RESPONSE_BODY_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
// Sync constants
exports.SYNC_PUSH_DEBOUNCE_MS = 5_000;
exports.SYNC_PULL_INTERVAL_MS = 30_000;
exports.SYNC_SSE_HEARTBEAT_MS = 30_000;
// Error codes (string identifiers, language-agnostic)
exports.ERROR_CODES = {
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
};
exports.ERROR_MESSAGES_EN = {
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
exports.PLAN_LIMITS = {
    FREE: { maxMembers: 5, maxWorkspaces: 3 },
    PRO: { maxMembers: 100, maxWorkspaces: 25 },
};
//# sourceMappingURL=enums.js.map