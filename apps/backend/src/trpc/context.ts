import type { Request, Response } from 'express';
import { parse as parseCookie } from 'cookie';
import { lucia } from '../auth/lucia';
import { AppError } from '../common/app.error';

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: string; email: string; name: string } | null;
  sessionId: string | null;
  deviceId: string | null;
}

export async function createTrpcContext(
  req: Request,
  res: Response,
): Promise<TrpcContext> {
  const sessionId = extractSession(req);
  if (!sessionId) {
    return { req, res, user: null, sessionId: null, deviceId: null };
  }
  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) {
    return { req, res, user: null, sessionId: null, deviceId: null };
  }
  return {
    req,
    res,
    user: { id: user.id, email: user.email, name: user.name },
    sessionId: session.id,
    deviceId: session.deviceId ?? null,
  };
}

export function requireAuth(ctx: TrpcContext): asserts ctx is TrpcContext & {
  user: { id: string; email: string; name: string };
} {
  if (!ctx.user) {
    throw new AppError('SESSION_EXPIRED', 401);
  }
}

function extractSession(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    if (cookies['volt_session']) return cookies['volt_session'];
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}
