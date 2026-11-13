"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@volt/db");
const app_error_1 = require("../common/app.error");
const team_service_1 = require("../team/team.service");
const SOFT_DELETE_RECOVERY_DAYS = 30;
let WorkspaceService = class WorkspaceService {
    teams;
    constructor(teams) {
        this.teams = teams;
    }
    async list(userId) {
        const [personal, team] = await Promise.all([
            db_1.prisma.workspace.findMany({
                where: { ownerUserId: userId, deletedAt: null },
                orderBy: { createdAt: 'asc' },
            }),
            db_1.prisma.workspace.findMany({
                where: {
                    deletedAt: null,
                    ownerTeamId: { not: null },
                    ownerTeam: { members: { some: { userId } } },
                },
                orderBy: { createdAt: 'asc' },
                include: {
                    ownerTeam: { select: { id: true, name: true } },
                },
            }),
        ]);
        return { personal, team };
    }
    async create(userId, name, teamId, id) {
        if (teamId) {
            await this.teams.assertMember(userId, teamId);
            // Plan-limit gate — block once the team is at its workspace cap.
            await this.teams.assertCanAddWorkspace(teamId);
            return db_1.prisma.workspace.create({
                data: { ...(id ? { id } : {}), name, ownerTeamId: teamId },
            });
        }
        return db_1.prisma.workspace.create({
            data: { ...(id ? { id } : {}), name, ownerUserId: userId },
        });
    }
    async rename(userId, workspaceId, name) {
        await this.assertAccess(userId, workspaceId);
        return db_1.prisma.workspace.update({
            where: { id: workspaceId },
            data: { name },
        });
    }
    /**
     * Soft delete with 30-day recovery. The workspace becomes invisible
     * in list but rows are preserved.
     */
    async softDelete(userId, workspaceId) {
        await this.assertAccess(userId, workspaceId);
        await db_1.prisma.workspace.update({
            where: { id: workspaceId },
            data: { deletedAt: new Date() },
        });
    }
    /**
     * Hard delete — cascades. Only callable after recovery window or by support.
     * Not exposed in MVP UI.
     */
    async hardDelete(workspaceId) {
        await db_1.prisma.workspace.delete({ where: { id: workspaceId } });
    }
    /**
     * Permanent purge of workspaces deleted > 30 days ago.
     * Called by a cron / scheduled task.
     */
    async purgeSoftDeleted() {
        const cutoff = new Date(Date.now() - SOFT_DELETE_RECOVERY_DAYS * 86_400_000);
        const result = await db_1.prisma.workspace.deleteMany({
            where: { deletedAt: { lt: cutoff } },
        });
        return result.count;
    }
    /**
     * Move personal workspace to a team (irreversible without re-creation).
     */
    async moveToTeam(userId, workspaceId, teamId) {
        const workspace = await db_1.prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!workspace)
            throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 404);
        if (workspace.ownerUserId !== userId) {
            throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 403, 'Only the owner can move a workspace.');
        }
        await this.teams.assertMember(userId, teamId);
        // Plan-limit gate — moving in counts the same as creating a new one.
        await this.teams.assertCanAddWorkspace(teamId);
        return db_1.prisma.workspace.update({
            where: { id: workspaceId },
            data: { ownerUserId: null, ownerTeamId: teamId },
        });
    }
    /**
     * Central access check. Used everywhere — sync, get, update.
     * Returns the workspace or throws WORKSPACE_NOT_FOUND.
     *
     * We intentionally use the same error for "doesn't exist" and "no access"
     * to avoid leaking workspace existence to unauthorized users.
     */
    async assertAccess(userId, workspaceId) {
        const workspace = await db_1.prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                deletedAt: null,
                OR: [
                    { ownerUserId: userId },
                    { ownerTeam: { members: { some: { userId } } } },
                ],
            },
        });
        if (!workspace)
            throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 404);
        return workspace;
    }
};
exports.WorkspaceService = WorkspaceService;
exports.WorkspaceService = WorkspaceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [team_service_1.TeamService])
], WorkspaceService);
//# sourceMappingURL=workspace.service.js.map