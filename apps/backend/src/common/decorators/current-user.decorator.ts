import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
  sessionId?: string;
  deviceId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error('CurrentUser decorator used without SessionGuard.');
    }
    return request.user;
  },
);
