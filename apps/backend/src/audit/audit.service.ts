import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@volt/db';
import { prisma, AuditAction } from '@volt/db';

const MAX_PAGE = 500;
const DEFAULT_PAGE = 100;

export interface AuditEntryView {
  id: string;
  teamId: string;
  action: AuditAction;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  actor: { id: string; name: string; email: string } | null;
}

@Injectable()
export class AuditService {
  private readonly log = new Logger('AuditService');

  /**
   * Append-only record of a team-scoped action.
   *
   * Audit writes are best-effort: they must never block the underlying
   * mutation. Callers fire-and-forget unless they explicitly await it.
   * A failure here is logged but swallowed so the user-visible operation
   * still succeeds.
   */
  async record(
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
      this.log.warn(`failed to write audit entry: ${(e as Error).message}`);
    }
  }

  async list(teamId: string, limit = DEFAULT_PAGE): Promise<AuditEntryView[]> {
    const take = Math.min(Math.max(1, limit | 0), MAX_PAGE);
    const rows = await prisma.auditLogEntry.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Hydrate the actor name/email for display. Actors may be null (system
    // events) so we batch-lookup once at the end.
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      action: r.action,
      metadata: r.metadata as Prisma.JsonValue,
      createdAt: r.createdAt,
      actor: r.actorId ? userById.get(r.actorId) ?? null : null,
    }));
  }
}
