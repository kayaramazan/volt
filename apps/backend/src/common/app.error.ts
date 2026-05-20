import { ERROR_MESSAGES_EN, type ErrorCode } from '@volt/shared';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number = 400,
    message?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message ?? ERROR_MESSAGES_EN[code] ?? code);
    this.name = 'AppError';
  }
}
