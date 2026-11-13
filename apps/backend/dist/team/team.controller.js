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
exports.TeamController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@volt/shared");
const zod_1 = require("zod");
const team_service_1 = require("./team.service");
const session_guard_1 = require("../auth/session.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const zod_pipe_1 = require("../common/pipes/zod.pipe");
const TransferOwnershipInput = zod_1.z.object({ newOwnerId: zod_1.z.string().uuid() });
let TeamController = class TeamController {
    teams;
    constructor(teams) {
        this.teams = teams;
    }
    list(user) {
        return this.teams.list(user.id);
    }
    create(user, input) {
        return this.teams.create(user.id, input.name);
    }
    getDetail(user, id) {
        return this.teams.getDetail(user.id, id);
    }
    invite(user, id, input) {
        return this.teams.invite(user.id, id, input.email);
    }
    accept(user, code) {
        return this.teams.acceptInvite(user.id, code);
    }
    updateRole(user, teamId, userId, input) {
        return this.teams.updateMemberRole(user.id, teamId, userId, input.role);
    }
    removeMember(user, teamId, userId) {
        return this.teams.removeMember(user.id, teamId, userId);
    }
    transferOwnership(user, teamId, body) {
        return this.teams.transferOwnership(user.id, teamId, body.newOwnerId);
    }
    delete(user, id) {
        return this.teams.delete(user.id, id);
    }
};
exports.TeamController = TeamController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_pipe_1.ZodValidationPipe(shared_1.CreateTeamInput))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Post)(':id/invite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)(new zod_pipe_1.ZodValidationPipe(shared_1.InviteTeamMemberInput.pick({ email: true })))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invite/:code/accept'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "accept", null);
__decorate([
    (0, common_1.Patch)(':id/members/:userId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)(new zod_pipe_1.ZodValidationPipe(shared_1.UpdateMemberRoleInput.pick({ role: true })))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)(':id/members/:userId'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)('userId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Post)(':id/transfer-ownership'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)(new zod_pipe_1.ZodValidationPipe(TransferOwnershipInput))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, void 0]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "transferOwnership", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "delete", null);
exports.TeamController = TeamController = __decorate([
    (0, common_1.Controller)('teams'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __metadata("design:paramtypes", [team_service_1.TeamService])
], TeamController);
//# sourceMappingURL=team.controller.js.map