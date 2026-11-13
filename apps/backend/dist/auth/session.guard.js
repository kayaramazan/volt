"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionGuard = void 0;
const common_1 = require("@nestjs/common");
const cookie_1 = require("cookie");
const db_1 = require("@volt/db");
const lucia_1 = require("./lucia");
let SessionGuard = class SessionGuard {
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const sessionId = extractSessionId(request);
        if (!sessionId) {
            throw new common_1.UnauthorizedException('No session.');
        }
        const { session, user } = await lucia_1.lucia.validateSession(sessionId);
        if (!session || !user) {
            throw new common_1.UnauthorizedException('Invalid or expired session.');
        }
        if (!user.active) {
            throw new common_1.UnauthorizedException('Account disabled.');
        }
        request.sessionId = session.id;
        request.deviceId = session.deviceId ?? undefined;
        request.user = {
            id: user.id,
            email: user.email,
            name: user.name,
        };
        // Bump device lastSeen — best-effort, no await
        if (session.deviceId) {
            db_1.prisma.device
                .update({
                where: { id: session.deviceId },
                data: { lastSeenAt: new Date() },
            })
                .catch(() => {
                /* device might have been revoked between guard check & update */
            });
        }
        return true;
    }
};
exports.SessionGuard = SessionGuard;
exports.SessionGuard = SessionGuard = __decorate([
    (0, common_1.Injectable)()
], SessionGuard);
function extractSessionId(request) {
    // 1) Cookie (web / browser-based clients)
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
        const cookies = (0, cookie_1.parse)(cookieHeader);
        const fromCookie = cookies['volt_session'];
        if (fromCookie)
            return fromCookie;
    }
    // 2) Authorization: Bearer (desktop)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }
    // 3) Query string ?token=... (for SSE, where browsers don't send custom headers)
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token)
        return token;
    return null;
}
//# sourceMappingURL=session.guard.js.map