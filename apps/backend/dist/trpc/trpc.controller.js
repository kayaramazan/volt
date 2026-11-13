"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrpcController = void 0;
const common_1 = require("@nestjs/common");
const trpcExpress = __importStar(require("@trpc/server/adapters/express"));
const trpc_router_1 = require("./trpc.router");
const context_1 = require("./context");
let TrpcController = class TrpcController {
    router;
    constructor(router) {
        this.router = router;
    }
    /**
     * tRPC uses its own URL routing under the prefix. We delegate the entire
     * request to its express handler.
     */
    async handle(req, res) {
        const handler = trpcExpress.createExpressMiddleware({
            router: this.router.build(),
            createContext: ({ req, res }) => (0, context_1.createTrpcContext)(req, res),
        });
        // Strip the /api/trpc prefix from req.url so tRPC sees clean paths
        req.url = req.url.replace(/^\/api\/trpc/, '') || '/';
        return handler(req, res, () => {
            /* next not needed — tRPC ends the response */
        });
    }
};
exports.TrpcController = TrpcController;
__decorate([
    (0, common_1.All)('*'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TrpcController.prototype, "handle", null);
exports.TrpcController = TrpcController = __decorate([
    (0, common_1.Controller)('trpc'),
    __metadata("design:paramtypes", [trpc_router_1.TrpcRouter])
], TrpcController);
//# sourceMappingURL=trpc.controller.js.map