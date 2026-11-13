"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const shared_1 = require("@volt/shared");
class AppError extends Error {
    code;
    status;
    extra;
    constructor(code, status = 400, message, extra) {
        super(message ?? shared_1.ERROR_MESSAGES_EN[code] ?? code);
        this.code = code;
        this.status = status;
        this.extra = extra;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app.error.js.map