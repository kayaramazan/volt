# Volt

A fast, local-first API client. The Postman alternative that doesn't slow down your laptop.

## What's in this repo

```
volt/
├── apps/
│   ├── desktop/        # Electron + React app — the product
│   ├── cli/            # `volt` CLI — send saved requests from the terminal
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
pnpm install
pnpm --filter @volt/shared build
pnpm dev:desktop          # Electron window opens — no backend needed
```

To also run the sync backend (accounts, cross-device sync, teams):

```bash
docker compose up -d                      # Postgres on :5432
cp .env.example packages/db/.env
cp .env.example apps/backend/.env
pnpm db:generate:backend
pnpm db:migrate:backend
pnpm db:seed:backend
pnpm dev                                  # backend (port 4000) + desktop
```

Full instructions — prerequisites, CLI, installers, the macOS widget, environment variables, deployment, troubleshooting — are in **[docs/SETUP.md](docs/SETUP.md)**.

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
| `pnpm volt <command>` | Run the CLI (`pnpm volt --help`) |
| `pnpm --filter @volt/desktop build:mac` | Build macOS .dmg (includes the Quick Run widget when signed) |
| `pnpm --filter @volt/desktop build:win` | Build Windows .exe |
| `pnpm --filter @volt/desktop build:linux` | Build AppImage + .deb |

## Architecture overview

Volt is **offline-first**. Your local SQLite file (`volt.db` in the app's user-data directory) is the source of truth. The backend is a mirror that other devices and teammates pull from. Last-write-wins sync with visible conflict resolution: nothing is silently lost.

See `docs/SETUP.md` to get running, `docs/02-tech-stack.md` for the full architecture and `docs/03-roadmap.md` for the build plan.

## License

Proprietary. Source-available for transparency, not for redistribution.
