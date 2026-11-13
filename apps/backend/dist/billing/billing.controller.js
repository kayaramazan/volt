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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const session_guard_1 = require("../auth/session.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const billing_service_1 = require("./billing.service");
let BillingController = class BillingController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    // ── Team-scoped endpoints (auth required) ────────────────────────────
    async getStatus(user, teamId) {
        return this.billing.getStatus(user.id, teamId);
    }
    async checkout(user, teamId) {
        return this.billing.createCheckoutSession(user.id, teamId, user.email);
    }
    async portal(user, teamId) {
        return this.billing.createPortalSession(user.id, teamId);
    }
    // ── Stripe webhook (no auth — signature-verified) ────────────────────
    // This route deliberately uses the raw request body (configured in
    // main.ts) so Stripe's signature check works. JSON parsing is done by
    // the SDK inside `verifyWebhook`.
    async webhook(req, signature, _body) {
        const raw = req.rawBody;
        if (!raw) {
            // Raw-body middleware not active.
            return { received: false, error: 'raw body unavailable' };
        }
        const event = this.billing.verifyWebhook(raw, signature);
        await this.billing.handleEvent(event);
        return { received: true };
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('teams/:id/billing'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('teams/:id/billing/checkout'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "checkout", null);
__decorate([
    (0, common_1.Post)('teams/:id/billing/portal'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "portal", null);
__decorate([
    (0, common_1.Post)('webhooks/stripe'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('stripe-signature')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "webhook", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map