# Volt

A fast, local-first API client. The Postman alternative that doesn't slow down your laptop.

## What's in this repo

```
volt/
├── apps/
│   ├── desktop/        # Electron + React app — the product
│   └── backend/        # NestJS — sync server (optional for users; required for teams)
├── packages/
│   ├── shared/         # Zod schemas, IPC contracts, sync types
│   └── db/             # Prisma client for backend (Postgres)
├── nginx/              # Production reverse proxy config
├── scripts/            # Server setup, TLS, backups
└── docs/               # Stage 1-5 planning documents
```

The desktop app has its own SQLite schema (Drizzle ORM) bundled within `apps/desktop/electron/core/db/`. The backend has its own Postgres schema in `packages/db/`.

## Quick start (dev)

```bash
# 1) Install
pnpm install

# 2) Start Postgres (for the sync backend)
docker compose -f docker-compose.dev.yml up -d

# 3) Run backend migrations + seed
cp .env.example .env
pnpm db:generate:backend
pnpm db:migrate:backend
pnpm db:seed:backend

# 4) Start backend (port 4000) and desktop app (Electron window opens)
pnpm dev
```

You can use the desktop app **without** running the backend — local-first means everything works offline. The backend is only needed for account sync and teams.

## Demo account (created by seed)

After running the backend seed:

- Email: `demo@volt.test`
- Password: `volt-demo-1234`

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run desktop + backend in parallel |
| `pnpm dev:desktop` | Just the Electron app (fully usable without backend) |
| `pnpm dev:backend` | Just the backend |
| `pnpm typecheck` | TypeScript check across all workspaces |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm test` | Run all tests |
| `pnpm build` | Production builds |
| `pnpm build:desktop -- --mac` | Build signed macOS .dmg (cert required) |
| `pnpm build:desktop -- --win` | Build Windows .exe |
| `pnpm build:desktop -- --linux` | Build AppImage + .deb |

## Architecture overview

Volt is **offline-first**. Your SQLite file at `~/Library/Application Support/Volt/volt.db` (or platform equivalent) is the source of truth. The backend is a mirror that other devices and teammates pull from. Last-write-wins sync with visible conflict resolution: nothing is silently lost.

See `docs/02-tech-stack.md` for the full architecture and `docs/03-roadmap.md` for the build plan.

## License

Proprietary. Source-available for transparency, not for redistribution. See `LICENSE` for terms.
