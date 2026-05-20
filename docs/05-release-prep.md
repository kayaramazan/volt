# Stage 5 — Release Prep

This document covers everything between "code is written" and "users can download Volt." If you're following the pipeline from scratch, treat this as a checklist.

## 1. Domains + branding

You need one domain for the marketing site and an `api.` subdomain for the backend. Buy at any registrar (Namecheap, Cloudflare Registrar, Porkbun — all fine). Use Cloudflare DNS even if registered elsewhere; the proxied DNS gives you free DDoS protection.

| Subdomain     | Points to               | Purpose                             |
| ------------- | ----------------------- | ----------------------------------- |
| `volt.dev`    | Vercel/Netlify          | Marketing site                      |
| `api.volt.dev`| Hetzner VPS public IP   | Backend API + sync SSE              |
| `releases.volt.dev` | GitHub Releases (redirect) | Optional alias for download links |

**Why a separate API host:** keeps the marketing site fully static and CDN-cached. The backend is on its own box; you can swap that box without touching DNS or the marketing site.

## 2. VPS provisioning (Hetzner)

Use Hetzner's CX22 (€4/month, 2 vCPU, 4 GB RAM) for early production. Move to CPX21 (€8/month, 3 vCPU, 4 GB RAM) once you cross ~50 active sync users.

**One-time setup:**

```bash
# After creating the VPS with an SSH key in the Hetzner console:
ssh root@<vps-ip>

# Copy the repo's setup script over (or clone):
curl -fsSL https://raw.githubusercontent.com/<owner>/volt/main/scripts/setup-server.sh > setup.sh
bash setup.sh
```

This installs Docker, creates a `deploy` user, hardens SSH, enables UFW + fail2ban, and prepares `/srv/volt`.

**Add the deploy SSH key:**

```bash
# On your local machine, generate a dedicated key:
ssh-keygen -t ed25519 -C "volt-deploy" -f ~/.ssh/volt-deploy -N ""

# Add the PUBLIC key to the server:
ssh-copy-id -i ~/.ssh/volt-deploy.pub deploy@<vps-ip>

# Store the PRIVATE key as a GitHub secret named DEPLOY_SSH_KEY.
```

**Provision TLS:**

Point `api.volt.dev` DNS at the VPS, wait for propagation (`dig api.volt.dev`), then:

```bash
ssh root@<vps-ip>
bash /srv/volt/scripts/init-tls.sh api.volt.dev contact@volt.dev
```

Certbot installs a systemd timer for automatic renewal every 60 days; the post-renewal hook reloads Nginx.

**Populate `.env`:**

```bash
ssh deploy@<vps-ip>
cat > /srv/volt/.env <<EOF
# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=' | head -c 32)
DATABASE_URL=postgresql://volt:\${POSTGRES_PASSWORD}@postgres:5432/volt

# Session signing
SESSION_SECRET=$(openssl rand -base64 48)

# CORS for desktop app — restrict to the Electron protocol
CORS_ORIGINS=app://volt,electron://volt

# Where this API is reachable from (for invite links etc.)
APP_URL=https://volt.dev
API_URL=https://api.volt.dev

NODE_ENV=production
EOF
chmod 600 /srv/volt/.env
```

## 3. Code signing — costs and process

Code signing is *not* optional for the desktop app. Without it:
- macOS Gatekeeper blocks the app entirely; users see "cannot be opened because the developer cannot be verified"
- Windows SmartScreen pops a scary red warning that scares away ~80% of users
- Some Linux package managers reject unsigned packages

| Platform | Required cert                  | Approx. cost           | Provider                |
| -------- | ------------------------------ | ---------------------- | ----------------------- |
| macOS    | Apple Developer Program ID     | $99/year               | developer.apple.com     |
| Windows  | EV Code Signing Certificate    | $300–$600/year         | Sectigo, DigiCert, SSL.com |
| Linux    | None (we ship AppImage + .deb) | $0                     | —                       |

**macOS process:**

1. Enroll in Apple Developer Program ($99/year); takes 1–3 days for verification
2. In Apple Developer dashboard: create a "Developer ID Application" certificate
3. Export it from Keychain as `.p12` with a password
4. Convert to base64: `base64 -i cert.p12 -o cert.p12.b64`
5. Set GitHub secrets:
   - `MAC_CERTIFICATE_BASE64` → contents of `cert.p12.b64`
   - `MAC_CERTIFICATE_PASSWORD` → the export password
