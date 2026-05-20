# Volt — Architecture

A bird's-eye view for someone landing in the repo for the first time. Read top-down; each section is roughly 5 minutes.

## Monorepo layout

```
volt/
├── apps/
│   ├── backend/         NestJS API: auth, teams, workspaces, sync (Postgres)
│   └── desktop/         Electron app: main process + renderer
├── packages/
│   ├── shared/          Zod schemas + IPC contracts + shared types
│   └── db/              Prisma schema + generated client + migrations
├── docs/                Stage 1-5 planning + release prep + privacy policy
├── scripts/             VPS provisioning + backup/restore
└── .github/workflows/   CI + release + deploy
```

## Data flow at a glance

```
┌────────────────────────┐      ┌───────────────────────┐      ┌──────────────────┐
│  Desktop renderer      │      │  Electron main        │      │  Backend (VPS)   │
│  (React + TanStack Q)  │      │  (sync + DB + IPC)    │      │  (NestJS + PG)   │
│                        │      │                       │      │                  │
│   useRequests()        │ IPC  │  apiRequest:list      │      │                  │
│   ──────────────────►  │─────►│  ──────────────────►  │      │                  │
│                        │      │     SQLite (local)    │      │                  │
│                        │      │                       │      │                  │
│                        │      │  sync push (5s)       │ HTTP │   /sync/push     │
│                        │      │  ───────────────────► │─────►│  advisory lock + │
│                        │      │                       │      │  apply changes   │
│                        │      │  ◄─────────────────── │ SSE  │   /sync/stream   │
│                        │      │  data:changed event   │◄─────│  broadcast       │
│                        │ event│                       │      │                  │
│   ◄──────────────────  │◄─────│  query invalidate     │      │                  │
└────────────────────────┘      └───────────────────────┘      └──────────────────┘
```

Three boundaries:

1. **Renderer ↔ Main**: typed IPC channels declared in `packages/shared/src/ipc/contracts.ts`. Renderer never touches the network or filesystem directly.

2. **Main ↔ Backend**: HTTPS + SSE. The sync engine in main process is the only thing that talks to the backend; all other requests (renderer → backend) go through it.

3. **Backend ↔ Postgres**: Prisma + advisory locks per workspace to serialize concurrent pushes.

## Key design choices

These are decisions worth knowing about before touching the code:

- **No CRDT.** Sync is last-write-wins with a visible conflict log. Justification in `docs/02-tech-stack.md`.
- **No Redis.** Single-instance backend, SSE held in-memory. Scaling past one instance is post-MVP.
- **No telemetry.** Not now, not silently. See `docs/PRIVACY.md`.
- **SQLite locally, Postgres remotely.** The local schema mirrors the backend schema with `dirty` and `remoteRevision` columns added.
- **Variables resolved in renderer.** The backend never sees `{{variable}}` placeholders — we substitute before sending so the backend doesn't need to know about variable scopes.
- **History never syncs.** Privacy promise. Cloud sync covers definitions (collections, requests, envs), not execution data.

## Where to start as a new contributor

| If you want to…                          | Start with…                                           |
| ---------------------------------------- | ----------------------------------------------------- |
| Understand the product                   | `docs/01-product-brief.md`                            |
| Add a new IPC channel                    | `packages/shared/src/ipc/contracts.ts`                |
| Add a new request body type              | `packages/shared/src/schemas/request.ts` + `electron/core/http/engine.ts` |
| Modify the sync protocol                 | `apps/backend/src/sync/sync.service.ts`               |
| Add a new import format                  | `electron/core/import/` (start by copying `curl.ts`)  |
| Add a UI screen                          | `apps/desktop/src/pages/` + hook into `App.tsx`       |
| Modify keyboard shortcuts                | `apps/desktop/src/App.tsx` + `useHotkey.ts`           |
| Change build / signing                   | `.github/workflows/release.yml`                       |
| Adjust pricing or telemetry stance       | `docs/05-release-prep.md`                             |

## Common gotchas

- **better-sqlite3 native module**: must be rebuilt for each platform. CI handles this; for local dev on Apple Silicon, `pnpm rebuild better-sqlite3` after install.
- **CodeMirror in Electron**: needs `'unsafe-eval'` only in dev. Production CSP works without it.
- **Lucia 3 session cookies**: rely on `secure: production`. In dev HTTP, set `NODE_ENV=development` so cookies don't get dropped.
- **macOS notarization**: takes 2-15 minutes server-side at Apple. The release workflow waits for it; budget accordingly when planning a release.
- **EventSource not native in Node**: we parse SSE manually in `electron/core/sync/engine.ts` with `fetch` + `ReadableStream`.

## What's deferred to v1.1+

Listed in `docs/03-roadmap.md`. The big ones:

- GraphQL + WebSocket + gRPC support
- Pre-request / test scripts (JS sandbox)
- Mock server
- API documentation generator from collections
- Multiple backend instances (Redis pub/sub for SSE)
- Beta channel for desktop updates
- Stripe billing for teams plan
