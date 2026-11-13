# Volt — Setup Guide

How to get Volt running from a fresh clone: the desktop app, the optional sync backend, the CLI, and release builds.

- [1. Prerequisites](#1-prerequisites)
- [2. Clone and install](#2-clone-and-install)
- [3. Run the desktop app](#3-run-the-desktop-app)
- [4. Run the sync backend (optional)](#4-run-the-sync-backend-optional)
- [5. CLI](#5-cli)
- [6. Tests, typecheck, lint](#6-tests-typecheck-lint)
- [7. Building installers](#7-building-installers)
- [8. Environment variables](#8-environment-variables)
- [9. Deployment and CI](#9-deployment-and-ci)
- [10. Troubleshooting](#10-troubleshooting)

## 1. Prerequisites

| Tool | Version | Needed for |
|------|---------|------------|
| Node.js | 20 or newer (`.nvmrc` pins 20) | everything |
| pnpm | 9 (`corepack enable` picks up the pinned version) | everything |
| C/C++ toolchain + Python 3 | any recent | compiling `better-sqlite3`, `keytar`, `argon2` |
| Docker | any recent | Postgres for the sync backend only |
| Xcode 16+ (macOS 15 SDK) | — | macOS release builds with the Quick Run widget only |

Native toolchain per platform:

- **macOS** — `xcode-select --install`
- **Linux (Debian/Ubuntu)** — `sudo apt-get install -y build-essential python3 libsecret-1-dev libxss1`
- **Windows** — Visual Studio Build Tools with the "Desktop development with C++" workload

## 2. Clone and install

```bash
git clone https://github.com/kayaramazan/volt.git
cd volt
corepack enable        # or: npm i -g pnpm@9
pnpm install
```

`pnpm install` runs the desktop app's `postinstall`, which rebuilds `better-sqlite3` and `keytar` against Electron's Node ABI. If it fails, fix the native toolchain (section 1) and re-run.

Workspace layout:

```
apps/desktop     Electron + React app (SQLite via Drizzle)
apps/backend     NestJS sync server (Postgres via Prisma)
apps/cli         `volt` CLI — sends saved requests from the desktop's volt.db
packages/shared  Zod schemas, IPC contracts, sync types
packages/db      Prisma schema, migrations, seed
```

## 3. Run the desktop app

The desktop app is fully usable on its own — no backend, no Docker, no `.env`.

```bash
pnpm --filter @volt/shared build   # first run only: typecheck and tooling resolve the compiled package
pnpm dev:desktop
```

Vite starts on `http://localhost:5173` and an Electron window opens. Local data lives in the Electron `userData` directory (`volt.db` plus plugins and local storage):

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/@volt/desktop/` |
| Windows | `%APPDATA%\@volt\desktop\` |
| Linux | `~/.config/@volt/desktop/` |

### Running dev next to an installed Volt

The app takes a single-instance lock on its `userData` directory. If an installed Volt is already open, `pnpm dev:desktop` **exits silently with code 0**. Point the dev build at its own directory:

```bash
VOLT_USER_DATA_DIR="$HOME/Library/Application Support/@volt/desktop-dev" pnpm dev:desktop
```

## 4. Run the sync backend (optional)

Only needed for accounts, cross-device sync, and teams.

```bash
# 1) Postgres 16 on localhost:5432
docker compose up -d

# 2) Env files — Prisma reads .env from the package it runs in
cp .env.example packages/db/.env
cp .env.example apps/backend/.env

# 3) Prisma client, schema, demo data
pnpm db:generate:backend
pnpm db:migrate:backend
pnpm db:seed:backend

# 4) Start
pnpm dev:backend        # API on http://localhost:4000
# or both together:
pnpm dev                # backend + desktop in parallel
```

Check it: `curl http://localhost:4000/api/health`.

The seed creates a demo account — email `demo@volt.test`, password `volt-demo-1234`. An unpackaged desktop build talks to `http://localhost:4000` by default; set `VITE_API_URL` to point it elsewhere.

## 5. CLI

The CLI reads the same `volt.db` the desktop app writes, so run the desktop app at least once first.

```bash
pnpm volt list workspaces
pnpm volt list requests --workspace Personal
pnpm volt send Personal/auth/login
pnpm volt send 'auth/login' --env Staging --json
pnpm volt --help
```

The CLI looks for `<app data>/Volt/volt.db` by default. If your database is elsewhere (dev builds use `@volt/desktop`, see section 3), point at it explicitly:

```bash
VOLT_DB="$HOME/Library/Application Support/@volt/desktop/volt.db" pnpm volt list workspaces
```

Exit codes: `0` 2xx response, `1` HTTP or network error, `2` usage/setup error. To get a standalone binary: `pnpm build:cli`, then `node apps/cli/dist/index.js`.

## 6. Tests, typecheck, lint

```bash
pnpm typecheck    # all workspaces
pnpm lint
pnpm test         # backend tests need Postgres up and migrations applied
```

Backend tests run against the database in `DATABASE_URL`. CI uses a separate `volt_test` database; do the same locally if you care about your dev data.

## 7. Building installers

Run these from `apps/desktop` (or prefix with `pnpm --filter @volt/desktop`). Output lands in `apps/desktop/release/<version>/`.

| Command | Result |
|---------|--------|
| `pnpm build:mac` | Universal `.dmg` (builds the widget first) |
| `pnpm build:win` | NSIS `.exe` (x64) |
| `pnpm build:linux` | AppImage + `.deb` |

Unsigned local builds work: set `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip code signing.

### macOS Quick Run widget

`build:mac` runs `scripts/build-widget.sh` (needs Xcode) to compile the WidgetKit extension in `native/VoltWidget`, and the `afterSign` hook `scripts/embed-widget.cjs` embeds and signs it inside `Volt.app`.

The widget shares data with the app through an App Group that is bound to an Apple Developer Team ID. The ID is hard-coded in four places that must agree:

- `apps/desktop/scripts/embed-widget.cjs` (`TEAM_ID`)
- `apps/desktop/native/VoltWidget/VoltWidget.entitlements` (App Group prefix)
- `apps/desktop/native/VoltWidget/Sources/Snapshot.swift` (`appGroup`)
- `apps/desktop/electron/core/widget/bridge.ts` (`APP_GROUP`)

If the app is unsigned or signed by a different team, the hook logs a warning and **skips the widget** — the build still succeeds, just without it. To ship the widget under your own team, change the ID in all four places.

### Signing and notarization

Release signing uses the standard electron-builder variables: `CSC_LINK`, `CSC_KEY_PASSWORD`, and for notarization `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. See [05-release-prep.md](05-release-prep.md) for certificates and costs.

## 8. Environment variables

**Backend** (`apps/backend/.env`, `packages/db/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — (required) | Postgres connection string |
| `SESSION_SECRET` | — | Session signing secret; use 32+ random chars in production |
| `PORT` | `4000` | API port |
| `NODE_ENV` | — | `development` / `production` |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `STRIPE_SECRET_KEY` | unset | Enables billing when set |
| `STRIPE_WEBHOOK_SECRET` | unset | Verifies `/api/webhooks/stripe` |
| `STRIPE_PRICE_PRO_MONTHLY` | unset | Stripe price ID for the Pro plan |
| `APP_URL` | `http://localhost:5173` | Base URL for billing redirects |

**Desktop**

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` / `VOLT_API_URL` | `http://localhost:4000` in dev, `https://api.volt.dev` packaged | Sync API base URL |
| `VOLT_USER_DATA_DIR` | Electron default | Override the `userData` directory |

**CLI**

| Variable | Purpose |
|----------|---------|
| `VOLT_DB` | Full path to `volt.db` |
| `VOLT_USER_DATA` | Directory containing `volt.db` |
| `VOLT_DEBUG` | Print stack traces on errors |

Never commit `.env` files — they are git-ignored; `.env.example` is the template.

## 9. Deployment and CI

Three GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | PRs and pushes to `main` | Typecheck, lint, backend tests, desktop build on all three OSes, 1 MB gzip bundle budget |
| `deploy.yml` | Pushes to `main` touching `apps/backend`, `packages/shared`, `packages/db`, or `docker-compose.prod.yml` | Builds the backend image, pushes to GHCR, deploys to the VPS over SSH |
| `release.yml` | Tags matching `v*.*.*` | Builds signed installers and attaches them to a draft GitHub Release |

**Merging backend changes to `main` deploys to production.** The deploy needs these repository secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_DOMAIN`, `GHCR_USER`, `GHCR_TOKEN`. The release workflow needs `MAC_CERTIFICATE_BASE64`, `MAC_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CERTIFICATE_BASE64`, `WIN_CERTIFICATE_PASSWORD`.

Server provisioning (`scripts/setup-server.sh`, `scripts/init-tls.sh`, backups) and the production `.env` are covered in [05-release-prep.md](05-release-prep.md). The production stack is `docker-compose.prod.yml`: nginx, certbot, backend, Postgres, nightly backups.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `pnpm dev:desktop` exits immediately, no error | Another Volt instance holds the single-instance lock. Quit it or set `VOLT_USER_DATA_DIR` (section 3). |
| `NODE_MODULE_VERSION` mismatch for `better-sqlite3` or `keytar` | Native modules were built for the wrong ABI. Run `pnpm --filter @volt/desktop exec electron-rebuild -f -w better-sqlite3,keytar`. |
| CLI fails with the same `NODE_MODULE_VERSION` error | The CLI runs on system Node, the desktop on Electron's. Run `pnpm --filter @volt/cli rebuild better-sqlite3`. |
| `Cannot find module '@volt/shared'` or `@volt/db` | Build them: `pnpm --filter @volt/shared --filter @volt/db build`. |
| `@prisma/client did not initialize yet` | Run `pnpm db:generate:backend`. |
| Backend: `Environment variable not found: DATABASE_URL` | `.env` is missing from `apps/backend/` or `packages/db/` (section 4). |
| Backend: `Can't reach database server at localhost:5432` | `docker compose up -d`, then check `docker compose ps` shows the container healthy. |
| `keytar` fails to build on Linux | Install `libsecret-1-dev`. |
| CLI: "no database found" | Run the desktop app once, or set `VOLT_DB` (section 5). |
| macOS build logs "skipping widget" | The app is unsigned or signed by a different team than the widget's App Group (section 7). |
