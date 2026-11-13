"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const db_1 = require("@volt/db");
const app_error_1 = require("../app.error");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const { status, body, extra } = this.toResponse(exception);
        if (status >= 500) {
            this.logger.error(`${request.method} ${request.url} → ${status}`, exception instanceof Error ? exception.stack : String(exception));
        }
        // For conflict responses, attach extra fields at the top level
        // so the client can read currentRevision without nesting.
        if (extra) {
            response.status(status).json({ ...body, ...extra });
        }
        else {
            response.status(status).json(body);
        }
    }
    toResponse(exception) {
        if (exception instanceof zod_1.ZodError) {
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
        if (exception instanceof app_error_1.AppError) {
            return {
                status: exception.status,
                body: { error: { code: exception.code, message: exception.message } },
                extra: exception.extra,
            };
        }
        if (exception instanceof db_1.Prisma.PrismaClientKnownRequestError) {
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
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const resp = exception.getResponse();
            const message = typeof resp === 'string'
                ? resp
                : resp.message ?? exception.message;
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
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map