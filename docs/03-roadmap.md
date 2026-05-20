# Roadmap — Volt

> Stage 3 / 5 — Roadmap output
> Previous: `01-product-brief.md`, `02-tech-stack.md`
> Next: `04-codegen/` (generated code)

This document breaks Volt into the sequence in which it will be built. Tickets are ordered by dependency, each is independently testable, and each represents roughly 0.5-2 days of work.

---

## Phase 1 — MVP

**Goal:** A polished, downloadable, free, three-platform API client that an individual developer can fully use offline, and a team of 2-3 can use online with reliable last-write-wins sync. Estimated time: 8-10 weeks for one developer.

**Out of scope for MVP:**
- GraphQL, WebSocket, gRPC request types
- OAuth 2.0 flows (only Bearer/Basic/API key in MVP)
- Pre-request and post-response scripts
- Code generation
- Response diffing
- HAR import (Postman/Insomnia/OpenAPI/cURL only)
- Mock servers
- Paid plans / billing integration

---

### Foundations (week 1-2)

#### INFRA-001 — Monorepo scaffold and dev environment

Set up pnpm workspaces, Turborepo, TypeScript, and `apps/desktop` + `apps/backend` + `packages/shared` + `packages/db`. The desktop app should boot to a blank Electron window with React inside, the backend should respond to `/health`, and both should typecheck cleanly.

**Acceptance criteria:**
- `pnpm install` at root installs all workspaces
- `pnpm dev:desktop` opens an Electron window with a "Hello Volt" React component
- `pnpm dev:backend` starts the backend on port 4000
- `pnpm typecheck` passes everywhere
- `pnpm lint` is configured (ESLint + Prettier)
- `.env.example` files documented per workspace
- README explains setup in <10 minutes

**Affects:** infra

---

#### INFRA-002 — Local database schema and migrations

Build the SQLite schema using Drizzle ORM matching the ER diagram in `02-tech-stack.md`. Migrations are file-based, applied at app startup. Schema includes Workspace, Collection, Request, HistoryEntry, Environment, EnvironmentVariable, CollectionVariable, Team, TeamMember tables.

**Acceptance criteria:**
- Drizzle schema files in `apps/desktop/electron/core/db/schema.ts`
- Migration runner applies pending migrations on app startup (idempotent)
- Database file is created at the OS-appropriate path (`~/Library/Application Support/Volt/volt.db` on macOS, equivalent elsewhere)
- All tables have appropriate indexes for sync queries: `(workspace_id, updated_at)`, `(workspace_id, started_at DESC)` on history
- `dirty` and `remote_revision` columns present on syncable tables
- A test workspace + collection + request can be inserted and retrieved via Drizzle

**Affects:** desktop, infra

---

#### INFRA-003 — Backend Postgres schema and Prisma migrations

Create the Prisma schema for the backend mirror. Includes User, Session (Lucia), Device, Team, TeamMember, TeamInvite, Workspace, Collection, Request, Environment, EnvironmentVariable, CollectionVariable, ConflictLog. Every syncable row has a `revision` integer column. Workspace has a `currentRevision` (monotonic counter).

**Acceptance criteria:**
- Prisma schema in `packages/db/prisma/schema.prisma`
- `pnpm db:migrate` applies migrations to local Postgres
- Seed script creates one test user + one team + one workspace with sample collections
- Composite indexes on `(workspace_id, revision)` for sync queries

**Affects:** backend, infra

---

### Desktop core (week 2-4)

#### DESK-001 — Electron shell with secure IPC bridge

Configure Electron with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in the renderer. Set up the preload script and `contextBridge` to expose a typed `window.volt` API. Define the IPC contract registry using Zod schemas in `packages/shared/src/ipc-contracts.ts`.

**Acceptance criteria:**
- Renderer cannot access `require`, `process`, `__dirname`, or any Node API
- All IPC channels declared in one place; renderer calls go through a typed wrapper
- A "ping" channel demonstrates end-to-end typed IPC
- Vite serves the renderer in dev with HMR
- Electron loads from `localhost:5173` in dev, from `file://` bundled HTML in prod

**Affects:** desktop

---

#### DESK-002 — Workspace layout and routing

Build the main app shell: left sidebar (collections + history tabs), main pane (request editor + response viewer), top bar (environment selector + workspace switcher). Use a single-window, no-modal architecture. Implement basic resizing of panels.

**Acceptance criteria:**
- Three-panel layout: collections tree (left), request/response (center+right)
- Panels resizable with persisted widths
- Top bar with workspace dropdown and environment selector
- Theme: light mode only in MVP (dark mode v1.0)
- No external links open a browser inadvertently (`target="_blank"` is blocked or routed through `shell.openExternal`)

**Affects:** desktop

---

#### DESK-003 — Command palette (Cmd/Ctrl+K)

Universal command palette accessible via keyboard shortcut. Initial commands: "New Request", "Switch Environment", "Find in Collections", "Settings". This is the primary keyboard-first interaction model.

**Acceptance criteria:**
- `Cmd/Ctrl+K` opens the palette from anywhere
- Fuzzy search over command names
- Arrow keys + Enter to select
- Escape closes
- New commands can be registered from any component via a hook
- Renders in <16ms on open (one frame)

**Affects:** desktop

---

### Request execution (week 3-5)

#### DESK-004 — Request editor UI

The center pane: method dropdown (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS), URL bar with variable highlighting, tabs for Params / Headers / Body / Auth. Each tab is its own component.

**Acceptance criteria:**
- All 7 HTTP methods selectable
- URL bar shows `{{variable}}` references highlighted in a different color
- Params tab: key-value rows with enable/disable checkboxes
- Headers tab: same, with autocomplete from common HTTP headers
- Body tab: tabs for None / Raw (JSON, XML, text) / Form / URL-encoded / Binary
- Raw body uses CodeMirror with appropriate syntax highlighting per type
- Auth tab: None / Bearer / Basic / API Key (header or query)
- All edits save to local DB on debounce (500ms)

**Affects:** desktop

---

#### DESK-005 — HTTP execution engine

Build the main-process HTTP engine using undici. Resolves `{{variables}}` against active environment + collection variables before sending. Captures full timing breakdown (DNS, TCP, TLS, TTFB, download). Streams response body. Honors AbortController for cancellation.

