import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { parse as parseCookie } from 'cookie';
import type { Request } from 'express';
import { prisma } from '@volt/db';

import { lucia } from './lucia';
import type { RequestWithUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const sessionId = extractSessionId(request);

    if (!sessionId) {
      throw new UnauthorizedException('No session.');
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session || !user) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    if (!user.active) {
      throw new UnauthorizedException('Account disabled.');
    }

    request.sessionId = session.id;
    request.deviceId = session.deviceId ?? undefined;
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    // Bump device lastSeen — best-effort, no await
    if (session.deviceId) {
      prisma.device
        .update({
          where: { id: session.deviceId },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {
          /* device might have been revoked between guard check & update */
        });
    }

    return true;
  }
}

function extractSessionId(request: Request): string | null {
  // 1) Cookie (web / browser-based clients)
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    const fromCookie = cookies['volt_session'];
    if (fromCookie) return fromCookie;
  }

  // 2) Authorization: Bearer (desktop)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 3) Query string ?token=... (for SSE, where browsers don't send custom headers)
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (token) return token;

  return null;
}
