# Product Brief — Volt

> Stage 1 / 5 — Product enrichment output
> Next: `02-tech-stack.md` (architecture and technology decisions)

---

## Product

**Name:** Volt (working title — can be changed before launch)

**Tagline:** A fast, native-feeling API client that doesn't slow you down. Built for developers who outgrew Postman.

**One-liner positioning:** Postman has become bloated and cloud-locked. Volt is what Postman should have stayed — local-first, instant, and respectful of your machine.

---

## Problem

Postman started as a lightweight Chrome extension and became the de facto API testing tool for millions of developers. But over the past 5 years it has:

- Become **slow to launch** (5-15 seconds cold start on modern hardware), with high baseline memory usage (500+ MB even idle)
- Pushed users into a **forced sign-in flow** for features that used to work offline
- Migrated history, collections, and environments into the cloud, making **offline development painful**
- Added telemetry, sync delays, login walls, and product upsells that get in the way of the core workflow
- Made **team sharing** complex (workspaces, mocks, monitors, governance — overwhelming for small teams)

Insomnia, the obvious alternative, was acquired by Kong and went through its own controversial cloud-sync transition that broke trust with the open-source community.

The result: a large, frustrated user base actively looking for an alternative. Online discussions ("I just want a fast API client") in dev communities are constant. The market is asking for **the simple thing, done well**.

Volt fills that gap: an Electron desktop app that opens in under a second, works fully offline, syncs across machines and teammates when online, and never blocks the core "send a request, see a response" loop behind a feature wall.

---

## Target users

**Primary — backend and full-stack developers, globally:**

- Age 22-45, professionally building APIs or integrating with them daily
- English-speaking (UI in English; other languages post-v1)
- Familiar with Postman or Insomnia; current users actively looking to switch
- Work in small to medium teams (2-20 developers) where API contracts evolve daily
- Comfortable with technical concepts: headers, auth flows, environment variables, response status codes

**Secondary — QA engineers and technical product managers:**

- Use Postman/similar tools occasionally to test endpoints during QA cycles
- Less interested in scripting/automation, more in clarity and history
- Often the ones inheriting a collection from a developer who left

**Not the target (deprioritized):**

- Beginners learning what an API is — Postman has the brand recognition for this use case
- Enterprise governance/compliance buyers — different product, different sales motion
- API consumers using GraphQL exclusively — that comes in a later phase

---

## Core features

### MVP (must ship at launch)

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 1 | REST request execution (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS) | must | All standard HTTP verbs, full header control, raw + form-data + url-encoded + binary body |
| 2 | Response viewer with syntax highlighting | must | JSON, XML, HTML, plain text, image preview, raw bytes for binary |
| 3 | Collections (folders) of requests | must | Drag-drop reorder, nested folders, rename, duplicate |
| 4 | Request history with one-click replay | must | Automatic capture of every sent request with full response, queryable timeline, "send again" from any point |
| 5 | Environment variables (dev/staging/prod) | must | Switch environments with single dropdown, `{{variable}}` syntax in URL, headers, body |
| 6 | Collection-level variables | must | Variables scoped to a collection, override environment values |
| 7 | Offline-first storage | must | All work persists locally in SQLite; sync layer is additive, never required |
| 8 | Account creation and login (optional) | must | Email + password; without an account, the app works fully — just no team sync |
| 9 | Teams: invite teammates, share collections | must | Last-write-wins sync, real-time enough (5-10 sec push), conflict notification when overwritten |
| 10 | Auth helpers (Bearer token, Basic, API key in header/query) | must | The 90% case — OAuth and others post-MVP |
| 11 | Import: Postman v2.1 collection format | must | The primary user acquisition vector — migration must be lossless for collections + environments |
| 12 | Import: Insomnia v4 format | must | Same reasoning; second-largest migrating user base |
| 13 | Import: OpenAPI/Swagger 3.0 | must | Generates a collection from spec — onboarding for API teams with existing docs |
| 14 | Import: cURL command | must | Paste-as-request: the single most-used feature in API clients after request sending |
| 15 | Cross-platform builds | must | macOS (Intel + Apple Silicon), Windows (x64), Linux (deb + AppImage) |

### v1.0 (within 2-3 months of launch)

