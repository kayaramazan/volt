"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const db_1 = require("@volt/db");
const shared_1 = require("@volt/shared");
const app_error_1 = require("../common/app.error");
const INVITE_EXPIRY_DAYS = 7;
let TeamService = class TeamService {
    auditLog = new common_1.Logger('TeamAudit');
    /** Best-effort audit hook — never blocks the user-visible mutation.
     *  Kept inline here to avoid a circular DI between TeamModule and
     *  AuditModule (which itself imports TeamModule for the assertOwner
     *  guard on /teams/:id/audit-log). */
    async audit(teamId, actorId, action, metadata = {}) {
        try {
            await db_1.prisma.auditLogEntry.create({
                data: { teamId, actorId, action, metadata },
            });
        }
        catch (e) {
            this.auditLog.warn(`failed to write audit entry: ${e.message}`);
        }
    }
    async create(userId, name) {
        const team = await db_1.prisma.$transaction(async (tx) => {
            const team = await tx.team.create({
                data: { name, ownerId: userId },
            });
            await tx.teamMember.create({
                data: { teamId: team.id, userId, role: db_1.TeamRole.OWNER },
            });
            return team;
        });
        void this.audit(team.id, userId, db_1.AuditAction.TEAM_CREATED, { name });
        return team;
    }
    async list(userId) {
        return db_1.prisma.team.findMany({
            where: { members: { some: { userId } } },
            include: {
                members: { include: { user: { select: { id: true, name: true, email: true } } } },
                _count: { select: { members: true } },
            },
        });
    }
    async getDetail(userId, teamId) {
        const membership = await db_1.prisma.teamMember.findFirst({
            where: { teamId, userId },
        });
        if (!membership)
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404);
        return db_1.prisma.team.findUniqueOrThrow({
            where: { id: teamId },
            include: {
                members: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                    orderBy: { joinedAt: 'asc' },
                },
                invites: {
                    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
                },
            },
        });
    }
    async invite(userId, teamId, email) {
        await this.assertOwner(userId, teamId);
        // Refuse invite if the email already belongs to a member of this team
        const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const alreadyMember = await db_1.prisma.teamMember.findFirst({
                where: { teamId, userId: existingUser.id },
            });
            if (alreadyMember) {
                throw new app_error_1.AppError('NOT_TEAM_MEMBER', 409, 'User is already a member.');
            }
        }
        // Plan-limit gate: existing members + still-pending invites must stay
        // below the cap for the team's current plan. Outstanding invites count
        // so a free team can't paper over the limit by pre-issuing 50 invites.
        const usage = await this.memberUsage(teamId);
        if (usage.totalSlotsUsed >= usage.limit) {
            throw new app_error_1.AppError('PLAN_LIMIT_EXCEEDED', 402, `${usage.plan} plan is limited to ${usage.limit} members (currently ${usage.members} member${usage.members === 1 ? '' : 's'} + ${usage.pendingInvites} pending invite${usage.pendingInvites === 1 ? '' : 's'}). Upgrade to add more.`);
        }
        const code = (0, nanoid_1.nanoid)(32);
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);
        const invite = await db_1.prisma.teamInvite.create({
            data: {
                teamId,
                email,
                code,
                createdBy: userId,
                expiresAt,
            },
        });
        void this.audit(teamId, userId, db_1.AuditAction.MEMBER_INVITED, { email });
        return invite;
    }
    async acceptInvite(userId, code) {
        const invite = await db_1.prisma.teamInvite.findUnique({ where: { code } });
        if (!invite)
            throw new app_error_1.AppError('INVITE_EXPIRED', 404);
        if (invite.acceptedAt)
            throw new app_error_1.AppError('INVITE_ALREADY_ACCEPTED', 409);
        if (invite.expiresAt < new Date())
            throw new app_error_1.AppError('INVITE_EXPIRED', 410);
        const result = await db_1.prisma.$transaction(async (tx) => {
            // Check if user is already a member (race protection)
            const existing = await tx.teamMember.findFirst({
                where: { teamId: invite.teamId, userId },
            });
            if (existing) {
                await tx.teamInvite.update({
                    where: { id: invite.id },
                    data: { acceptedAt: new Date() },
                });
                return { teamId: invite.teamId, alreadyMember: true };
            }
            await tx.teamMember.create({
                data: { teamId: invite.teamId, userId, role: db_1.TeamRole.EDITOR },
            });
            await tx.teamInvite.update({
                where: { id: invite.id },
                data: { acceptedAt: new Date() },
            });
            return { teamId: invite.teamId, alreadyMember: false };
        });
        if (!result.alreadyMember) {
            void this.audit(result.teamId, userId, db_1.AuditAction.MEMBER_JOINED, { inviteCode: code });
        }
        return result;
    }
    async updateMemberRole(actorId, teamId, userId, role) {
        await this.assertOwner(actorId, teamId);
        if (actorId === userId && role !== db_1.TeamRole.OWNER) {
            // Owner trying to demote self — verify another owner exists
            const ownersCount = await db_1.prisma.teamMember.count({
                where: { teamId, role: db_1.TeamRole.OWNER },
            });
            if (ownersCount <= 1) {
                throw new app_error_1.AppError('CANNOT_REMOVE_LAST_OWNER', 409);
            }
        }
        const previous = await db_1.prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId } },
        });
        const updated = await db_1.prisma.teamMember.update({
            where: { teamId_userId: { teamId, userId } },
            data: { role },
        });
        void this.audit(teamId, actorId, db_1.AuditAction.MEMBER_ROLE_CHANGED, {
            targetUserId: userId,
            fromRole: previous?.role,
            toRole: role,
        });
        return updated;
    }
    async removeMember(actorId, teamId, userId) {
        if (actorId !== userId) {
            await this.assertOwner(actorId, teamId);
        }
        const member = await db_1.prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId } },
        });
        if (!member)
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404);
        if (member.role === db_1.TeamRole.OWNER) {
            const ownersCount = await db_1.prisma.teamMember.count({
                where: { teamId, role: db_1.TeamRole.OWNER },
            });
            if (ownersCount <= 1) {
                throw new app_error_1.AppError('CANNOT_REMOVE_LAST_OWNER', 409);
            }
        }
        await db_1.prisma.teamMember.delete({
            where: { teamId_userId: { teamId, userId } },
        });
        void this.audit(teamId, actorId, db_1.AuditAction.MEMBER_REMOVED, {
            targetUserId: userId,
            selfRemoval: actorId === userId,
        });
    }
    async transferOwnership(actorId, teamId, newOwnerId) {
        await this.assertOwner(actorId, teamId);
        const newOwnerMember = await db_1.prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId: newOwnerId } },
        });
        if (!newOwnerMember) {
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404, 'New owner must be an existing team member.');
        }
        await db_1.prisma.$transaction([
            db_1.prisma.team.update({
                where: { id: teamId },
                data: { ownerId: newOwnerId },
            }),
            db_1.prisma.teamMember.update({
                where: { teamId_userId: { teamId, userId: newOwnerId } },
                data: { role: db_1.TeamRole.OWNER },
            }),
            db_1.prisma.teamMember.update({
                where: { teamId_userId: { teamId, userId: actorId } },
                data: { role: db_1.TeamRole.EDITOR },
            }),
        ]);
        void this.audit(teamId, actorId, db_1.AuditAction.OWNERSHIP_TRANSFERRED, {
            newOwnerId,
            previousOwnerId: actorId,
        });
    }
    async delete(actorId, teamId) {
        await this.assertOwner(actorId, teamId);
        // Audit BEFORE delete since the team is cascade-deleted along with
        // its audit entries; this record is mostly for monitoring/aggregation.
        void this.audit(teamId, actorId, db_1.AuditAction.TEAM_DELETED, {});
        await db_1.prisma.team.delete({ where: { id: teamId } });
    }
    // ─────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────
    async assertMember(userId, teamId) {
        const membership = await db_1.prisma.teamMember.findFirst({
            where: { teamId, userId },
        });
        if (!membership)
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404);
        return membership.role;
    }
    async assertOwner(userId, teamId) {
        const membership = await db_1.prisma.teamMember.findFirst({
            where: { teamId, userId },
        });
        if (!membership)
            throw new app_error_1.AppError('NOT_TEAM_MEMBER', 404);
        if (membership.role !== db_1.TeamRole.OWNER) {
            throw new app_error_1.AppError('NOT_TEAM_OWNER', 403);
        }
    }
    /** OWNER or EDITOR — i.e. anyone with write access to team-owned data. */
    async assertEditor(userId, teamId) {
        const role = await this.assertMember(userId, teamId);
        if (role === db_1.TeamRole.VIEWER) {
            throw new app_error_1.AppError('TEAM_VIEWER_READ_ONLY', 403, 'VIEWERs cannot modify team data.');
        }
        return role;
    }
    // ─────────────────────────────────────────────────────────
    // Plan limits
    // ─────────────────────────────────────────────────────────
    /** Effective plan for a team — defaults to FREE when no subscription
     *  row exists yet. Treats any non-active/trialing subscription as FREE
     *  so a lapsed PRO team falls back to free-tier limits. */
    async getPlan(teamId) {
        const sub = await db_1.prisma.subscription.findUnique({ where: { teamId } });
        if (!sub)
            return db_1.PlanTier.FREE;
        return sub.plan;
    }
    /** Current member + pending-invite usage for the team's plan. Used by
     *  invite + workspace-create flows to gate growth. */
    async memberUsage(teamId) {
        const plan = await this.getPlan(teamId);
        const [members, pendingInvites] = await Promise.all([
            db_1.prisma.teamMember.count({ where: { teamId } }),
            db_1.prisma.teamInvite.count({
                where: { teamId, acceptedAt: null, expiresAt: { gt: new Date() } },
            }),
        ]);
        return {
            plan,
            limit: shared_1.PLAN_LIMITS[plan].maxMembers,
            members,
            pendingInvites,
            totalSlotsUsed: members + pendingInvites,
        };
    }
    async workspaceUsage(teamId) {
        const plan = await this.getPlan(teamId);
        const workspaces = await db_1.prisma.workspace.count({
            where: { ownerTeamId: teamId, deletedAt: null },
        });
        return {
            plan,
            limit: shared_1.PLAN_LIMITS[plan].maxWorkspaces,
            workspaces,
        };
    }
    /** Throws PLAN_LIMIT_EXCEEDED if a new workspace would push the team
     *  past its workspace cap. */
    async assertCanAddWorkspace(teamId) {
        const u = await this.workspaceUsage(teamId);
        if (u.workspaces >= u.limit) {
            throw new app_error_1.AppError('PLAN_LIMIT_EXCEEDED', 402, `${u.plan} plan is limited to ${u.limit} workspaces per team (currently ${u.workspaces}). Upgrade to add more.`);
        }
    }
};
exports.TeamService = TeamService;
exports.TeamService = TeamService = __decorate([
    (0, common_1.Injectable)()
], TeamService);
//# sourceMappingURL=team.service.js.map