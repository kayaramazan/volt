"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeOutput = exports.DeviceSummary = exports.TeamSummary = exports.LoginOutput = exports.ChangePasswordInput = exports.LoginInput = exports.RegisterInput = void 0;
const zod_1 = require("zod");
// ─────────────────────────────────────────────────────────
// Auth & registration
// ─────────────────────────────────────────────────────────
exports.RegisterInput = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email'),
    name: zod_1.z.string().min(1).max(120),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.LoginInput = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    // Used to create / identify a Device record on the backend.
    device: zod_1.z.object({
        label: zod_1.z.string().min(1).max(120),
        platform: zod_1.z.enum(['macos', 'windows', 'linux']),
        appVersion: zod_1.z.string().min(1).max(40),
    }).optional(),
});
exports.ChangePasswordInput = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8),
});
exports.LoginOutput = zod_1.z.object({
    sessionId: zod_1.z.string(),
    user: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        email: zod_1.z.string().email(),
        name: zod_1.z.string(),
    }),
    device: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        label: zod_1.z.string(),
    }).optional(),
});
exports.TeamSummary = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    role: zod_1.z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});
exports.DeviceSummary = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    label: zod_1.z.string(),
    platform: zod_1.z.enum(['macos', 'windows', 'linux']),
    appVersion: zod_1.z.string(),
    lastSeenAt: zod_1.z.string().datetime(),
    current: zod_1.z.boolean(),
});
exports.MeOutput = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string(),
    teams: zod_1.z.array(exports.TeamSummary),
    devices: zod_1.z.array(exports.DeviceSummary),
});
//# sourceMappingURL=auth.js.map