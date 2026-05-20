import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreateTeamInput,
  CreateWorkspaceInput,
  InviteTeamMemberInput,
  RenameWorkspaceInput,
  SyncPullInput,
  SyncPushInput,
} from '@volt/shared';

import type { TrpcContext } from './context';
import { requireAuth } from './context';
import { TeamService } from '../team/team.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { SyncService } from '../sync/sync.service';
import { AuthService } from '../auth/auth.service';
import { AppError } from '../common/app.error';

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    if (error.cause instanceof AppError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          appCode: error.cause.code,
          extra: error.cause.extra ?? null,
        },
      };
    }
    return shape;
  },
});

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly auth: AuthService,
    private readonly teams: TeamService,
    private readonly workspaces: WorkspaceService,
    private readonly sync: SyncService,
  ) {}

  build() {
    const router = t.router({
      // ────────────────────────────────────────────────────
      // Account
      // ────────────────────────────────────────────────────
      me: protectedProcedure.query(({ ctx }) =>
        this.auth.me(ctx.user.id, ctx.deviceId ?? null),
      ),

      // ────────────────────────────────────────────────────
      // Teams
      // ────────────────────────────────────────────────────
      'team.list': protectedProcedure.query(({ ctx }) => this.teams.list(ctx.user.id)),
      'team.create': protectedProcedure
        .input(CreateTeamInput)
        .mutation(({ ctx, input }) => this.teams.create(ctx.user.id, input.name)),
      'team.detail': protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(({ ctx, input }) => this.teams.getDetail(ctx.user.id, input.id)),
      'team.invite': protectedProcedure
        .input(InviteTeamMemberInput)
        .mutation(({ ctx, input }) =>
          this.teams.invite(ctx.user.id, input.teamId, input.email),
        ),
      'team.acceptInvite': protectedProcedure
        .input(z.object({ code: z.string() }))
        .mutation(({ ctx, input }) => this.teams.acceptInvite(ctx.user.id, input.code)),
      'team.removeMember': protectedProcedure
        .input(z.object({ teamId: z.string().uuid(), userId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          this.teams.removeMember(ctx.user.id, input.teamId, input.userId),
        ),

      // ────────────────────────────────────────────────────
      // Workspaces
      // ────────────────────────────────────────────────────
      'workspace.list': protectedProcedure.query(({ ctx }) =>
        this.workspaces.list(ctx.user.id),
      ),
      'workspace.create': protectedProcedure
        .input(CreateWorkspaceInput)
        .mutation(({ ctx, input }) =>
          this.workspaces.create(ctx.user.id, input.name, input.teamId),
        ),
      'workspace.rename': protectedProcedure
        .input(RenameWorkspaceInput)
        .mutation(({ ctx, input }) =>
          this.workspaces.rename(ctx.user.id, input.id, input.name),
        ),
      'workspace.delete': protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(({ ctx, input }) => this.workspaces.softDelete(ctx.user.id, input.id)),

      // ────────────────────────────────────────────────────
      // Sync
      // ────────────────────────────────────────────────────
      'sync.push': protectedProcedure
        .input(SyncPushInput)
        .mutation(async ({ ctx, input }) => {
          await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
          return this.sync.push(
            ctx.user.id,
            input.workspaceId,
            input.baseRevision,
            input.changes,
          );
        }),
      'sync.pull': protectedProcedure
        .input(SyncPullInput)
        .query(async ({ ctx, input }) => {
          await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
          return this.sync.pull(input.workspaceId, input.since);
        }),
      'sync.conflicts': protectedProcedure
        .input(z.object({ workspaceId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
          await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
          return this.sync.listConflicts(input.workspaceId);
        }),
      'sync.restoreConflict': protectedProcedure
        .input(z.object({ conflictId: z.string().uuid() }))
        .mutation(({ ctx, input }) =>
          this.sync.restoreConflict(ctx.user.id, input.conflictId),
        ),
    });

    return router;
  }
}

export type AppRouter = ReturnType<TrpcRouter['build']>;
