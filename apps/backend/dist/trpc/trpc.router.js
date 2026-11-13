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
exports.TrpcRouter = void 0;
const common_1 = require("@nestjs/common");
const server_1 = require("@trpc/server");
const zod_1 = require("zod");
const shared_1 = require("@volt/shared");
const team_service_1 = require("../team/team.service");
const workspace_service_1 = require("../workspace/workspace.service");
const sync_service_1 = require("../sync/sync.service");
const auth_service_1 = require("../auth/auth.service");
const app_error_1 = require("../common/app.error");
const t = server_1.initTRPC.context().create({
    errorFormatter({ shape, error }) {
        if (error.cause instanceof app_error_1.AppError) {
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
        throw new server_1.TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
});
let TrpcRouter = class TrpcRouter {
    auth;
    teams;
    workspaces;
    sync;
    constructor(auth, teams, workspaces, sync) {
        this.auth = auth;
        this.teams = teams;
        this.workspaces = workspaces;
        this.sync = sync;
    }
    build() {
        const router = t.router({
            // ────────────────────────────────────────────────────
            // Account
            // ────────────────────────────────────────────────────
            me: protectedProcedure.query(({ ctx }) => this.auth.me(ctx.user.id, ctx.deviceId ?? null)),
            // ────────────────────────────────────────────────────
            // Teams
            // ────────────────────────────────────────────────────
            'team.list': protectedProcedure.query(({ ctx }) => this.teams.list(ctx.user.id)),
            'team.create': protectedProcedure
                .input(shared_1.CreateTeamInput)
                .mutation(({ ctx, input }) => this.teams.create(ctx.user.id, input.name)),
            'team.detail': protectedProcedure
                .input(zod_1.z.object({ id: zod_1.z.string().uuid() }))
                .query(({ ctx, input }) => this.teams.getDetail(ctx.user.id, input.id)),
            'team.invite': protectedProcedure
                .input(shared_1.InviteTeamMemberInput)
                .mutation(({ ctx, input }) => this.teams.invite(ctx.user.id, input.teamId, input.email)),
            'team.acceptInvite': protectedProcedure
                .input(zod_1.z.object({ code: zod_1.z.string() }))
                .mutation(({ ctx, input }) => this.teams.acceptInvite(ctx.user.id, input.code)),
            'team.removeMember': protectedProcedure
                .input(zod_1.z.object({ teamId: zod_1.z.string().uuid(), userId: zod_1.z.string().uuid() }))
                .mutation(({ ctx, input }) => this.teams.removeMember(ctx.user.id, input.teamId, input.userId)),
            // ────────────────────────────────────────────────────
            // Workspaces
            // ────────────────────────────────────────────────────
            'workspace.list': protectedProcedure.query(({ ctx }) => this.workspaces.list(ctx.user.id)),
            'workspace.create': protectedProcedure
                .input(shared_1.CreateWorkspaceInput)
                .mutation(({ ctx, input }) => this.workspaces.create(ctx.user.id, input.name, input.teamId)),
            'workspace.rename': protectedProcedure
                .input(shared_1.RenameWorkspaceInput)
                .mutation(({ ctx, input }) => this.workspaces.rename(ctx.user.id, input.id, input.name)),
            'workspace.delete': protectedProcedure
                .input(zod_1.z.object({ id: zod_1.z.string().uuid() }))
                .mutation(({ ctx, input }) => this.workspaces.softDelete(ctx.user.id, input.id)),
            // ────────────────────────────────────────────────────
            // Sync
            // ────────────────────────────────────────────────────
            'sync.push': protectedProcedure
                .input(shared_1.SyncPushInput)
                .mutation(async ({ ctx, input }) => {
                await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
                return this.sync.push(ctx.user.id, input.workspaceId, input.baseRevision, input.changes);
            }),
            'sync.pull': protectedProcedure
                .input(shared_1.SyncPullInput)
                .query(async ({ ctx, input }) => {
                await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
                return this.sync.pull(input.workspaceId, input.since);
            }),
            'sync.conflicts': protectedProcedure
                .input(zod_1.z.object({ workspaceId: zod_1.z.string().uuid() }))
                .query(async ({ ctx, input }) => {
                await this.workspaces.assertAccess(ctx.user.id, input.workspaceId);
                return this.sync.listConflicts(input.workspaceId);
            }),
            'sync.restoreConflict': protectedProcedure
                .input(zod_1.z.object({ conflictId: zod_1.z.string().uuid() }))
                .mutation(({ ctx, input }) => this.sync.restoreConflict(ctx.user.id, input.conflictId)),
        });
        return router;
    }
};
exports.TrpcRouter = TrpcRouter;
exports.TrpcRouter = TrpcRouter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        team_service_1.TeamService,
        workspace_service_1.WorkspaceService,
        sync_service_1.SyncService])
], TrpcRouter);
//# sourceMappingURL=trpc.router.js.map