import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { prisma, TeamRole } from '@volt/db';
import { AppError } from '../common/app.error';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class TeamService {
  async create(userId: string, name: string) {
    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name, ownerId: userId },
      });
      await tx.teamMember.create({
        data: { teamId: team.id, userId, role: TeamRole.OWNER },
      });
      return team;
    });
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

    const code = nanoid(32);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);

    return prisma.teamInvite.create({
      data: {
        teamId,
        email,
        code,
        createdBy: userId,
        expiresAt,
      },
    });
  }

  async acceptInvite(userId: string, code: string) {
    const invite = await prisma.teamInvite.findUnique({ where: { code } });
    if (!invite) throw new AppError('INVITE_EXPIRED', 404);
    if (invite.acceptedAt) throw new AppError('INVITE_ALREADY_ACCEPTED', 409);
    if (invite.expiresAt < new Date()) throw new AppError('INVITE_EXPIRED', 410);

    return prisma.$transaction(async (tx) => {
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

    return prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
    });
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
  }

  async delete(actorId: string, teamId: string) {
    await this.assertOwner(actorId, teamId);
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
}