- OAuth 2.0 helpers (auth code, client credentials, implicit, password grant)
- GraphQL request type with schema introspection
- WebSocket request type with message log
- HAR file import
- Export: same formats as import (Postman, Insomnia, OpenAPI generation from collections)
- Pre-request and post-response scripts (JavaScript sandbox, limited Node API)
- Code generation: turn a request into curl, fetch, axios, requests, http.Client snippets
- Response diff viewer (compare two response bodies)
- Sortable, filterable history with tag and starring

### v1.1+ (later phases)

- gRPC support
- API documentation generation from collections (hosted)
- Mock server (forward requests to fake responses for frontend dev)
- Team activity feed (who edited what, when)
- Role-based access on collections (read-only viewers vs editors)
- Plugin system for custom auth helpers and response transformers
- Cloud-hosted teams plan (managed backend for teams that don't want to self-host)
- Single sign-on (SAML, Google Workspace, GitHub) for paid tiers

---

## Success metrics

The first six months post-launch are about building a base of vocal, loyal users who will tell colleagues. Metrics that matter:

1. **Active installs** — devices that have launched the app and sent at least one request in the last 14 days. Target: 5,000 by end of month 6.
2. **Week-2 retention** — percent of new users who return after their first week. Target: ≥40%. (Industry baseline for developer tools is 25-30%.)
3. **Median cold-start time** — measured via opt-in telemetry. Target: ≤800ms on 2020+ hardware. This is our key differentiator and must be enforced as a hard performance budget.
4. **Time-to-first-request** — from app open to "Send" pressed for a new user. Target: ≤45 seconds.
5. **Team formation rate** — percent of accounts that invite at least one teammate within 30 days. Target: ≥15%. This is the leading indicator for future monetization.
6. **Postman/Insomnia import success rate** — collections imported without errors or data loss. Target: ≥95%. Failed imports are the single biggest risk to user acquisition.

Deliberately not tracking yet: requests-per-day, total users, GitHub stars. These follow from the above, not the other way around.

---

## Monetization

**Phase 1 (months 0-6) — fully free, no payment integration.**

The goal is adoption and feedback. Every feature in MVP and v1.0 is free for individuals and teams of any size. No artificial limits, no nag screens, no signup-required-for-X flows. The app is open to download from the website without an account; teams require an account but team size is unlimited.

This phase is loss-making (servers + dev time) and that's intentional — the bet is that a critical mass of happy users in 6 months is worth more than $X of revenue from early monetization. Funding sources during this phase: founder time, potentially a small angel round, or self-funded.

**Phase 2 (month 6-12) — paid team tier.**

Once active install base reaches a meaningful number (≥5,000) and team formation rate is healthy (≥15%), introduce paid features for teams:

- **Free tier remains free forever** for individuals and small teams (up to 3 members). All core features included.
- **Team tier** at ~$8-12 per user per month: more than 3 members, role-based permissions, audit log, priority support, advanced auth flows (OAuth 2.0 device flow, JWT bearer with custom signing), shared variable libraries.
- **Enterprise tier** later (only if pull from the market): SSO, on-prem deployment, advanced governance, SLA. Sales-led, not self-serve.

The team tier pricing should be ~50% of Postman's equivalent. Volt's positioning is "Postman, but actually good and half the price" — undercut on price while clearly winning on speed and offline support.

**What we won't do:** ads, telemetry sold to third parties, dark patterns to force account creation, gated history/collections. The core promise to early adopters is "this stays fast and respectful of your data."

---

## Competitors

**Direct (current Postman/Insomnia alternative seekers):**

- **Bruno** — open-source, file-based, growing fast. Strong on philosophy (git-friendly, no cloud) but UX is rough and team collaboration is bring-your-own-git. Volt's differentiation: native team sync without forcing git on the user, polished UX.
- **Hoppscotch** — open-source, originally web-only, now has a desktop wrapper. Lightweight but underfeatured. Volt's differentiation: real desktop experience, proper offline storage, team features.
- **HTTPie Desktop** — sleek, fast, but limited collection management and team features. Volt's differentiation: collections, history, teams.
- **Yaak** — newer Electron-based competitor, similar positioning. Smaller community but worth watching closely; differentiation will be on import quality, sync reliability, and polish.

**Indirect (incumbents losing share):**

- **Postman** — still dominant but increasingly disliked. The frustration is real and visible in community discussions.
- **Insomnia** — burned trust with the Kong acquisition's cloud-sync push; users are actively looking elsewhere.

**Reference points (for inspiration, not direct competition):**

- **Linear** — the "fast, opinionated, beautiful" software model. Their app launches in 200ms because they care.
- **Raycast** — Electron done right (fast despite the framework reputation).
- **Sublime Text / Notion** — one-time license vs subscription pricing models worth studying.

**Positioning summary:** Volt is "what Postman would be if it stayed focused." Faster than the incumbent, friendlier to teams than open-source alternatives, more polished than newcomers, and honest about what it doesn't do (won't try to be a full API lifecycle platform — just a fast client).

