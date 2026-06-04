// Lazy Stripe client + small helpers. We hold a single instance for the
// life of the process. If STRIPE_SECRET_KEY is unset, every method throws
// `STRIPE_NOT_CONFIGURED` so the controllers can surface a clean 503 — the
// rest of the backend keeps working in self-hosted / dev setups that
// don't need paid features.

// Runtime value comes from the public package entry — Node resolves this
// through stripe's `exports` map to `cjs/stripe.cjs.node.js`. The deeper
// `stripe/cjs/stripe.core.js` path is NOT in the exports map and crashes
// at runtime with ERR_PACKAGE_PATH_NOT_EXPORTED.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Stripe = require('stripe');
// Types live in the inner module — this import is type-only so TS erases
// it at emit time. The path resolves at compile time only.
import type { Stripe as StripeNS } from 'stripe/cjs/stripe.core.js';

import { AppError } from '../common/app.error';

let _client: StripeNS | null = null;

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string | null;
  proPriceId: string | null;
  appUrl: string;
}

export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  if (!secretKey) {
    throw new AppError(
      'STRIPE_NOT_CONFIGURED',
      503,
      'Billing is disabled on this backend (STRIPE_SECRET_KEY is unset).',
    );
  }
  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    proPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || null,
    appUrl: process.env.APP_URL || 'http://localhost:5173',
  };
}

export function getStripe(): StripeNS {
  if (_client) return _client;
  const cfg = getStripeConfig();
  _client = new Stripe(cfg.secretKey, {
    // Pinned API version so Stripe never silently upgrades us between
    // deploys. Cast through unknown because the namespace doesn't surface
    // the ApiVersion union under this import path.
    apiVersion: '2024-11-20.acacia' as unknown as never,
    typescript: true,
  });
  return _client;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
