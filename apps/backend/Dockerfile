# Multi-stage build for the Volt backend.
# Same pattern as Masa: monorepo-aware, only ships what's needed.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ─────────────────────────────────────────────────────────
# Stage 1 — install all deps (cached on lockfile)
# ─────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────
# Stage 2 — build
# ─────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm --filter @volt/db generate
RUN pnpm --filter @volt/backend build

# ─────────────────────────────────────────────────────────
# Stage 3 — runtime (slim image)
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /app

# Copy lockfile and workspace meta
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Production-only deps
RUN pnpm install --frozen-lockfile --prod

# Copy generated Prisma client + built backend
COPY --from=build /app/packages/db/node_modules/@prisma ./packages/db/node_modules/@prisma
COPY --from=build /app/packages/db/src ./packages/db/src
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/apps/backend/dist ./apps/backend/dist

ENV NODE_ENV=production
EXPOSE 4000

# Bind to 0.0.0.0 inside container so reverse proxy can reach it
CMD ["node", "apps/backend/dist/main.js"]
