# Privacy Policy

*Last updated: 2026-05-20*

This is a plain-English privacy policy. We've tried to keep it short and direct. If you want the formal legal version, contact us and we'll add one — most users don't.

## Short version

- Volt stores your API requests on **your computer**, not in our cloud.
- We only store data on our servers if you sign in and use a team workspace.
- We do not track what requests you make, what URLs you hit, or what response bodies you receive. We never see them.
- We do not use analytics, crash reporting, or telemetry of any kind in the desktop app.
- The marketing site (volt.dev) uses Cloudflare for CDN, which means Cloudflare logs basic visit metadata.

## What we collect

**If you use Volt offline only:**
- Nothing. Volt does not connect to our servers in offline mode.

**If you create an account:**
- Your email and name (only what you provide).
- A hashed password (we never see the plaintext).
- A list of your devices (label, OS, app version, last seen timestamp). This lets you see and revoke active sessions.

**If you use sync:**
- Your collections, requests, environments, and variable values are sent to our servers and stored encrypted at rest.
- Sensitive values (auth tokens, secret variables) marked as secrets in the app are stored in your OS keychain and never sent to our servers.
- Request and response history stays on your computer. We never sync history.

**What we do NOT collect:**
- The URLs you hit when sending requests
- Response bodies or headers
- Any data about which requests you send when
- IP addresses associated with your requests (Volt sends them directly from your machine, not through our servers)
- Crash reports or analytics

## What we share

We do not sell or share your data with third parties. We use the following service providers strictly to operate Volt:

- **Hetzner** (Germany) — hosts our backend servers
- **GitHub Releases** — hosts our app installers
- **Cloudflare** — DNS + CDN for the marketing site
- **Apple, Microsoft** — code-signing intermediaries for the signed installers

## How long we keep data

- Account data: until you delete your account.
- Sync data: until you delete the workspace or your account. Deleted workspaces are recoverable for 30 days, then permanently removed.
- Conflict log entries: 30 days, then automatically deleted.
- Server access logs: 14 days (for debugging only).
- Postgres backups: 14 days rolling.

## Your rights

You can:
- Export all your data (Settings → Export workspace)
- Delete individual workspaces (Settings → Workspace → Delete)
- Delete your account (Settings → Account → Delete). All your synced data is removed within 7 days.

If you live in a region with data protection laws (EU/GDPR, UK, California/CCPA), the rights above already match what those laws require. For formal requests, email `privacy@volt.dev`.

## Security

- All connections to our servers use TLS 1.3
- Passwords hashed with Argon2id
- Database encrypted at rest (Hetzner block storage encryption)
- Secrets stored in OS keychain on your device, never in plaintext on disk
- We perform regular security updates on the server infrastructure

If you find a security issue, please email `security@volt.dev` rather than opening a public issue. We respond within 24 hours.

## Changes to this policy

If we change anything material, we'll show a notice in the app on next launch. We won't change defaults to be less private without an explicit opt-in.

## Contact

Email: `privacy@volt.dev`
GitHub: `https://github.com/<owner>/volt`
