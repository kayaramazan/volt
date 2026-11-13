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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const shared_1 = require("@volt/shared");
const sync_service_1 = require("./sync.service");
const sync_stream_service_1 = require("./sync-stream.service");
const session_guard_1 = require("../auth/session.guard");
const workspace_service_1 = require("../workspace/workspace.service");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const zod_pipe_1 = require("../common/pipes/zod.pipe");
let SyncController = class SyncController {
    sync;
    streams;
    workspaces;
    constructor(sync, streams, workspaces) {
        this.sync = sync;
        this.streams = streams;
        this.workspaces = workspaces;
    }
    async push(user, input) {
        await this.workspaces.assertAccess(user.id, input.workspaceId);
        return this.sync.push(user.id, input.workspaceId, input.baseRevision, input.changes);
    }
    async pull(user, workspaceId, since) {
        await this.workspaces.assertAccess(user.id, workspaceId);
        const parsed = shared_1.SyncPullInput.parse({ workspaceId, since: since ?? '0' });
        return this.sync.pull(parsed.workspaceId, parsed.since);
    }
    /**
     * SSE stream. The client subscribes to receive `change` and `heartbeat` events
     * for the given workspace.
     *
     * Auth note: SSE in browsers can't send custom headers, so the client passes
     * the session token as ?token= in the URL. SessionGuard accepts this.
     */
    async stream(user, workspaceId) {
        await this.workspaces.assertAccess(user.id, workspaceId);
        return this.streams.subscribe(workspaceId).pipe((0, rxjs_1.map)((event) => ({
            type: event.type,
            data: event,
        })));
    }
    async conflicts(user, workspaceId) {
        await this.workspaces.assertAccess(user.id, workspaceId);
        return this.sync.listConflicts(workspaceId);
    }
    async restoreConflict(user, id) {
        return this.sync.restoreConflict(user.id, id);
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('push'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_pipe_1.ZodValidationPipe(shared_1.SyncPushInput))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "push", null);
__decorate([
    (0, common_1.Get)('pull'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('workspaceId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('since')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "pull", null);
__decorate([
    (0, common_1.Sse)('stream'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('workspaceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "stream", null);
__decorate([
    (0, common_1.Get)('conflicts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('workspaceId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "conflicts", null);
__decorate([
    (0, common_1.Post)('conflicts/:id/restore'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "restoreConflict", null);
exports.SyncController = SyncController = __decorate([
    (0, common_1.Controller)('sync'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __metadata("design:paramtypes", [sync_service_1.SyncService,
        sync_stream_service_1.SyncStreamService,
        workspace_service_1.WorkspaceService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map