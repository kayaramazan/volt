import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ── Team-scoped endpoints (auth required) ────────────────────────────
  @Get('teams/:id/billing')
  @UseGuards(SessionGuard)
  async getStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) teamId: string,
  ) {
    return this.billing.getStatus(user.id, teamId);
  }

  @Post('teams/:id/billing/checkout')
  @UseGuards(SessionGuard)
  async checkout(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) teamId: string,
  ) {
    return this.billing.createCheckoutSession(user.id, teamId, user.email);
  }

  @Post('teams/:id/billing/portal')
  @UseGuards(SessionGuard)
  async portal(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) teamId: string,
  ) {
    return this.billing.createPortalSession(user.id, teamId);
  }

  // ── Stripe webhook (no auth — signature-verified) ────────────────────
  // This route deliberately uses the raw request body (configured in
  // main.ts) so Stripe's signature check works. JSON parsing is done by
  // the SDK inside `verifyWebhook`.
  @Post('webhooks/stripe')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
    @Body() _body: unknown,
  ) {
    const raw = req.rawBody;
    if (!raw) {
      // Raw-body middleware not active.
      return { received: false, error: 'raw body unavailable' };
    }
    const event = this.billing.verifyWebhook(raw, signature);
    await this.billing.handleEvent(event);
    return { received: true };
  }
}
