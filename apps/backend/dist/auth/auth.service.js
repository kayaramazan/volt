"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const argon2_1 = __importDefault(require("argon2"));
const db_1 = require("@volt/db");
const app_error_1 = require("../common/app.error");
const lucia_1 = require("./lucia");
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
let AuthService = AuthService_1 = class AuthService {
    logger = new common_1.Logger(AuthService_1.name);
    failedAttempts = new Map();
    async register(input) {
        const existing = await db_1.prisma.user.findUnique({ where: { email: input.email } });
        if (existing)
            throw new app_error_1.AppError('EMAIL_TAKEN', 409);
        const passwordHash = await argon2_1.default.hash(input.password);
        const user = await db_1.prisma.user.create({
            data: {
                email: input.email,
                passwordHash,
                name: input.name,
            },
        });
        return { userId: user.id };
    }
    /**
     * Login with optional device info. If `device` is provided, a Device row is
     * upserted (matched by userId + label) and the session is bound to it.
     */
    async login(input) {
        const key = input.email.toLowerCase();
        const failure = this.failedAttempts.get(key);
        if (failure?.lockedUntil && failure.lockedUntil > Date.now()) {
            const seconds = Math.ceil((failure.lockedUntil - Date.now()) / 1000);
            throw new app_error_1.AppError('ACCOUNT_LOCKED', 429, `Too many failed attempts. Try again in ${seconds} seconds.`);
        }
        const user = await db_1.prisma.user.findFirst({
            where: { email: input.email, active: true },
        });
        if (!user) {
            this.recordFailure(key);
            throw new app_error_1.AppError('INVALID_CREDENTIALS', 401);
        }
        const valid = await argon2_1.default.verify(user.passwordHash, input.password);
        if (!valid) {
            this.recordFailure(key);
            throw new app_error_1.AppError('INVALID_CREDENTIALS', 401);
        }
        this.failedAttempts.delete(key);
        let deviceId = null;
        if (input.device) {
            // Find-or-create device by (userId, label). No composite unique
            // constraint in schema (a user can intentionally have multiple
            // sessions on the "same machine" — different OS users).
            // We match label exactly; if a duplicate exists, the user can revoke
            // either from settings.
            const existing = await db_1.prisma.device.findFirst({
                where: { userId: user.id, label: input.device.label },
            });
            const device = existing
                ? await db_1.prisma.device.update({
                    where: { id: existing.id },
                    data: {
                        platform: input.device.platform,
                        appVersion: input.device.appVersion,
                        lastSeenAt: new Date(),
                    },
                })
                : await db_1.prisma.device.create({
                    data: {
                        userId: user.id,
                        label: input.device.label,
                        platform: input.device.platform,
                        appVersion: input.device.appVersion,
                    },
                });
            deviceId = device.id;
        }
        const session = await lucia_1.lucia.createSession(user.id, { deviceId });
        return { sessionId: session.id, user, deviceId };
    }
    async logout(sessionId) {
        await lucia_1.lucia.invalidateSession(sessionId);
    }
    async me(userId, currentDeviceId) {
        const user = await db_1.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            include: {
                memberships: { include: { team: true } },
                devices: { orderBy: { lastSeenAt: 'desc' } },
            },
        });
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            teams: user.memberships.map((m) => ({
                id: m.team.id,
                name: m.team.name,
                role: m.role,
            })),
            devices: user.devices.map((d) => ({
                id: d.id,
                label: d.label,
                platform: d.platform,
                appVersion: d.appVersion,
                lastSeenAt: d.lastSeenAt.toISOString(),
                current: d.id === currentDeviceId,
            })),
        };
    }
    async changePassword(userId, input) {
        const user = await db_1.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const valid = await argon2_1.default.verify(user.passwordHash, input.currentPassword);
        if (!valid)
            throw new app_error_1.AppError('INVALID_CREDENTIALS', 401, 'Current password is wrong.');
        const newHash = await argon2_1.default.hash(input.newPassword);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });
        await lucia_1.lucia.invalidateUserSessions(userId);
    }
    async revokeDevice(userId, deviceId) {
        const device = await db_1.prisma.device.findFirst({
            where: { id: deviceId, userId },
        });
        if (!device)
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404, 'Device not found.');
        // Invalidate all sessions bound to this device
        await db_1.prisma.session.deleteMany({ where: { deviceId } });
        await db_1.prisma.device.delete({ where: { id: deviceId } });
    }
    recordFailure(key) {
        const current = this.failedAttempts.get(key) ?? { count: 0 };
        current.count += 1;
        if (current.count >= MAX_FAILED_ATTEMPTS) {
            current.lockedUntil = Date.now() + LOCKOUT_MS;
            this.logger.warn(`Account locked: ${key}`);
        }
        this.failedAttempts.set(key, current);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)()
], AuthService);
//# sourceMappingURL=auth.service.js.map