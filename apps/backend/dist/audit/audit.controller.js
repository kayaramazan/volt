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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const session_guard_1 = require("../auth/session.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const team_service_1 = require("../team/team.service");
const audit_service_1 = require("./audit.service");
let AuditController = class AuditController {
    auditService;
    teamService;
    constructor(auditService, teamService) {
        this.auditService = auditService;
        this.teamService = teamService;
    }
    /**
     * Returns the most recent audit-log entries for a team, newest-first.
     * Owners only — the audit log can include billing actions and member
     * removals, both of which leak information about other members.
     */
    async list(user, teamId, limit) {
        await this.teamService.assertOwner(user.id, teamId);
        const take = limit ? Number(limit) : undefined;
        const entries = await this.auditService.list(teamId, take);
        return { entries };
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)(':id/audit-log'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "list", null);
exports.AuditController = AuditController = __decorate([
    (0, common_1.Controller)('teams'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __metadata("design:paramtypes", [audit_service_1.AuditService,
        team_service_1.TeamService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map