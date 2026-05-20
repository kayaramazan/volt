import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { prisma } from '@volt/db';

const adapter = new PrismaAdapter(prisma.session as any, prisma.user as any);

export const lucia = new Lucia(adapter, {
  // 30-day sliding expiry; refreshed on every sync request.
  sessionExpiresIn: new TimeSpan(30, 'd'),
  sessionCookie: {
    name: 'volt_session',
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attrs) => ({
    email: attrs.email,
    name: attrs.name,
    active: attrs.active,
  }),
  getSessionAttributes: (attrs) => ({
    deviceId: attrs.deviceId,
  }),
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      name: string;
      active: boolean;
    };
    DatabaseSessionAttributes: {
      deviceId: string | null;
    };
  }
}
