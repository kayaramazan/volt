"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@volt/db");
const app_error_1 = require("../common/app.error");
let UserService = class UserService {
    async updateProfile(userId, data) {
        return db_1.prisma.user.update({
            where: { id: userId },
            data: { name: data.name },
            select: { id: true, email: true, name: true },
        });
    }
    async deleteAccount(userId) {
        // Pre-check: user can't delete if they own a team with other members.
        // They must transfer ownership or delete the team first.
        const ownedTeams = await db_1.prisma.team.findMany({
            where: { ownerId: userId },
            include: { _count: { select: { members: true } } },
        });
        const blockingTeam = ownedTeams.find((t) => t._count.members > 1);
        if (blockingTeam) {
            throw new app_error_1.AppError('NOT_TEAM_OWNER', 409, `You own team "${blockingTeam.name}" with multiple members. Transfer ownership or delete the team first.`);
        }
        // Cascade deletes handle the rest (workspaces, sessions, devices, memberships).
        await db_1.prisma.user.delete({ where: { id: userId } });
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)()
], UserService);
//# sourceMappingURL=user.service.js.map