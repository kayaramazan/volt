"use strict";
// Billing service — wraps Stripe SDK and the local Subscription mirror.
// Subscription state is kept locally so we can answer "what plan is this
// team on?" without a Stripe round-trip; Stripe events flow in via the
// webhook handler and update the mirror.
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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@volt/db");
const app_error_1 = require("../common/app.error");
const audit_service_1 = require("../audit/audit.service");
const team_service_1 = require("../team/team.service");
const stripe_client_1 = require("./stripe.client");
let BillingService = class BillingService {
    teamService;
    auditService;
    log = new common_1.Logger('BillingService');
    constructor(teamService, auditService) {
        this.teamService = teamService;
        this.auditService = auditService;
    }
    configured() {
        return (0, stripe_client_1.isBillingConfigured)();
    }
    /** Returns the local subscription mirror, defaulting to FREE if the team
     *  has never been billed. Any team member can read this. */
    async getStatus(userId, teamId) {
        await this.teamService.assertMember(userId, teamId);
        const sub = await db_1.prisma.subscription.findUnique({ where: { teamId } });
        // Always include current usage so the UI can show "3 / 5 members"
        // without a second round-trip. Plan-limit enforcement still happens
        // server-side; this is purely for display.
        const [memberUsage, wsUsage] = await Promise.all([
            this.teamService.memberUsage(teamId),
            this.teamService.workspaceUsage(teamId),
        ]);
        const usage = {
            members: memberUsage.members,
            pendingInvites: memberUsage.pendingInvites,
            maxMembers: memberUsage.limit,
            workspaces: wsUsage.workspaces,
            maxWorkspaces: wsUsage.limit,
        };
        if (!sub) {
            return {
                plan: db_1.PlanTier.FREE,
                status: db_1.SubscriptionStatus.ACTIVE,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                configured: this.configured(),
                usage,
            };
        }
        return {
            plan: sub.plan,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            configured: this.configured(),
            usage,
        };
    }
    /** Creates a Stripe Checkout Session for the team to upgrade to PRO.
     *  Returns the redirect URL the client should open in a browser. */
    async createCheckoutSession(userId, teamId, email) {
        await this.teamService.assertOwner(userId, teamId);
        const cfg = (0, stripe_client_1.getStripeConfig)();
        if (!cfg.proPriceId) {
            throw new app_error_1.AppError('STRIPE_PRICE_NOT_CONFIGURED', 503, 'STRIPE_PRICE_PRO_MONTHLY is not configured on this backend.');
        }
        const team = await db_1.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
        const existing = await db_1.prisma.subscription.findUnique({ where: { teamId } });
        const customerId = existing?.stripeCustomerId ?? undefined;
        const stripe = (0, stripe_client_1.getStripe)();
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            // Re-use the customer if we already have one so payment-method/billing
            // history stays tied to the team.
            customer: customerId,
            customer_email: customerId ? undefined : email,
            line_items: [{ price: cfg.proPriceId, quantity: 1 }],
            // Forward the team id so the webhook can link the subscription to
            // a team without needing additional state.
            client_reference_id: teamId,
            metadata: { teamId, actorUserId: userId },
            subscription_data: { metadata: { teamId } },
            success_url: `${cfg.appUrl}/billing/success?team=${encodeURIComponent(team.name)}`,
            cancel_url: `${cfg.appUrl}/billing/cancel`,
            allow_promotion_codes: true,
        });
        await this.auditService.record(teamId, userId, db_1.AuditAction.BILLING_CHECKOUT_STARTED, {
            sessionId: session.id,
        });
        return { url: session.url, sessionId: session.id };
    }
    /** Creates a Stripe billing portal session so the customer can manage
     *  their payment method / cancel / view invoices. */
    async createPortalSession(userId, teamId) {
        await this.teamService.assertOwner(userId, teamId);
        const cfg = (0, stripe_client_1.getStripeConfig)();
        const sub = await db_1.prisma.subscription.findUnique({ where: { teamId } });
        if (!sub?.stripeCustomerId) {
            throw new app_error_1.AppError('NO_STRIPE_CUSTOMER', 404, 'This team has no Stripe customer yet — start a checkout first.');
        }
        const stripe = (0, stripe_client_1.getStripe)();
        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: `${cfg.appUrl}/billing/return`,
        });
        await this.auditService.record(teamId, userId, db_1.AuditAction.BILLING_PORTAL_OPENED, {});
        return { url: session.url };
    }
    // ─────────────────────────────────────────────────────────
    // Webhook handling — invoked from the controller with a verified event.
    // ─────────────────────────────────────────────────────────
    verifyWebhook(rawBody, signature) {
        const cfg = (0, stripe_client_1.getStripeConfig)();
        if (!cfg.webhookSecret) {
            throw new app_error_1.AppError('WEBHOOK_SECRET_NOT_SET', 503, 'STRIPE_WEBHOOK_SECRET is not configured.');
        }
        if (!signature) {
            throw new app_error_1.AppError('MISSING_SIGNATURE', 400);
        }
        const stripe = (0, stripe_client_1.getStripe)();
        try {
            return stripe.webhooks.constructEvent(rawBody, signature, cfg.webhookSecret);
        }
        catch (e) {
            throw new app_error_1.AppError('INVALID_SIGNATURE', 400, e.message);
        }
    }
    async handleEvent(event) {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const teamId = (session.metadata?.teamId ?? session.client_reference_id) || null;
                const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
                const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
                if (teamId && subId) {
                    // Fetch the full subscription so we have status + price + period end.
                    const stripe = (0, stripe_client_1.getStripe)();
                    const sub = await stripe.subscriptions.retrieve(subId);
                    await this.upsertFromStripe(teamId, customerId ?? null, sub);
                    await this.auditService.record(teamId, null, db_1.AuditAction.BILLING_PLAN_CHANGED, {
                        event: 'checkout.session.completed',
                        plan: 'PRO',
                    });
                }
                return;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.created': {
                const sub = event.data.object;
                const teamId = sub.metadata?.teamId;
                if (!teamId)
                    return;
                const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
                await this.upsertFromStripe(teamId, customerId, sub);
                return;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const teamId = sub.metadata?.teamId;
                if (!teamId)
                    return;
                await db_1.prisma.subscription.updateMany({
                    where: { teamId },
                    data: {
                        plan: db_1.PlanTier.FREE,
                        status: db_1.SubscriptionStatus.CANCELED,
                        cancelAtPeriodEnd: false,
                        stripeSubscriptionId: null,
                    },
                });
                await this.auditService.record(teamId, null, db_1.AuditAction.BILLING_CANCELED, {
                    subscriptionId: sub.id,
                });
                return;
            }
            default:
                this.log.debug(`unhandled Stripe event ${event.type}`);
        }
    }
    // ─────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────
    async upsertFromStripe(teamId, customerId, sub) {
        const status = mapStripeStatus(sub.status);
        const plan = status === db_1.SubscriptionStatus.ACTIVE || status === db_1.SubscriptionStatus.TRIALING
            ? db_1.PlanTier.PRO
            : db_1.PlanTier.FREE;
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const periodEndUnix = sub.items.data[0]?.current_period_end ?? null;
        await db_1.prisma.subscription.upsert({
            where: { teamId },
            update: {
                status,
                plan,
                stripeCustomerId: customerId ?? undefined,
                stripeSubscriptionId: sub.id,
                stripePriceId: priceId,
                currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
            create: {
                teamId,
                status,
                plan,
                stripeCustomerId: customerId,
                stripeSubscriptionId: sub.id,
                stripePriceId: priceId,
                currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
        });
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [team_service_1.TeamService,
        audit_service_1.AuditService])
], BillingService);
function mapStripeStatus(s) {
    switch (s) {
        case 'active':
            return db_1.SubscriptionStatus.ACTIVE;
        case 'trialing':
            return db_1.SubscriptionStatus.TRIALING;
        case 'past_due':
            return db_1.SubscriptionStatus.PAST_DUE;
        case 'canceled':
            return db_1.SubscriptionStatus.CANCELED;
        case 'incomplete':
            return db_1.SubscriptionStatus.INCOMPLETE;
        case 'incomplete_expired':
            return db_1.SubscriptionStatus.INCOMPLETE_EXPIRED;
        case 'unpaid':
            return db_1.SubscriptionStatus.UNPAID;
        case 'paused':
            return db_1.SubscriptionStatus.PAUSED;
        default:
            return db_1.SubscriptionStatus.ACTIVE;
    }
}
//# sourceMappingURL=billing.service.js.map