**Acceptance criteria:**
- IPC handler `request:send` accepts a fully-resolved request, returns response with timing
- `request:cancel` aborts in-flight request
- Variable substitution: `{{baseUrl}}/{{path}}` resolved using active env, then collection vars override
- Timing breakdown captured: DNS, connect, TLS, TTFB, download phases as separate ms values
- Response body up to 10 MB stored in DB; larger gets "view in temp file" affordance
- Custom error handling: ENOTFOUND, ECONNREFUSED, timeout, TLS errors, malformed responses — all produce human-readable error states with troubleshooting hints

**Affects:** desktop

---

#### DESK-006 — Response viewer

Right pane: status line, response timing summary, tabs for Body / Headers / Cookies / Timing. Body viewer auto-detects content type and applies syntax highlighting. Image/binary responses get preview or "save to file" affordance.

**Acceptance criteria:**
- Status line: HTTP code with color (2xx green, 4xx yellow, 5xx red), reason phrase, response time, size
- Body tab: pretty-print + raw view toggle, syntax highlighting for JSON/XML/HTML/JS/CSS, image preview for `image/*`
- "Save raw response" button always available
- Headers tab: key-value list, copy-to-clipboard per row
- Cookies tab: parsed Set-Cookie, expiration, domain
- Timing tab: waterfall visualization of phase durations
- Body viewer handles 5 MB+ JSON gracefully (virtualized rendering)

**Affects:** desktop

---

### Collections and history (week 4-6)

#### DESK-007 — Collections sidebar (CRUD + nested folders)

Left sidebar shows the collection tree. Right-click context menu for create/rename/delete/duplicate. Drag-and-drop to reorder and reparent. Collections can be nested arbitrarily.

**Acceptance criteria:**
- Tree view with expand/collapse, lazy rendering for large trees
- Right-click menu: New Request, New Folder, Rename, Duplicate, Delete, Export
- Drag-and-drop: reorder within parent, reparent between folders
- Active request highlighted; clicking a request loads it into the editor
- Local DB updates on every action, `dirty` flag set
- Empty state: "Create your first request" CTA

**Affects:** desktop

---

#### DESK-008 — Request history with replay

Every sent request is automatically captured in HistoryEntry. The history pane shows a reverse-chronological list with method, URL, status, timestamp. Clicking an entry shows its full response (without re-sending). "Replay" button re-sends the captured request as a new one.

