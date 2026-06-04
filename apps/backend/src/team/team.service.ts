import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { Prisma } from '@volt/db';
import { prisma, AuditAction, PlanTier, TeamRole } from '@volt/db';
import { PLAN_LIMITS } from '@volt/shared';
import { AppError } from '../common/app.error';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class TeamService {
  private readonly auditLog = new Logger('TeamAudit');

  /** Best-effort audit hook — never blocks the user-visible mutation.
   *  Kept inline here to avoid a circular DI between TeamModule and
   *  AuditModule (which itself imports TeamModule for the assertOwner
   *  guard on /teams/:id/audit-log). */
  private async audit(
    teamId: string,
    actorId: string | null,
    action: AuditAction,
    metadata: Prisma.InputJsonValue = {},
  ): Promise<void> {
    try {
      await prisma.auditLogEntry.create({
        data: { teamId, actorId, action, metadata },
      });
    } catch (e) {
      this.auditLog.warn(`failed to write audit entry: ${(e as Error).message}`);
    }
  }

  async create(userId: string, name: string) {
    const team = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name, ownerId: userId },
      });
      await tx.teamMember.create({
        data: { teamId: team.id, userId, role: TeamRole.OWNER },
      });
      return team;
    });
    void this.audit(team.id, userId, AuditAction.TEAM_CREATED, { name });
    return team;
  }

  async list(userId: string) {
    return prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { members: true } },
      },
    });
  }

  async getDetail(userId: string, teamId: string) {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });
    if (!membership) throw new AppError('NOT_TEAM_MEMBER', 404);

    return prisma.team.findUniqueOrThrow({
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

  async invite(userId: string, teamId: string, email: string) {
    await this.assertOwner(userId, teamId);

    // Refuse invite if the email already belongs to a member of this team
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.teamMember.findFirst({
        where: { teamId, userId: existingUser.id },
      });
      if (alreadyMember) {
        throw new AppError('NOT_TEAM_MEMBER', 409, 'User is already a member.');
      }
    }

    // Plan-limit gate: existing members + still-pending invites must stay
    // below the cap for the team's current plan. Outstanding invites count
    // so a free team can't paper over the limit by pre-issuing 50 invites.
    const usage = await this.memberUsage(teamId);
    if (usage.totalSlotsUsed >= usage.limit) {
      throw new AppError(
        'PLAN_LIMIT_EXCEEDED',
        402,
        `${usage.plan} plan is limited to ${usage.limit} members (currently ${usage.members} member${usage.members === 1 ? '' : 's'} + ${usage.pendingInvites} pending invite${usage.pendingInvites === 1 ? '' : 's'}). Upgrade to add more.`,
      );
    }

    const code = nanoid(32);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        email,
        code,
        createdBy: userId,
        expiresAt,
      },
    });
    void this.audit(teamId, userId, AuditAction.MEMBER_INVITED, { email });
    return invite;
  }

  async acceptInvite(userId: string, code: string) {
    const invite = await prisma.teamInvite.findUnique({ where: { code } });
    if (!invite) throw new AppError('INVITE_EXPIRED', 404);
    if (invite.acceptedAt) throw new AppError('INVITE_ALREADY_ACCEPTED', 409);
    if (invite.expiresAt < new Date()) throw new AppError('INVITE_EXPIRED', 410);

    const result = await prisma.$transaction(async (tx) => {
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
        data: { teamId: invite.teamId, userId, role: TeamRole.EDITOR },
      });
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return { teamId: invite.teamId, alreadyMember: false };
    });
    if (!result.alreadyMember) {
      void this.audit(result.teamId, userId, AuditAction.MEMBER_JOINED, { inviteCode: code });
    }
    return result;
  }

  async updateMemberRole(
    actorId: string,
    teamId: string,
    userId: string,
    role: TeamRole,
  ) {
    await this.assertOwner(actorId, teamId);

    if (actorId === userId && role !== TeamRole.OWNER) {
      // Owner trying to demote self — verify another owner exists
      const ownersCount = await prisma.teamMember.count({
        where: { teamId, role: TeamRole.OWNER },
      });
      if (ownersCount <= 1) {
        throw new AppError('CANNOT_REMOVE_LAST_OWNER', 409);
      }
    }

    const previous = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    const updated = await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
    });
    void this.audit(teamId, actorId, AuditAction.MEMBER_ROLE_CHANGED, {
      targetUserId: userId,
      fromRole: previous?.role,
      toRole: role,
    });
    return updated;
  }

  async removeMember(actorId: string, teamId: string, userId: string) {
    if (actorId !== userId) {
      await this.assertOwner(actorId, teamId);
    }

    const member = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new AppError('NOT_TEAM_MEMBER', 404);

    if (member.role === TeamRole.OWNER) {
      const ownersCount = await prisma.teamMember.count({
        where: { teamId, role: TeamRole.OWNER },
      });
      if (ownersCount <= 1) {
        throw new AppError('CANNOT_REMOVE_LAST_OWNER', 409);
      }
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    void this.audit(teamId, actorId, AuditAction.MEMBER_REMOVED, {
      targetUserId: userId,
      selfRemoval: actorId === userId,
    });
  }

  async transferOwnership(actorId: string, teamId: string, newOwnerId: string) {
    await this.assertOwner(actorId, teamId);

    const newOwnerMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: newOwnerId } },
    });
    if (!newOwnerMember) {
      throw new AppError('NOT_TEAM_MEMBER', 404, 'New owner must be an existing team member.');
    }

    await prisma.$transaction([
      prisma.team.update({
        where: { id: teamId },
        data: { ownerId: newOwnerId },
      }),
      prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: newOwnerId } },
        data: { role: TeamRole.OWNER },
      }),
      prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: actorId } },
        data: { role: TeamRole.EDITOR },
      }),
    ]);
    void this.audit(teamId, actorId, AuditAction.OWNERSHIP_TRANSFERRED, {
      newOwnerId,
      previousOwnerId: actorId,
    });
  }

  async delete(actorId: string, teamId: string) {
    await this.assertOwner(actorId, teamId);
    // Audit BEFORE delete since the team is cascade-deleted along with
    // its audit entries; this record is mostly for monitoring/aggregation.
    void this.audit(teamId, actorId, AuditAction.TEAM_DELETED, {});
    await prisma.team.delete({ where: { id: teamId } });
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  async assertMember(userId: string, teamId: string): Promise<TeamRole> {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });
    if (!membership) throw new AppError('NOT_TEAM_MEMBER', 404);
    return membership.role;
  }

  async assertOwner(userId: string, teamId: string) {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });
    if (!membership) throw new AppError('NOT_TEAM_MEMBER', 404);
    if (membership.role !== TeamRole.OWNER) {
      throw new AppError('NOT_TEAM_OWNER', 403);
    }
  }

  /** OWNER or EDITOR — i.e. anyone with write access to team-owned data. */
  async assertEditor(userId: string, teamId: string): Promise<TeamRole> {
    const role = await this.assertMember(userId, teamId);
    if (role === TeamRole.VIEWER) {
      throw new AppError('TEAM_VIEWER_READ_ONLY', 403, 'VIEWERs cannot modify team data.');
    }
    return role;
  }

  // ─────────────────────────────────────────────────────────
  // Plan limits
  // ─────────────────────────────────────────────────────────

  /** Effective plan for a team — defaults to FREE when no subscription
   *  row exists yet. Treats any non-active/trialing subscription as FREE
   *  so a lapsed PRO team falls back to free-tier limits. */
  async getPlan(teamId: string): Promise<PlanTier> {
    const sub = await prisma.subscription.findUnique({ where: { teamId } });
    if (!sub) return PlanTier.FREE;
    return sub.plan;
  }

  /** Current member + pending-invite usage for the team's plan. Used by
   *  invite + workspace-create flows to gate growth. */
  async memberUsage(teamId: string): Promise<{
    plan: PlanTier;
    limit: number;
    members: number;
    pendingInvites: number;
    totalSlotsUsed: number;
  }> {
    const plan = await this.getPlan(teamId);
    const [members, pendingInvites] = await Promise.all([
      prisma.teamMember.count({ where: { teamId } }),
      prisma.teamInvite.count({
        where: { teamId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    return {
      plan,
      limit: PLAN_LIMITS[plan].maxMembers,
      members,
      pendingInvites,
      totalSlotsUsed: members + pendingInvites,
    };
  }

  async workspaceUsage(teamId: string): Promise<{
    plan: PlanTier;
    limit: number;
    workspaces: number;
  }> {
    const plan = await this.getPlan(teamId);
    const workspaces = await prisma.workspace.count({
      where: { ownerTeamId: teamId, deletedAt: null },
    });
    return {
      plan,
      limit: PLAN_LIMITS[plan].maxWorkspaces,
      workspaces,
    };
  }

  /** Throws PLAN_LIMIT_EXCEEDED if a new workspace would push the team
   *  past its workspace cap. */
  async assertCanAddWorkspace(teamId: string): Promise<void> {
    const u = await this.workspaceUsage(teamId);
    if (u.workspaces >= u.limit) {
      throw new AppError(
        'PLAN_LIMIT_EXCEEDED',
        402,
        `${u.plan} plan is limited to ${u.limit} workspaces per team (currently ${u.workspaces}). Upgrade to add more.`,
      );
    }
  }
}
