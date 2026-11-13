"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@volt/db");
const MAX_PAGE = 500;
const DEFAULT_PAGE = 100;
let AuditService = class AuditService {
    log = new common_1.Logger('AuditService');
    /**
     * Append-only record of a team-scoped action.
     *
     * Audit writes are best-effort: they must never block the underlying
     * mutation. Callers fire-and-forget unless they explicitly await it.
     * A failure here is logged but swallowed so the user-visible operation
     * still succeeds.
     */
    async record(teamId, actorId, action, metadata = {}) {
        try {
            await db_1.prisma.auditLogEntry.create({
                data: { teamId, actorId, action, metadata },
            });
        }
        catch (e) {
            this.log.warn(`failed to write audit entry: ${e.message}`);
        }
    }
    async list(teamId, limit = DEFAULT_PAGE) {
        const take = Math.min(Math.max(1, limit | 0), MAX_PAGE);
        const rows = await db_1.prisma.auditLogEntry.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            take,
        });
        // Hydrate the actor name/email for display. Actors may be null (system
        // events) so we batch-lookup once at the end.
        const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x) => !!x))];
        const users = actorIds.length
            ? await db_1.prisma.user.findMany({
                where: { id: { in: actorIds } },
                select: { id: true, name: true, email: true },
            })
            : [];
        const userById = new Map(users.map((u) => [u.id, u]));
        return rows.map((r) => ({
            id: r.id,
            teamId: r.teamId,
            action: r.action,
            metadata: r.metadata,
            createdAt: r.createdAt,
            actor: r.actorId ? userById.get(r.actorId) ?? null : null,
        }));
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)()
], AuditService);
//# sourceMappingURL=audit.service.js.map