6. For notarization (required for macOS 10.15+):
   - Create an app-specific password at appleid.apple.com → Security
   - Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` secrets

The release workflow's `mac` job picks these up automatically.

**Windows process:**

1. Buy an EV cert from a CA. EV certs use a hardware token (USB) for signing — modern CAs offer cloud-signing services (e.g. SSL.com eSigner) that work in CI
2. Get the cert as a `.pfx` file (or use SSL.com's HSM-backed cloud signing)
3. Base64-encode and set GitHub secrets:
   - `WIN_CERTIFICATE_BASE64`
   - `WIN_CERTIFICATE_PASSWORD`

The first few signed builds will still show SmartScreen warnings until Microsoft accumulates "reputation" for your cert — this takes ~1 month of regular downloads to clear.

**Until you have certs:** ship unsigned builds with a clear note on the download page. Users will need to right-click → Open on macOS and override SmartScreen on Windows.

## 4. Marketing site

Keep it dead simple. Static HTML/Tailwind on Vercel, ~5 sections:

1. **Hero**: one-line pitch + download button + screenshot
2. **Three feature highlights**: speed, offline-first, teams
3. **Screenshots / animation**: 3-4 large images of the actual app
4. **Pricing**: free now, "Teams plan launching late 2026" placeholder
5. **Footer**: privacy, docs, GitHub, contact

Download links should point to `https://github.com/<owner>/volt/releases/latest/download/...` — never to a specific version. GitHub auto-redirects to the latest release.

Skip blogs, careers pages, testimonials at launch. They're noise until you have real users to feed them.

## 5. Auto-update

`electron-updater` is wired up via electron-builder's `publish.provider: github`. On app startup, it checks the GitHub Releases feed and downloads the new version in the background. The user sees a "Restart to update" prompt.

**To trigger an update**, publish a new GitHub Release with version higher than current. The `latest.yml` / `latest-mac.yml` files (uploaded by the release workflow) are the manifest.

**Update channels:** for MVP, single channel (`stable`). Beta channel can be added later by appending `-beta.N` to the version (e.g. `v1.1.0-beta.1`) — the release workflow already marks these as prerelease.

## 6. Telemetry decision

**Decision: no telemetry in MVP.**

Reasoning:
- Privacy is a differentiator for Volt (vs Postman's cloud-first model + recent backlash). Shipping telemetry would undercut that pitch.
- Crash reports are useful, but we can add them as opt-in in v1.1 once we have something specific we want to track.
- Sync analytics (workspaces synced per day, etc.) are derivable from backend logs without extra desktop instrumentation.

If we add opt-in crash reporting later, use Sentry's self-hosted instance (not their SaaS) to keep the privacy story clean.

## 7. Launch checklist

Two weeks before launch:
- [ ] Buy domains + set up DNS
- [ ] Provision Hetzner VPS + run setup script
- [ ] Buy Apple Developer membership + request signing cert (3-day lead time)
- [ ] Set up Postgres backups (cron the `backup.sh` script)
- [ ] Write privacy policy (see `docs/PRIVACY.md`)
- [ ] Build marketing site, deploy to Vercel
- [ ] Set up basic monitoring (UptimeRobot free tier hitting `/api/health`)

One week before launch:
- [ ] Buy Windows EV cert (allow extra time for issuance — can be 1-2 weeks)
- [ ] First signed builds of macOS + Linux (ship Windows after EV cert arrives)
- [ ] Tag `v0.1.0`, trigger release workflow
- [ ] Test signed installer on a clean macOS + Linux box
- [ ] Final polish on marketing site

Launch day:
- [ ] Publish the GitHub Release (un-draft)
- [ ] Tweet, post to Hacker News, /r/programming, /r/webdev
- [ ] Watch backend logs + error rate
- [ ] Be online for 6+ hours to respond to issues

Day-1 monitoring priorities:
1. Backend 5xx rate (anything > 1% needs investigation)
2. Sign-up funnel (registers vs first sync)
3. App crash reports filed as GitHub issues (no telemetry, so manual)
4. Public sentiment on the launch threads

## 8. Pricing and monetization timing

From Stage 1: free now, paid teams tier ($8-12/user/month) launching ~6 months in. The trigger is reaching ~500 active sync users, not a calendar date.

For now, the backend treats all users as on the free tier. Stripe integration is deferred — when we add it, it'll be a single Drizzle migration + a Stripe webhook handler.
