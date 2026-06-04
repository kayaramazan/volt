// Billing service — wraps Stripe SDK and the local Subscription mirror.
// Subscription state is kept locally so we can answer "what plan is this
// team on?" without a Stripe round-trip; Stripe events flow in via the
// webhook handler and update the mirror.

import { Injectable, Logger } from '@nestjs/common';
import type { Stripe } from 'stripe/cjs/stripe.core.js';
import { prisma, AuditAction, PlanTier, SubscriptionStatus } from '@volt/db';

import { AppError } from '../common/app.error';
import { AuditService } from '../audit/audit.service';
import { TeamService } from '../team/team.service';
import { getStripe, getStripeConfig, isBillingConfigured } from './stripe.client';

@Injectable()
export class BillingService {
  private readonly log = new Logger('BillingService');

  constructor(
    private readonly teamService: TeamService,
    private readonly auditService: AuditService,
  ) {}

  configured(): boolean {
    return isBillingConfigured();
  }

  /** Returns the local subscription mirror, defaulting to FREE if the team
   *  has never been billed. Any team member can read this. */
  async getStatus(userId: string, teamId: string) {
    await this.teamService.assertMember(userId, teamId);
    const sub = await prisma.subscription.findUnique({ where: { teamId } });
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
        plan: PlanTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: null as Date | null,
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
  async createCheckoutSession(userId: string, teamId: string, email: string) {
    await this.teamService.assertOwner(userId, teamId);
    const cfg = getStripeConfig();
    if (!cfg.proPriceId) {
      throw new AppError(
        'STRIPE_PRICE_NOT_CONFIGURED',
        503,
        'STRIPE_PRICE_PRO_MONTHLY is not configured on this backend.',
      );
    }

    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    const existing = await prisma.subscription.findUnique({ where: { teamId } });
    const customerId = existing?.stripeCustomerId ?? undefined;

    const stripe = getStripe();
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

    await this.auditService.record(teamId, userId, AuditAction.BILLING_CHECKOUT_STARTED, {
      sessionId: session.id,
    });

    return { url: session.url, sessionId: session.id };
  }

  /** Creates a Stripe billing portal session so the customer can manage
   *  their payment method / cancel / view invoices. */
  async createPortalSession(userId: string, teamId: string) {
    await this.teamService.assertOwner(userId, teamId);
    const cfg = getStripeConfig();
    const sub = await prisma.subscription.findUnique({ where: { teamId } });
    if (!sub?.stripeCustomerId) {
      throw new AppError(
        'NO_STRIPE_CUSTOMER',
        404,
        'This team has no Stripe customer yet — start a checkout first.',
      );
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${cfg.appUrl}/billing/return`,
    });
    await this.auditService.record(teamId, userId, AuditAction.BILLING_PORTAL_OPENED, {});
    return { url: session.url };
  }

  // ─────────────────────────────────────────────────────────
  // Webhook handling — invoked from the controller with a verified event.
  // ─────────────────────────────────────────────────────────

  verifyWebhook(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    const cfg = getStripeConfig();
    if (!cfg.webhookSecret) {
      throw new AppError(
        'WEBHOOK_SECRET_NOT_SET',
        503,
        'STRIPE_WEBHOOK_SECRET is not configured.',
      );
    }
    if (!signature) {
      throw new AppError('MISSING_SIGNATURE', 400);
    }
    const stripe = getStripe();
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, cfg.webhookSecret);
    } catch (e) {
      throw new AppError('INVALID_SIGNATURE', 400, (e as Error).message);
    }
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = (session.metadata?.teamId ?? session.client_reference_id) || null;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (teamId && subId) {
          // Fetch the full subscription so we have status + price + period end.
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          await this.upsertFromStripe(teamId, customerId ?? null, sub);
          await this.auditService.record(teamId, null, AuditAction.BILLING_PLAN_CHANGED, {
            event: 'checkout.session.completed',
            plan: 'PRO',
          });
        }
        return;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = sub.metadata?.teamId;
        if (!teamId) return;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await this.upsertFromStripe(teamId, customerId, sub);
        return;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = sub.metadata?.teamId;
        if (!teamId) return;
        await prisma.subscription.updateMany({
          where: { teamId },
          data: {
            plan: PlanTier.FREE,
            status: SubscriptionStatus.CANCELED,
            cancelAtPeriodEnd: false,
            stripeSubscriptionId: null,
          },
        });
        await this.auditService.record(teamId, null, AuditAction.BILLING_CANCELED, {
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

  private async upsertFromStripe(
    teamId: string,
    customerId: string | null,
    sub: Stripe.Subscription,
  ) {
    const status = mapStripeStatus(sub.status);
    const plan =
      status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING
        ? PlanTier.PRO
        : PlanTier.FREE;
    const priceId = sub.items.data[0]?.price?.id ?? null;
    const periodEndUnix = sub.items.data[0]?.current_period_end ?? null;

    await prisma.subscription.upsert({
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
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'incomplete':
      return SubscriptionStatus.INCOMPLETE;
    case 'incomplete_expired':
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    case 'unpaid':
      return SubscriptionStatus.UNPAID;
    case 'paused':
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}