---

## Platform decision

| Platform | Decision | Notes |
|----------|----------|-------|
| **Desktop (Electron)** | ✓ Primary | macOS (Intel + Apple Silicon universal binary), Windows x64, Linux (deb + AppImage). All three at v0.1. |
| **Web app** | ✗ Not in MVP | A web version is interesting but splits engineering effort and the value proposition (local-first speed, offline) is desktop-native. Possibly revisited in v1.1+. |
| **Mobile** | ✗ No plans | API testing on mobile is a non-existent use case. |
| **CLI** | ✗ Not in MVP | A CLI companion (`volt send my-collection/my-request`) would be a strong v1.0 add for CI use cases, but not MVP. |

**Why Electron despite its reputation:** It's the only mature option that gets you all three desktop platforms with one codebase and lets us reuse Node.js ecosystem libraries (HTTP, parsing, storage). The performance reputation is earned in apps that don't care; the cold-start budget (≤800ms) forces us to ship a small bundle, lazy-load the renderer, and stay disciplined. Linear, Raycast, and VS Code prove this is achievable.

Alternatives considered and rejected:

- **Tauri (Rust + webview)** — better baseline performance but the Rust ecosystem for HTTP client features (multipart, complex auth, WebSocket later) is less mature and we'd write more glue code. Worth revisiting at v2 if Electron becomes a real constraint.
- **Flutter desktop** — too unproven for desktop developer tools, ecosystem is mobile-shaped.
- **Native per platform** — 3× the effort, no value to the user.

---

## Design principles

These principles bind every Stage 2+ decision:

1. **Speed is a feature, not an optimization.** Cold start ≤800ms, "Send" → first byte rendered ≤50ms after response arrives, no spinners under 100ms latency. Every PR is judged against this budget.
2. **Offline is the default, online is the bonus.** The app must work without an account, without a network, without a backend. Sync is layered on top — never load-bearing.
3. **Keyboard before mouse.** Every action has a shortcut. New request: `Cmd/Ctrl+N`. Send: `Cmd/Ctrl+Enter`. Switch environment: `Cmd/Ctrl+E`. Command palette: `Cmd/Ctrl+K` for everything else.
4. **One screen, no modals.** No "open in new window" workflows. Sidebar (collections + history) + main pane (request + response). Settings and dialogs slide in as panels, not floating modals that obscure work.
5. **Migration is sacred.** If a user can't bring their Postman collection in cleanly on day one, they don't become a user. Import quality is a Stage 4 acceptance criterion, not a "we'll fix it later" item.
6. **Sync conflicts must be visible, never silent.** Last-write-wins as a strategy, but always with a banner: "Your edit was overwritten by Ahmet 2 minutes ago. View previous version." Trust requires transparency.
7. **No telemetry without consent.** Opt-in only, anonymized, never the request bodies or URLs. Default off. The promise: "we don't see what you're testing."

---

