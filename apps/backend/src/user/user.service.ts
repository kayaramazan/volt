import { Injectable } from '@nestjs/common';
import { prisma } from '@volt/db';
import { AppError } from '../common/app.error';

@Injectable()
export class UserService {
  async updateProfile(userId: string, data: { name?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
      select: { id: true, email: true, name: true },
    });
  }

  async deleteAccount(userId: string) {
    // Pre-check: user can't delete if they own a team with other members.
    // They must transfer ownership or delete the team first.
    const ownedTeams = await prisma.team.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { members: true } } },
    });
    const blockingTeam = ownedTeams.find((t) => t._count.members > 1);
    if (blockingTeam) {
      throw new AppError(
        'NOT_TEAM_OWNER',
        409,
        `You own team "${blockingTeam.name}" with multiple members. Transfer ownership or delete the team first.`,
      );
    }

    // Cascade deletes handle the rest (workspaces, sessions, devices, memberships).
    await prisma.user.delete({ where: { id: userId } });
  }
}
