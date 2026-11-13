"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lucia = void 0;
const lucia_1 = require("lucia");
const adapter_prisma_1 = require("@lucia-auth/adapter-prisma");
const db_1 = require("@volt/db");
const adapter = new adapter_prisma_1.PrismaAdapter(db_1.prisma.session, db_1.prisma.user);
exports.lucia = new lucia_1.Lucia(adapter, {
    // 30-day sliding expiry; refreshed on every sync request.
    sessionExpiresIn: new lucia_1.TimeSpan(30, 'd'),
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
//# sourceMappingURL=lucia.js.map