```json
{
  "name": "Volt",
  "tagline": "A fast, native-feeling API client that doesn't slow you down. Built for developers who outgrew Postman.",
  "problem": "Postman has become bloated, slow to launch, cloud-locked, and overwhelming. Insomnia's acquisition broke trust. The market is actively looking for a fast, local-first API client that handles teams without forcing complex workflows. Volt is that alternative: opens in under a second, works fully offline, syncs across teammates when online.",
  "target_users": [
    "Backend and full-stack developers globally — daily Postman/Insomnia users actively seeking a faster, less bloated alternative",
    "QA engineers and technical PMs — occasional API testers who need clarity and history more than scripting",
    "Small to medium development teams (2-20 people) where API contracts evolve daily"
  ],
  "core_features": [
    {"title": "REST request execution", "description": "All standard HTTP verbs, full header/body/auth control, response viewer with syntax highlighting for JSON/XML/HTML/binary.", "priority": "must"},
    {"title": "Collections and folders", "description": "Nested folder organization with drag-drop reorder, rename, duplicate.", "priority": "must"},
    {"title": "Request history with replay", "description": "Automatic capture of every sent request and response; queryable timeline; one-click resend from any past point.", "priority": "must"},
    {"title": "Environment variables", "description": "Dev/staging/prod environments with one-dropdown switching, {{variable}} syntax in URL, headers, body.", "priority": "must"},
    {"title": "Collection-level variables", "description": "Variables scoped to a collection that can override environment values.", "priority": "must"},
    {"title": "Offline-first local storage", "description": "All work persists in local SQLite; the app fully functions without network or account.", "priority": "must"},
    {"title": "Account and team sync", "description": "Optional email/password account; invite teammates; shared collections sync via last-write-wins with visible conflict notifications.", "priority": "must"},
    {"title": "Auth helpers (Bearer, Basic, API key)", "description": "Built-in handlers for the most common 90% of API authentication patterns.", "priority": "must"},
    {"title": "Postman v2.1 collection import", "description": "Lossless import of collections and environments — the primary user acquisition channel.", "priority": "must"},
    {"title": "Insomnia v4 import", "description": "Same reasoning as Postman import; covers the second-largest migrating user base.", "priority": "must"},
    {"title": "OpenAPI/Swagger 3.0 import", "description": "Generate a collection from an OpenAPI spec to onboard teams with existing docs.", "priority": "must"},
    {"title": "cURL import (paste-as-request)", "description": "Paste any curl command and have it parsed into a request — the most-used everyday utility feature.", "priority": "must"},
    {"title": "Cross-platform desktop builds", "description": "macOS universal (Intel + Apple Silicon), Windows x64, Linux deb + AppImage.", "priority": "must"},
    {"title": "OAuth 2.0 flows", "description": "Authorization code, client credentials, password grant, device flow, PKCE.", "priority": "should"},
    {"title": "GraphQL request type", "description": "Schema introspection, autocomplete, query/variables/headers panes.", "priority": "should"},
    {"title": "WebSocket request type", "description": "Connect, send messages, view message log with direction indicators.", "priority": "should"},
    {"title": "Code generation", "description": "Convert a request into curl, fetch, axios, requests, Go http.Client, Java OkHttp snippets.", "priority": "should"},
    {"title": "Pre-request and post-response scripts", "description": "JavaScript sandbox for chaining requests, extracting tokens from responses, conditional logic.", "priority": "should"},
    {"title": "gRPC support", "description": "Proto file import, server reflection, unary and streaming calls.", "priority": "could"},
    {"title": "Mock server", "description": "Forward incoming requests to predefined responses for frontend dev.", "priority": "could"},
    {"title": "Plugin system", "description": "Third-party auth helpers, response transformers, custom UI panels.", "priority": "could"}
  ],
  "success_metrics": [
    "5,000 active installs by end of month 6 (active = at least one request sent in last 14 days)",
    "Week-2 retention ≥40% (industry baseline for dev tools is 25-30%)",
    "Median cold-start time ≤800ms on 2020+ hardware (measured via opt-in telemetry)",
    "Time-to-first-request ≤45 seconds for new users",
    "Team formation rate ≥15% (accounts that invite at least one teammate within 30 days)",
    "Postman/Insomnia import success rate ≥95% (collections imported without data loss)"
  ],
  "monetization": "Phase 1 (months 0-6): fully free, no payment integration, all features included. Goal is adoption and feedback. Phase 2 (months 6-12): individual and small team (≤3 members) tier remains free forever; team tier at ~$8-12/user/month adds role-based permissions, audit log, advanced auth flows, priority support. Positioning is ~50% of Postman's equivalent pricing. Enterprise tier (SSO, on-prem) reserved for later, sales-led not self-serve. No ads, no third-party telemetry sales, no dark patterns.",
  "competitors": [
    "Bruno (open-source, file-based, growing — strong philosophy but rough UX and bring-your-own-git for teams)",
    "Hoppscotch (open-source, web-first with desktop wrapper — lightweight but underfeatured for teams)",
    "HTTPie Desktop (sleek and fast but limited collection management and team features)",
    "Yaak (newer Electron-based competitor with similar positioning — closest peer competitor)",
    "Postman (incumbent losing share due to bloat, slow startup, forced cloud sync)",
    "Insomnia (lost trust after Kong acquisition's cloud-sync push)"
  ],
  "needs_web_frontend": false,
  "needs_mobile": false
}
```
