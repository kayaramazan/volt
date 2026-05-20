import { Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import { prisma } from '@volt/db';
import type {
  ChangePasswordInput,
  LoginInput,
  MeOutput,
  RegisterInput,
} from '@volt/shared';

import { AppError } from '../common/app.error';
import { lucia } from './lucia';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface FailedAttempt {
  count: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly failedAttempts = new Map<string, FailedAttempt>();

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError('EMAIL_TAKEN', 409);

    const passwordHash = await argon2.hash(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });

    return { userId: user.id };
  }

  /**
   * Login with optional device info. If `device` is provided, a Device row is
   * upserted (matched by userId + label) and the session is bound to it.
   */
  async login(input: LoginInput) {
    const key = input.email.toLowerCase();
    const failure = this.failedAttempts.get(key);
    if (failure?.lockedUntil && failure.lockedUntil > Date.now()) {
      const seconds = Math.ceil((failure.lockedUntil - Date.now()) / 1000);
      throw new AppError(
        'ACCOUNT_LOCKED',
        429,
        `Too many failed attempts. Try again in ${seconds} seconds.`,
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: input.email, active: true },
    });
    if (!user) {
      this.recordFailure(key);
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      this.recordFailure(key);
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    this.failedAttempts.delete(key);

    let deviceId: string | null = null;
    if (input.device) {
      // Find-or-create device by (userId, label). No composite unique
      // constraint in schema (a user can intentionally have multiple
      // sessions on the "same machine" — different OS users).
      // We match label exactly; if a duplicate exists, the user can revoke
      // either from settings.
      const existing = await prisma.device.findFirst({
        where: { userId: user.id, label: input.device.label },
      });
      const device = existing
        ? await prisma.device.update({
            where: { id: existing.id },
            data: {
              platform: input.device.platform,
              appVersion: input.device.appVersion,
              lastSeenAt: new Date(),
            },
          })
        : await prisma.device.create({
            data: {
              userId: user.id,
              label: input.device.label,
              platform: input.device.platform,
              appVersion: input.device.appVersion,
            },
          });
      deviceId = device.id;
    }

    const session = await lucia.createSession(user.id, { deviceId });
    return { sessionId: session.id, user, deviceId };
  }

  async logout(sessionId: string) {
    await lucia.invalidateSession(sessionId);
  }

  async me(userId: string, currentDeviceId: string | null): Promise<MeOutput> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: { include: { team: true } },
        devices: { orderBy: { lastSeenAt: 'desc' } },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      teams: user.memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
      })),
      devices: user.devices.map((d) => ({
        id: d.id,
        label: d.label,
        platform: d.platform as 'macos' | 'windows' | 'linux',
        appVersion: d.appVersion,
        lastSeenAt: d.lastSeenAt.toISOString(),
        current: d.id === currentDeviceId,
      })),
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 401, 'Current password is wrong.');

    const newHash = await argon2.hash(input.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    await lucia.invalidateUserSessions(userId);
  }

  async revokeDevice(userId: string, deviceId: string) {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new AppError('NOT_TEAM_MEMBER', 404, 'Device not found.');

    // Invalidate all sessions bound to this device
    await prisma.session.deleteMany({ where: { deviceId } });
    await prisma.device.delete({ where: { id: deviceId } });
  }

  private recordFailure(key: string) {
    const current = this.failedAttempts.get(key) ?? { count: 0 };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_MS;
      this.logger.warn(`Account locked: ${key}`);
    }
    this.failedAttempts.set(key, current);
  }
}