**Acceptance criteria:**
- Capture happens on every successful or failed send, including ad-hoc requests not tied to a collection
- History list shows last 200 entries; "Load more" fetches older
- Search bar filters by URL or status
- Date grouping: Today, Yesterday, Earlier this week, etc.
- Click entry: opens it as a read-only view in the response pane
- "Replay" button: copies the captured request into a new editable scratchpad request
- "Pin" button: bookmarks for quick re-access
- History entries never sync to backend (privacy: only the user's local DB has request history)

**Affects:** desktop

---

#### DESK-009 — Environments and environment selector

Environments (Dev, Staging, Prod, custom). Each environment holds key-value variables. The active environment is shown in the top bar with a dropdown to switch. Switching is instant; all open requests re-resolve their variables.

**Acceptance criteria:**
- Environment list in settings: create, rename, duplicate, delete, reorder
- Each env has a key-value variable table: add/edit/remove rows, mark as secret
- Secret variables: stored in OS keychain via keytar, displayed as `***`
- Top bar dropdown: switch active environment, "Manage environments..." link
- Variable references in URL/headers/body auto-resolve when active env changes
- Hovering over a `{{variable}}` reference shows its resolved value (or "unresolved" warning)

**Affects:** desktop

---

#### DESK-010 — Collection-scoped variables

Variables defined at the collection level. These override environment variables of the same key when sending a request inside that collection.

**Acceptance criteria:**
- Right-click on a collection → "Variables..." opens an editor
- Same UI as env vars: key, value, secret toggle
- Resolution priority: collection var > environment var (visible in the variable hover tooltip)
- Sync-aware: collection variables included in the sync protocol

**Affects:** desktop

---

### Import (week 5-6)

This is the highest-leverage week of work — failed imports mean failed user acquisition.

#### DESK-011 — Postman v2.1 collection import

Parse a Postman `.json` collection and create the equivalent Volt collection + requests + folders. Handle variables at the collection level. Skip what we can't import (scripts, mock paths) with a clear summary.

**Acceptance criteria:**
- File picker accepts `.json` and recognized via `info.schema` field
- Folders, sub-folders, requests, headers, body (all body types), URL params all imported
- Bearer/Basic/API Key auth: mapped to Volt's auth types
- OAuth: imported as "Bearer" with a note, since OAuth is post-MVP
- Pre-request and test scripts: stored in a `_imported_script` field, ignored at execution (until v1.0 scripting), warning shown
- Postman environment JSON also importable; each becomes a Volt environment
- Summary modal: "Imported 47 requests in 8 folders, 1 environment. 3 requests had scripts (not yet executed)."
- Test corpus: 5+ real-world Postman collections of varying sizes, import succeeds on all without crashes

**Affects:** desktop

---

#### DESK-012 — Insomnia v4 export import

Same flow for Insomnia's export format. Insomnia uses a flat array of records with `_type` discriminators. Map to Volt collections.

**Acceptance criteria:**
- File picker recognizes `_type: 'export'` JSON
- Workspaces become Volt workspaces; request_groups become folders; requests become requests
- Insomnia environments map to Volt environments
- Auth types: Bearer, Basic, API Key map directly; OAuth deferred
- Body types map cleanly
- Test corpus: 3+ Insomnia exports tested without errors

**Affects:** desktop

---

#### DESK-013 — OpenAPI 3.0 import

Parse an OpenAPI spec (JSON or YAML) and generate a collection where each path becomes a folder and each operation becomes a request. Example values from schemas become initial body content.

**Acceptance criteria:**
- File picker accepts `.json`, `.yaml`, `.yml`
- Uses `@apidevtools/swagger-parser` for validation and dereferencing
- Each path becomes a folder (e.g., `/users/{id}` → folder `users/{id}`)
- Each operation (`GET`, `POST` etc on a path) becomes a request named with its operationId or method+summary
- Parameters: query/path/header parameters become Volt params/headers (path params shown as `{id}` to be replaced)
- Request body: example or generated-from-schema JSON populates the body
- Auth: securitySchemes mapped to Bearer/Basic/API Key when possible
- Servers: first server URL becomes a `baseUrl` collection variable
- Test corpus: 3+ OpenAPI specs (Petstore, Stripe-like, GitHub-like) import correctly

**Affects:** desktop

---

#### DESK-014 — cURL paste-as-request

A "Import from cURL" command in the palette (and a paste-detection in the URL bar). Pastes a curl command, parses it, creates a new request with all fields populated.

**Acceptance criteria:**
- Paste detection: if the URL bar contains `curl ` as the first token, offer "Convert to request"
- Parses: method, URL, headers (`-H`), body (`-d`, `--data`, `--data-raw`), cookies, basic auth (`-u`), bearer (`-H "Authorization: Bearer ..."`)
- Supports both single-line and multi-line (with backslash continuation)
- Creates a new request in the current collection or in scratchpad
- Test corpus: 20+ real curl commands from "copy as curl" in browser DevTools, all parse cleanly

**Affects:** desktop

---

### Account, teams, sync (week 6-8)

#### BE-001 — Backend auth: register, login, logout, sessions

Implement Lucia 3 with email + password. POST `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`. argon2id hashing. 5-failed-login lockout (15 min). Session table in Postgres.

**Acceptance criteria:**
- Register: email + password + name, returns 201 + session cookie + sessionId in response body
- Login: returns 200 + session cookie + sessionId
- Logout: invalidates session
- `/auth/me`: returns user + teams + active devices
- argon2id with default Lucia params
- Lockout in-memory (Redis post-MVP)
- Unit tests: 4 success + 4 failure scenarios
- E2E: register → login → me → logout

**Affects:** backend

---

#### BE-002 — Teams: create, invite, join, member roles

Endpoints for team management. A team owner can invite by email, generating a one-time URL-safe code. The invitee accepts the code to join. Roles: OWNER, EDITOR, VIEWER.

**Acceptance criteria:**
- POST `/teams` creates a team with the caller as OWNER
- POST `/teams/:id/invite` (OWNER only) generates an invite with 7-day expiry, optionally emails the recipient
- POST `/teams/invite/:code/accept` (authenticated) adds user as EDITOR (default)
- PATCH `/teams/:id/members/:userId` (OWNER) changes role
- DELETE `/teams/:id/members/:userId` (OWNER) removes member; can't remove last OWNER
- POST `/teams/:id/transfer-ownership` (OWNER) hands off
- E2E test: create team, invite, accept, change role, remove member

**Affects:** backend

---

#### BE-003 — Workspaces (personal + team) and revision counter

Workspace creation. Each workspace has either an ownerUserId (personal) or a teamId (shared). Workspaces have a monotonic `currentRevision` (bigint) that increments on every change to any child row.

**Acceptance criteria:**
- POST `/workspaces` creates personal (default) or team workspace
- GET `/workspaces` returns all personal + all team workspaces the user has access to
- PATCH `/workspaces/:id` renames or moves to team (irreversible without recreation)
- Access control: personal = owner only; team = all team members
- `currentRevision` starts at 0 and increments on every push that applies changes
- DELETE `/workspaces/:id` (owner/team owner) — soft delete with 30-day recovery window

**Affects:** backend

---

#### BE-004 — Sync push endpoint

POST `/sync/push` accepts `{ workspaceId, baseRevision, changes[] }`. Each change is a `{ table, rowId, operation: 'upsert' | 'delete', data }`. Server applies changes if `baseRevision == currentRevision`, otherwise returns 409.

**Acceptance criteria:**
- Validation: caller has access to workspace
- If `baseRevision != currentRevision`: return 409 + `currentRevision` (so client knows to pull)
- If valid: apply each change atomically in a transaction, increment `currentRevision` per change, assign each change a new revision number
- Response: `{ newRevision, applied: [{ rowId, revision }] }`
- Concurrent push (two clients pushing simultaneously): handled via Postgres advisory locks per workspace
- Conflict log: any overwritten row's previous state is saved to `ConflictLog` before being overwritten
- Performance: 100 changes in one push < 200ms p95

**Affects:** backend

---

#### BE-005 — Sync pull endpoint and SSE stream

GET `/sync/pull?workspaceId=X&since=N` returns changes with revision > N. GET `/sync/stream?workspaceId=X` is an SSE endpoint that pushes change events to subscribed clients in real time.

**Acceptance criteria:**
- Pull: returns `{ currentRevision, changes: [...] }`; changes ordered by revision ASC
- Changes include all fields needed to reconstruct the row on the client
- SSE: opens persistent connection, sends `event: change` for each new push to the workspace
- SSE reconnects gracefully on network interruption (browser handles this; backend just needs to support reconnection)
- Auth: SSE auth via session cookie (browser supports), or `?token=` for non-browser clients
- Heartbeat: every 30 sec to keep connection alive through proxies
- One client can subscribe to multiple workspace streams over one connection (multiplexed)

**Affects:** backend

---

#### BE-006 — Conflict log endpoints

Endpoints to view and restore from the conflict log. POST `/sync/conflicts/:id/restore` recreates the overwritten state as a new revision.

**Acceptance criteria:**
- GET `/sync/conflicts?workspaceId=X` lists conflicts in last 30 days
- Each entry: rowId, table, overwrittenAt, overwrittenBy (user), previousState (snapshot)
- POST `/sync/conflicts/:id/restore`: applies previousState as a new change (increments revision, dirty for other clients to pull)
- Conflicts older than 30 days are purged by a cron (BE-009)
- Test: simulate concurrent edit → verify conflict logged → restore → verify state matches original

**Affects:** backend

---

#### DESK-015 — Desktop auth: login UI and keychain storage

Native panel in the app for email + password login. On success, session token stored in OS keychain via `keytar`. App enters "synced" mode and starts the sync engine.

**Acceptance criteria:**
- Settings → Account: shows current account email or "Sign in / Create account"
- Sign-in panel: email, password, "Forgot password" (post-MVP placeholder), "Create account"
- Session token written to keychain (`service: 'Volt'`, `account: <email>`)
- On app launch: read token from keychain, call `/auth/me` to validate, set "logged in" state
- Logout: clear keychain, clear sync state, all workspaces revert to "local only"
- Failed login: clear error message, no token persisted

**Affects:** desktop

---

#### DESK-016 — Desktop sync engine

The core sync loop. Watches local DB for `dirty` rows, batches them, pushes. Pulls via 30s polling + SSE. Handles 409 conflicts by pulling first then re-pushing.

**Acceptance criteria:**
- Sync engine runs in main process, started 2 sec after window appears (not blocking startup)
- Push: every 5 sec if `dirty` rows exist (debounced)
- Pull: every 30 sec via REST; also subscribes to SSE for real-time push
- Conflict handling: on 409, pull first → identify overwritten rows → write to local "overwritten" log → re-push remaining changes
- Local UI shows sync status: "Synced", "Syncing...", "Offline", "Conflict"
- When offline: queue changes locally, retry on reconnect
- Test: two-instance scenario — instance A and B both edit same request offline → A syncs first → B sees conflict banner

**Affects:** desktop

---

#### DESK-017 — Conflict UI

When the sync engine pulls a change that overwrites a local dirty change, show a non-modal banner above the affected request. Provide "View overwritten", "Restore mine", "Dismiss" actions.

**Acceptance criteria:**
- Banner appears when a request the user is currently editing was overwritten
- Banner text: "Your edit was overwritten by {user} {N min} ago."
- "View overwritten": opens a diff view showing local change vs server version
- "Restore mine": calls `/sync/conflicts/:id/restore` and dismisses banner
- "Dismiss": hides banner, leaves server version in place
- Multiple conflicts: banner shows "3 of your changes were overwritten. View all."

**Affects:** desktop

---

#### DESK-018 — Team and workspace management UI

A "Teams" page in the app where users create teams, invite teammates, see members, transfer ownership. Workspaces page shows personal + team workspaces with the ability to move a personal workspace to a team.

**Acceptance criteria:**
- Settings → Teams: list of teams, "Create team" button
- Per team: list of members with roles, "Invite" button generates a code/link
- Per team: "Leave team" action for non-owners
- Workspaces page: list of personal + team workspaces with active workspace highlighted
- "Move to team..." dropdown on personal workspace (one-way)
- "New workspace" action

**Affects:** desktop

---

### Distribution and polish (week 8-10)

#### INFRA-004 — Cross-platform build pipeline (electron-builder)

Configure electron-builder for macOS (universal), Windows x64, Linux (deb + AppImage). All three build from one codebase.

**Acceptance criteria:**
- `pnpm build:desktop --mac` produces signed `.dmg` (when running on macOS with cert)
- `pnpm build:desktop --win` produces signed `.exe` installer
- `pnpm build:desktop --linux` produces `.AppImage` and `.deb`
- macOS universal binary (Intel + Apple Silicon in one)
- Build outputs include checksums (SHA-256)
- All three builds complete in under 5 min on a M1 dev machine

**Affects:** infra, desktop

---

#### INFRA-005 — GitHub Actions release workflow

On git tag push (`v0.1.0`), build all three platforms in parallel and publish to GitHub Releases with checksums and signed artifacts.

**Acceptance criteria:**
- Trigger: `git tag v* && git push --tags`
- Three parallel jobs: macOS (with notarization), Windows (with signing), Linux
- Code signing certificates stored as GitHub secrets
- Notarization for macOS via `notarytool` (waits for Apple, ~5 min)
- Artifacts uploaded to release with consistent naming: `Volt-0.1.0-mac-universal.dmg`, `Volt-0.1.0-win-x64.exe`, `Volt-0.1.0-linux-x64.AppImage`, `Volt-0.1.0-linux-x64.deb`
- `latest.yml` / `latest-mac.yml` / `latest-linux.yml` for electron-updater discovery
- Total wall time < 20 min

**Affects:** infra

---

#### INFRA-006 — Backend deployment

Same Docker Compose pattern as Masa: backend + Postgres + Nginx + Certbot + nightly backup, deployed to a Hetzner VPS. SSE works through Nginx without buffering.

**Acceptance criteria:**
- `docker-compose.prod.yml` with nginx, backend, postgres, backup services
- nginx config: `proxy_buffering off` and `proxy_cache off` for the SSE endpoint
- Backup: nightly pg_dump → 7-day retention
- TLS via Certbot with auto-renewal
- Deploy via GitHub Actions on `main` push
- Backend image hosted on GitHub Container Registry

**Affects:** infra, backend

---

#### DESK-019 — Auto-update

electron-updater configured to check GitHub Releases. Background download, prompt on next launch.

**Acceptance criteria:**
- App checks for updates 5 min after launch, then every 4 hours
- Background download with progress (visible in settings)
- "Restart to update" prompt on app quit/launch when update ready
- "Check for updates now" button in settings
- Update channel: stable (default); pre-release channel toggleable in settings (post-v0.1)
- Rollback path: documented (downgrade via re-installer); not automated in MVP

**Affects:** desktop, infra

---

#### DESK-020 — Onboarding flow

First-launch experience: a single welcome screen with three options: "Import from Postman/Insomnia/OpenAPI", "Start fresh", "Sign in to your team". The goal is time-to-first-request ≤45 seconds.

**Acceptance criteria:**
- First-launch detection (no local DB or empty DB)
- Welcome screen with the three options
- "Import" path: file picker → preview → import → first request highlighted in collections
- "Start fresh" path: creates a default "My Workspace" with example "GitHub status" request preloaded
- "Sign in" path: login → automatically syncs personal workspace
- Skip-to-app option for impatient users
- Onboarding never blocks: any path opens the editor in <10 sec

**Affects:** desktop

---

#### DESK-021 — Telemetry (opt-in)

Anonymous, opt-in telemetry: app version, OS, cold-start time, weekly active. Never URLs, request bodies, response bodies, account info.

**Acceptance criteria:**
- Default: OFF
- Settings → Privacy: clear toggle with explicit list of what's collected
- Implementation: Plausible self-hosted instance (or Umami) on same VPS
- Cold-start time captured automatically when telemetry is on
- Privacy policy URL clearly visible
- No telemetry batch held more than 24h locally

**Affects:** desktop, backend

---

#### DESK-022 — Marketing website (one-page, static)

A single-page website at `volt.dev` (or chosen domain) with: hero, three key benefits, three platform download buttons, screenshot, FAQ, link to GitHub.

**Acceptance criteria:**
- Static site (Next.js or Astro), deployed to Cloudflare Pages or Vercel free tier
- Download buttons detect OS and recommend the right binary
- Links pull `latest` from GitHub Releases dynamically
- SEO basics: meta tags, sitemap, robots.txt
- Privacy policy and terms hosted on `/privacy` and `/terms`

**Affects:** infra, marketing

---

## Phase 2 — v1.0 (months 3-5 post-launch)

**Goal:** Close the feature gap with Postman for power users, based on feedback from the first 1000+ MVP users.

| ID | Title | Description |
|----|-------|-------------|
| v1-001 | OAuth 2.0 flows | Authorization code with PKCE, client credentials, password grant, device flow, refresh token handling |
| v1-002 | GraphQL request type | Schema introspection, query/variables/headers panes, response viewer formatted for GraphQL errors |
| v1-003 | WebSocket request type | Connect, send text/binary, message log with timestamps, manual reconnect |
| v1-004 | Pre-request and post-response scripts | Postman-compatible JS sandbox using Node `vm`; small curated API (`pm.environment`, `pm.response`, `pm.test`); cookie management; chained requests |
| v1-005 | Code generation | Export request as curl, fetch, axios, node-fetch, Python requests, Go http.Client, Java OkHttp, PHP curl, Ruby Net::HTTP |
| v1-006 | Response diff viewer | Compare two response bodies side-by-side with semantic JSON diff (not just text diff) |
| v1-007 | HAR import | Parse HAR file and create a collection of requests for each entry |
| v1-008 | Export to Postman/Insomnia/OpenAPI | Round-trip: any Volt collection can be exported in the formats we import from |
| v1-009 | Dark mode | Full theme support, respects system preference, manual override |
| v1-010 | Find in collections (fuzzy search) | Cmd/Ctrl+P to search across all requests in all workspaces by name or URL |
| v1-011 | Documentation generation | Generate Markdown docs from a collection for sharing with team |
| v1-012 | Request chaining UI | Visual flow: response of request A feeds variables of request B (uses scripts under the hood) |

---

## Phase 3 — v1.1+ (months 6-12 post-launch)

| ID | Title | Description |
|----|-------|-------------|
| v1.1-001 | gRPC support | .proto import, server reflection, unary + streaming calls |
| v1.1-002 | Mock servers | Local mock: forward requests to predefined responses; export mock config for sharing |
| v1.1-003 | CLI companion | `volt send my-collection/login` for CI use; reads same `volt.db` |
| v1.1-004 | Plugin system | Third-party auth helpers, response transformers, custom panels |
| v1.1-005 | Paid team tier launch | Stripe integration, RBAC, audit log, advanced auth flows, priority support |
| v1.1-006 | SSO (Google Workspace, GitHub, SAML) | Required for enterprise tier readiness |
| v1.1-007 | On-prem deployment package | Self-contained Docker bundle for enterprise teams to host their own backend |
| v1.1-008 | Real-time collaboration cursors | See teammates' cursors when editing the same request live (CRDT-lite) |
| v1.1-009 | Workspace activity feed | "Ahmet edited Login request 3 min ago"; useful for medium+ teams |
| v1.1-010 | Cookie jar across requests | Persistent cookies per workspace, auto-applied to matching domains |

---

```json
{
  "phases": [
    {
      "name": "MVP",
      "goal": "A polished, three-platform free desktop API client with offline-first local storage, team sync via last-write-wins, and import from Postman/Insomnia/OpenAPI/cURL. Estimated 8-10 weeks single developer.",
      "tickets": [
        {"id": "INFRA-001", "title": "Monorepo scaffold and dev environment", "description": "pnpm workspaces, Turborepo, TypeScript, apps/desktop + apps/backend + packages/shared + packages/db scaffolded.", "acceptance_criteria": ["pnpm install installs all workspaces", "pnpm dev:desktop opens Electron window with React", "pnpm dev:backend starts on port 4000", "Typecheck and lint pass everywhere"], "affects": ["infra"]},
        {"id": "INFRA-002", "title": "Local SQLite schema with Drizzle", "description": "Drizzle schema for Workspace, Collection, Request, HistoryEntry, Environment, Variables, Teams.", "acceptance_criteria": ["Schema in apps/desktop/electron/core/db/schema.ts", "Migrations applied on app startup", "DB file at OS-appropriate path", "Indexes on (workspace_id, updated_at), (workspace_id, started_at DESC)", "dirty + remote_revision columns on syncable tables"], "affects": ["desktop", "infra"]},
        {"id": "INFRA-003", "title": "Backend Postgres schema with Prisma", "description": "Prisma schema mirroring local + auth + teams tables, every syncable row has revision integer, workspace has currentRevision counter.", "acceptance_criteria": ["Prisma schema complete", "pnpm db:migrate succeeds", "Seed script creates test user + team + workspace", "Composite indexes on (workspace_id, revision)"], "affects": ["backend", "infra"]},
        {"id": "DESK-001", "title": "Electron shell with secure IPC bridge", "description": "Configure contextIsolation + sandbox + preload script + typed IPC contracts in shared package.", "acceptance_criteria": ["Renderer can't access Node APIs directly", "Typed window.volt API exposed via contextBridge", "Vite + HMR working in dev", "IPC contracts defined with Zod schemas"], "affects": ["desktop"]},
        {"id": "DESK-002", "title": "Workspace layout and resizable panels", "description": "Three-panel layout with persisted widths, top bar with workspace + environment selectors, no modals.", "acceptance_criteria": ["Sidebar | request editor | response viewer", "Panels resizable, widths persisted", "Top bar shows workspace and env", "External links go through shell.openExternal"], "affects": ["desktop"]},
        {"id": "DESK-003", "title": "Command palette (Cmd/Ctrl+K)", "description": "Universal command palette for keyboard-first workflow.", "acceptance_criteria": ["Cmd/Ctrl+K opens palette from anywhere", "Fuzzy search across commands", "Arrow keys + Enter to select, Escape to close", "<16ms render time", "Extensible via hook"], "affects": ["desktop"]},
        {"id": "DESK-004", "title": "Request editor UI", "description": "Method selector, URL bar with variable highlighting, tabs for Params/Headers/Body/Auth.", "acceptance_criteria": ["All 7 HTTP methods", "Variables highlighted in URL", "Params tab with enable/disable", "Headers tab with common-header autocomplete", "Body tab supports raw/form/urlencoded/binary with CodeMirror", "Auth tab: None/Bearer/Basic/API Key", "Edits debounced-saved to local DB"], "affects": ["desktop"]},
        {"id": "DESK-005", "title": "HTTP execution engine via undici", "description": "Variable resolution, timing breakdown, cancellation, streaming response body.", "acceptance_criteria": ["IPC request:send and request:cancel work", "Variable substitution: collection > env", "Timing breakdown: DNS, TCP, TLS, TTFB, download", "Response body up to 10 MB stored", "Human-readable error states for common failures"], "affects": ["desktop"]},
        {"id": "DESK-006", "title": "Response viewer with tabs", "description": "Status line, Body/Headers/Cookies/Timing tabs, syntax highlighting, image preview.", "acceptance_criteria": ["Status line with color-coded HTTP code, time, size", "Pretty/raw toggle, JSON/XML/HTML/JS/CSS syntax", "Image preview for image/*, save-to-file always available", "Cookies tab with parsed Set-Cookie", "Timing waterfall visualization", "Handles 5 MB+ JSON gracefully"], "affects": ["desktop"]},
        {"id": "DESK-007", "title": "Collections sidebar (CRUD + nested folders)", "description": "Tree view, context menu, drag-and-drop reorder/reparent.", "acceptance_criteria": ["Expandable tree", "Right-click: New Request/Folder, Rename, Duplicate, Delete, Export", "Drag-and-drop reorder + reparent", "Active request highlighted", "Local DB updates with dirty flag", "Empty state CTA"], "affects": ["desktop"]},
        {"id": "DESK-008", "title": "Request history with replay", "description": "Auto-capture every sent request + response; reverse-chronological list with search.", "acceptance_criteria": ["Capture on every send (success and failure)", "Last 200 entries with 'Load more'", "Search by URL or status", "Date grouping (Today/Yesterday/Earlier)", "Click for read-only view, Replay button to re-send", "History never syncs to backend"], "affects": ["desktop"]},
        {"id": "DESK-009", "title": "Environments and selector", "description": "Dev/Staging/Prod environments with key-value variables, top-bar selector.", "acceptance_criteria": ["CRUD on environments in settings", "Key-value variable table with secret toggle", "Secret variables in OS keychain", "Top-bar dropdown for switching", "Switch is instant, variables re-resolve in open requests", "Hover tooltip shows resolved value"], "affects": ["desktop"]},
        {"id": "DESK-010", "title": "Collection-scoped variables", "description": "Variables defined at collection level override environment vars.", "acceptance_criteria": ["Right-click collection → Variables editor", "Resolution priority: collection > env (visible in tooltip)", "Synced via the same sync protocol"], "affects": ["desktop"]},
        {"id": "DESK-011", "title": "Postman v2.1 import", "description": "Lossless import of collections, folders, requests, environments. Scripts stored as metadata.", "acceptance_criteria": ["File picker accepts .json, recognized via info.schema", "Folders/sub-folders/requests/headers/body/params all imported", "Bearer/Basic/API Key mapped to Volt auth types", "Scripts stored in _imported_script, warning shown", "Environments importable as Volt environments", "Summary modal: 'Imported X requests in Y folders'", "Test corpus: 5+ real-world Postman collections succeed"], "affects": ["desktop"]},
        {"id": "DESK-012", "title": "Insomnia v4 import", "description": "Same flow for Insomnia's flat-records export format.", "acceptance_criteria": ["Recognize _type:export JSON", "Map workspaces/request_groups/requests", "Auth types map directly", "3+ real Insomnia exports tested"], "affects": ["desktop"]},
        {"id": "DESK-013", "title": "OpenAPI 3.0 import", "description": "Generate collection from OpenAPI spec, populate example bodies, map auth.", "acceptance_criteria": ["File picker accepts .json/.yaml/.yml", "Uses @apidevtools/swagger-parser", "Each path → folder, each operation → request", "Parameters mapped, body example populated", "securitySchemes → Bearer/Basic/API Key", "First server URL → baseUrl variable", "Petstore/Stripe-like/GitHub-like specs import cleanly"], "affects": ["desktop"]},
        {"id": "DESK-014", "title": "cURL paste-as-request", "description": "Parse curl command into a request, supports multi-line, all common flags.", "acceptance_criteria": ["URL bar paste detection: curl prefix offers conversion", "Parses method/URL/headers/body/cookies/basic/bearer", "Multi-line with backslash continuation", "20+ real curl commands from browser DevTools parse cleanly"], "affects": ["desktop"]},
        {"id": "BE-001", "title": "Backend auth: register/login/logout/me with Lucia 3", "description": "Email + password, argon2id, 5-failed lockout (15 min), Postgres sessions.", "acceptance_criteria": ["Register returns 201 + session", "Login 200 + Set-Cookie + sessionId in body (for desktop Bearer)", "Logout invalidates session", "/me returns user + teams + devices", "Lockout in-memory", "Unit and E2E tests"], "affects": ["backend"]},
        {"id": "BE-002", "title": "Teams: create, invite, join, roles", "description": "Team management endpoints with OWNER/EDITOR/VIEWER roles and one-time invite codes.", "acceptance_criteria": ["POST /teams creates with caller as OWNER", "Invite generates 7-day code, optional email", "Accept invite adds as EDITOR by default", "Role changes via PATCH, removal via DELETE", "Can't remove last OWNER", "Transfer ownership endpoint"], "affects": ["backend"]},
        {"id": "BE-003", "title": "Workspaces with revision counter", "description": "Personal and team workspaces, monotonic currentRevision per workspace.", "acceptance_criteria": ["POST /workspaces creates personal or team", "GET returns user's all workspaces (personal + team)", "PATCH for rename/move-to-team (one-way)", "Access control enforced", "Soft delete with 30-day recovery"], "affects": ["backend"]},
        {"id": "BE-004", "title": "Sync push endpoint", "description": "POST /sync/push with baseRevision check, atomic application, conflict log on overwrite.", "acceptance_criteria": ["baseRevision check returns 409 if stale", "Atomic application in transaction", "currentRevision increments per change", "Postgres advisory locks per workspace", "Overwritten rows saved to ConflictLog before being overwritten", "100 changes < 200ms p95"], "affects": ["backend"]},
        {"id": "BE-005", "title": "Sync pull + SSE stream", "description": "GET /sync/pull with since param + GET /sync/stream for real-time push.", "acceptance_criteria": ["Pull returns changes with revision > since, ordered ASC", "SSE pushes change events on every push", "SSE reconnects gracefully", "Heartbeat every 30s", "Multiple workspace subscriptions multiplexed on one connection"], "affects": ["backend"]},
        {"id": "BE-006", "title": "Conflict log endpoints", "description": "List and restore from conflict log.", "acceptance_criteria": ["GET /sync/conflicts lists last 30 days", "POST /sync/conflicts/:id/restore reapplies previous state as new change", "Cron purges entries > 30 days", "Test: simulated conflict + restore"], "affects": ["backend"]},
        {"id": "DESK-015", "title": "Desktop auth: login UI + keychain", "description": "Native login panel, session token in OS keychain via keytar.", "acceptance_criteria": ["Settings → Account flow", "Sign-in panel with email + password", "Token written to keychain (service:'Volt')", "App-launch validates token via /auth/me", "Logout clears keychain + sync state"], "affects": ["desktop"]},
        {"id": "DESK-016", "title": "Desktop sync engine", "description": "Push debounced 5s, pull every 30s, SSE for push, conflict handling on 409.", "acceptance_criteria": ["Sync starts 2 sec after window appears", "Push debounced 5s when dirty rows exist", "Pull every 30s + SSE", "409 triggers pull-first-then-repush", "UI status: Synced/Syncing/Offline/Conflict", "Offline queues changes, retries on reconnect", "Two-instance test verifies last-write-wins"], "affects": ["desktop"]},
        {"id": "DESK-017", "title": "Conflict banner UI", "description": "Non-modal banner with View overwritten / Restore mine / Dismiss.", "acceptance_criteria": ["Banner shows on affected request when pull overwrites local dirty change", "View overwritten: diff view", "Restore mine: calls /sync/conflicts/:id/restore", "Dismiss: hides", "Multiple conflicts: 'View all' link"], "affects": ["desktop"]},
        {"id": "DESK-018", "title": "Team and workspace management UI", "description": "Teams page (create, invite, members, roles) and Workspaces page (personal + team).", "acceptance_criteria": ["Settings → Teams with create + member list", "Invite generates code/link", "Leave team for non-owners", "Workspaces page with active highlighted", "Move-to-team (one-way) on personal workspaces"], "affects": ["desktop"]},
        {"id": "INFRA-004", "title": "Cross-platform build pipeline", "description": "electron-builder for macOS universal, Windows x64, Linux deb + AppImage.", "acceptance_criteria": ["pnpm build:desktop --mac produces signed .dmg", "--win produces signed .exe", "--linux produces .AppImage + .deb", "macOS universal binary", "SHA-256 checksums", "Builds complete < 5 min on M1"], "affects": ["infra", "desktop"]},
        {"id": "INFRA-005", "title": "GitHub Actions release workflow", "description": "Tag-triggered parallel builds with signing and notarization, published to GitHub Releases.", "acceptance_criteria": ["Triggered by v* tag", "Three parallel jobs", "macOS notarization via notarytool", "Consistent artifact naming", "latest.yml etc for electron-updater", "Total wall time < 20 min"], "affects": ["infra"]},
        {"id": "INFRA-006", "title": "Backend deployment", "description": "Docker Compose on Hetzner VPS, nginx with SSE-friendly config, TLS, backups.", "acceptance_criteria": ["docker-compose.prod.yml with all services", "nginx proxy_buffering off for SSE", "Nightly pg_dump, 7-day retention", "Certbot TLS auto-renewal", "Deploy via GitHub Actions on main", "Backend image on GHCR"], "affects": ["infra", "backend"]},
        {"id": "DESK-019", "title": "Auto-update via electron-updater", "description": "Background download, prompt on quit/launch, manual check option.", "acceptance_criteria": ["Check 5 min after launch + every 4h", "Background download with progress", "'Restart to update' prompt", "Manual 'Check for updates' button", "Stable channel default, pre-release toggle"], "affects": ["desktop", "infra"]},
        {"id": "DESK-020", "title": "Onboarding flow", "description": "First-launch welcome screen: Import / Start fresh / Sign in; time-to-first-request ≤45s.", "acceptance_criteria": ["First-launch detection", "Three clear options on welcome screen", "Import path opens picker → preview → import → highlight first request", "Start-fresh creates default workspace with example request", "Sign-in syncs personal workspace", "All paths complete in <10s"], "affects": ["desktop"]},
        {"id": "DESK-021", "title": "Opt-in telemetry", "description": "Anonymous, off-by-default metrics: version, OS, cold-start, weekly active. Never URLs or bodies.", "acceptance_criteria": ["Default OFF", "Settings → Privacy with explicit list of collected data", "Plausible self-hosted backend", "Cold-start time captured when on", "Privacy policy link visible", "Local batch never held > 24h"], "affects": ["desktop", "backend"]},
        {"id": "DESK-022", "title": "Marketing one-page website", "description": "Static site at volt.dev: hero, benefits, downloads, screenshot, FAQ, GitHub link.", "acceptance_criteria": ["Static Next.js or Astro, deployed to Cloudflare Pages", "OS detection for recommended download", "Dynamic links to latest GitHub Release", "SEO basics: meta, sitemap, robots", "Privacy and Terms hosted at /privacy and /terms"], "affects": ["infra", "marketing"]}
      ]
    },
    {
      "name": "v1.0",
      "goal": "Close feature gap with Postman based on first 3 months of feedback.",
      "tickets": [
        {"id": "v1-001", "title": "OAuth 2.0 flows", "description": "Auth code with PKCE, client credentials, password grant, device flow, refresh token handling.", "acceptance_criteria": ["All 4 grant types supported", "Token storage in keychain", "Refresh on expiry", "Per-request override"], "affects": ["desktop", "backend"]},
        {"id": "v1-002", "title": "GraphQL request type", "description": "Schema introspection, query/variables/headers panes, error-aware response viewer.", "acceptance_criteria": ["New request type 'GraphQL'", "Schema fetch via introspection", "Autocomplete in query editor", "Response viewer highlights GraphQL errors"], "affects": ["desktop"]},
        {"id": "v1-003", "title": "WebSocket request type", "description": "Connect, send text/binary, message log, manual reconnect.", "acceptance_criteria": ["WS connect/disconnect", "Send text or binary frame", "Bidirectional message log with timestamps", "Reconnect button"], "affects": ["desktop"]},
        {"id": "v1-004", "title": "Pre-request and post-response scripts", "description": "Postman-compatible JS sandbox using Node vm with curated pm.* API.", "acceptance_criteria": ["pm.environment.get/set", "pm.response.json()/headers", "pm.test()", "Chained requests work", "Sandbox cannot access filesystem or network outside the request"], "affects": ["desktop"]},
        {"id": "v1-005", "title": "Code generation", "description": "Export request as curl/fetch/axios/Python requests/Go http/Java OkHttp/PHP/Ruby.", "acceptance_criteria": ["8+ language outputs", "Side-panel viewer with copy button", "Preserves headers, body, auth"], "affects": ["desktop"]},
        {"id": "v1-006", "title": "Response diff viewer", "description": "Compare two response bodies with semantic JSON diff.", "acceptance_criteria": ["Pick two history entries to compare", "JSON diff with added/removed/changed keys highlighted", "Side-by-side view"], "affects": ["desktop"]},
        {"id": "v1-007", "title": "HAR import", "description": "Parse HAR file, create one request per entry.", "acceptance_criteria": ["File picker accepts .har", "Each entry becomes a request", "Filter to skip image/font/css entries"], "affects": ["desktop"]},
        {"id": "v1-008", "title": "Export to Postman/Insomnia/OpenAPI", "description": "Round-trip: any Volt collection exports in our import formats.", "acceptance_criteria": ["Export to Postman v2.1, Insomnia v4, OpenAPI 3.0", "Lossless for the features each format supports", "Re-import test: export then import produces identical collection"], "affects": ["desktop"]},
        {"id": "v1-009", "title": "Dark mode", "description": "Full dark theme respecting system preference.", "acceptance_criteria": ["System / Light / Dark toggle", "All components themed", "No flash of wrong theme on launch"], "affects": ["desktop"]},
        {"id": "v1-010", "title": "Global fuzzy search", "description": "Cmd/Ctrl+P searches all requests across all workspaces.", "acceptance_criteria": ["Open with Cmd/Ctrl+P", "Fuzzy match name and URL", "Group by workspace", "Arrow keys + Enter to open"], "affects": ["desktop"]},
        {"id": "v1-011", "title": "Documentation generation", "description": "Generate Markdown from a collection.", "acceptance_criteria": ["Right-click collection → Generate docs", "Markdown output with request summary, example response per request", "Copy or save to file"], "affects": ["desktop"]},
        {"id": "v1-012", "title": "Request chaining UI", "description": "Visual flow where response of A feeds variables of B.", "acceptance_criteria": ["UI to define 'chain' as sequence of requests", "Extract value from response via JSONPath/jq into a variable", "Run chain end-to-end with one click"], "affects": ["desktop"]}
      ]
    },
    {
      "name": "v1.1+",
      "goal": "Power user and enterprise readiness.",
      "tickets": [
        {"id": "v1.1-001", "title": "gRPC support", "description": ".proto import, server reflection, unary + streaming.", "acceptance_criteria": [".proto file import", "Server reflection alternative", "Unary, client/server/bidi streaming"], "affects": ["desktop"]},
        {"id": "v1.1-002", "title": "Mock server", "description": "Local mock: predefined responses for given request patterns.", "acceptance_criteria": ["Mock config per collection", "Pattern matching by method + URL + body", "Sharable mock config"], "affects": ["desktop"]},
        {"id": "v1.1-003", "title": "CLI companion", "description": "volt send <collection>/<request> for CI use cases.", "acceptance_criteria": ["Reads same volt.db", "Outputs response code + body to stdout", "Exit code from HTTP status"], "affects": ["desktop", "infra"]},
        {"id": "v1.1-004", "title": "Plugin system", "description": "Third-party auth helpers, response transformers.", "acceptance_criteria": ["Plugin API surface defined", "Sandbox boundary for plugin execution", "Plugin marketplace (later)"], "affects": ["desktop"]},
        {"id": "v1.1-005", "title": "Paid team tier launch", "description": "Stripe, RBAC, audit log, advanced auth, priority support.", "acceptance_criteria": ["Stripe checkout for team tier", "RBAC enforced in UI + backend", "Audit log for team admins"], "affects": ["backend", "desktop"]},
        {"id": "v1.1-006", "title": "SSO (Google Workspace, GitHub, SAML)", "description": "Identity provider integration for enterprise readiness.", "acceptance_criteria": ["OAuth-based SSO for Google + GitHub", "SAML for enterprise SSO"], "affects": ["backend"]},
        {"id": "v1.1-007", "title": "On-prem deployment package", "description": "Self-contained Docker bundle for enterprises to host their own backend.", "acceptance_criteria": ["docker-compose for full backend stack", "License key validation", "Documentation for setup"], "affects": ["backend", "infra"]},
        {"id": "v1.1-008", "title": "Real-time collaboration cursors", "description": "See teammates editing the same request live (CRDT-lite for cursor position).", "acceptance_criteria": ["Cursor presence over SSE", "Edit conflicts still LWW (CRDT only for cursors, not content in v1.1)"], "affects": ["desktop", "backend"]},
        {"id": "v1.1-009", "title": "Workspace activity feed", "description": "'Ahmet edited X 3 min ago' feed for medium teams.", "acceptance_criteria": ["Feed visible in workspace sidebar", "Filter by user or action type"], "affects": ["desktop", "backend"]},
        {"id": "v1.1-010", "title": "Cookie jar across requests", "description": "Persistent cookies per workspace, auto-applied to matching domains.", "acceptance_criteria": ["Cookies parsed from Set-Cookie", "Applied to subsequent requests to same domain", "Cookie inspector UI"], "affects": ["desktop"]}
      ]
    }
  ]
}
```
