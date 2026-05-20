import { z } from 'zod';

// ─────────────────────────────────────────────────────────
// Auth & registration
// ─────────────────────────────────────────────────────────

export const RegisterInput = z.object({
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(1).max(120),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Used to create / identify a Device record on the backend.
  device: z.object({
    label: z.string().min(1).max(120),
    platform: z.enum(['macos', 'windows', 'linux']),
    appVersion: z.string().min(1).max(40),
  }).optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const LoginOutput = z.object({
  sessionId: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
  }),
  device: z.object({
    id: z.string().uuid(),
    label: z.string(),
  }).optional(),
});
export type LoginOutput = z.infer<typeof LoginOutput>;

export const TeamSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
});

export const DeviceSummary = z.object({
  id: z.string().uuid(),
  label: z.string(),
  platform: z.enum(['macos', 'windows', 'linux']),
  appVersion: z.string(),
  lastSeenAt: z.string().datetime(),
  current: z.boolean(),
});

export const MeOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  teams: z.array(TeamSummary),
  devices: z.array(DeviceSummary),
});
export type MeOutput = z.infer<typeof MeOutput>;
