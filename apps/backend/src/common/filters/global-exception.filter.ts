import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { Prisma } from '@volt/db';
import type { Request, Response } from 'express';

import { AppError } from '../app.error';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body, extra } = this.toResponse(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // For conflict responses, attach extra fields at the top level
    // so the client can read currentRevision without nesting.
    if (extra) {
      response.status(status).json({ ...body, ...extra });
    } else {
      response.status(status).json(body);
    }
  }

  private toResponse(
    exception: unknown,
  ): { status: number; body: ErrorBody; extra?: Record<string, unknown> } {
    if (exception instanceof ZodError) {
      return {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input.',
            details: exception.errors,
          },
        },
      };
    }

    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: { error: { code: exception.code, message: exception.message } },
        extra: exception.extra,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        return {
          status: 404,
          body: { error: { code: 'NOT_FOUND', message: 'Resource not found.' } },
        };
      }
      if (exception.code === 'P2002') {
        return {
          status: 409,
          body: {
            error: {
              code: 'DUPLICATE',
              message: 'Resource already exists.',
              details: exception.meta,
            },
          },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : (resp as { message?: string }).message ?? exception.message;
      return {
        status,
        body: { error: { code: `HTTP_${status}`, message } },
      };
    }

    return {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } },
    };
  }
}
