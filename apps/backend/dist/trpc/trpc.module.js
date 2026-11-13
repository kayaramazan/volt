"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrpcModule = void 0;
const common_1 = require("@nestjs/common");
const trpc_router_1 = require("./trpc.router");
const trpc_controller_1 = require("./trpc.controller");
const auth_module_1 = require("../auth/auth.module");
const team_module_1 = require("../team/team.module");
const workspace_module_1 = require("../workspace/workspace.module");
const sync_module_1 = require("../sync/sync.module");
let TrpcModule = class TrpcModule {
};
exports.TrpcModule = TrpcModule;
exports.TrpcModule = TrpcModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, team_module_1.TeamModule, workspace_module_1.WorkspaceModule, sync_module_1.SyncModule],
        controllers: [trpc_controller_1.TrpcController],
        providers: [trpc_router_1.TrpcRouter],
    })
], TrpcModule);
//# sourceMappingURL=trpc.module.js.map