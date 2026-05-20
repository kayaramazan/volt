import { Injectable } from '@nestjs/common';
import { prisma } from '@volt/db';
import { AppError } from '../common/app.error';
import { TeamService } from '../team/team.service';

const SOFT_DELETE_RECOVERY_DAYS = 30;

@Injectable()
export class WorkspaceService {
  constructor(private readonly teams: TeamService) {}

  async list(userId: string) {
    const [personal, team] = await Promise.all([
      prisma.workspace.findMany({
        where: { ownerUserId: userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.workspace.findMany({
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

  async create(userId: string, name: string, teamId?: string, id?: string) {
    if (teamId) {
      await this.teams.assertMember(userId, teamId);
      return prisma.workspace.create({
        data: { ...(id ? { id } : {}), name, ownerTeamId: teamId },
      });
    }
    return prisma.workspace.create({
      data: { ...(id ? { id } : {}), name, ownerUserId: userId },
    });
  }

  async rename(userId: string, workspaceId: string, name: string) {
    await this.assertAccess(userId, workspaceId);
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });
  }

  /**
   * Soft delete with 30-day recovery. The workspace becomes invisible
   * in list but rows are preserved.
   */
  async softDelete(userId: string, workspaceId: string) {
    await this.assertAccess(userId, workspaceId);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard delete — cascades. Only callable after recovery window or by support.
   * Not exposed in MVP UI.
   */
  async hardDelete(workspaceId: string) {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  }

  /**
   * Permanent purge of workspaces deleted > 30 days ago.
   * Called by a cron / scheduled task.
   */
  async purgeSoftDeleted() {
    const cutoff = new Date(Date.now() - SOFT_DELETE_RECOVERY_DAYS * 86_400_000);
    const result = await prisma.workspace.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    return result.count;
  }

  /**
   * Move personal workspace to a team (irreversible without re-creation).
   */
  async moveToTeam(userId: string, workspaceId: string, teamId: string) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND', 404);
    if (workspace.ownerUserId !== userId) {
      throw new AppError('WORKSPACE_NOT_FOUND', 403, 'Only the owner can move a workspace.');
    }
    await this.teams.assertMember(userId, teamId);

    return prisma.workspace.update({
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
  async assertAccess(userId: string, workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
        OR: [
          { ownerUserId: userId },
          { ownerTeam: { members: { some: { userId } } } },
        ],
      },
    });
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND', 404);
    return workspace;
  }
}
