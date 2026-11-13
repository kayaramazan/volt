"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrpcContext = createTrpcContext;
exports.requireAuth = requireAuth;
const cookie_1 = require("cookie");
const lucia_1 = require("../auth/lucia");
const app_error_1 = require("../common/app.error");
async function createTrpcContext(req, res) {
    const sessionId = extractSession(req);
    if (!sessionId) {
        return { req, res, user: null, sessionId: null, deviceId: null };
    }
    const { session, user } = await lucia_1.lucia.validateSession(sessionId);
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
function requireAuth(ctx) {
    if (!ctx.user) {
        throw new app_error_1.AppError('SESSION_EXPIRED', 401);
    }
}
function extractSession(req) {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = (0, cookie_1.parse)(cookieHeader);
        if (cookies['volt_session'])
            return cookies['volt_session'];
    }
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7).trim();
    return null;
}
//# sourceMappingURL=context.js.map