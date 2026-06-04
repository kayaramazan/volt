// OAuth 2.0 token fetcher. Supports the three most-used grants:
//   - client_credentials  (machine-to-machine; no user interaction)
//   - password            (legacy; user/pass to token endpoint)
//   - authorization_code  (with PKCE, browser hand-off; user pastes the code)
//
// All tokens are cached in app_state under `oauth.<cacheKey>` so they survive
// restarts. The resolver below pulls a fresh access token via `ensureToken`
// before each request and triggers a refresh when within the expiry window.
//
// We deliberately keep this small — no provider auto-discovery, no JWT
// inspection, no device flow (post-MVP).

import { getOAuthToken, setOAuthToken, type OAuthToken } from '../db/queries';

interface OAuth2Config {
  grant: 'client_credentials' | 'password' | 'authorization_code';
  tokenUrl: string;
  authUrl?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
  username?: string;
  password?: string;
  tokenCacheKey: string;
}

/** Returns a still-valid access token, fetching/refreshing if needed. */
export async function ensureToken(cfg: OAuth2Config): Promise<OAuthToken | null> {
  const key = cfg.tokenCacheKey || `${cfg.grant}_${cfg.clientId}_${cfg.tokenUrl}`;
  const cached = getOAuthToken(key);
  if (cached && !isExpired(cached)) return cached;
  if (cached?.refreshToken) {
    const refreshed = await refreshToken(cfg, cached.refreshToken);
    if (refreshed) {
      setOAuthToken(key, refreshed);
      return refreshed;
    }
  }
  if (cfg.grant === 'client_credentials' || cfg.grant === 'password') {
    const fresh = await fetchToken(cfg);
    if (fresh) setOAuthToken(key, fresh);
    return fresh;
  }
  // authorization_code requires user-driven flow; if no token is cached we
  // can't fetch one server-side. Return null so the request fails clearly.
  return null;
}

function isExpired(t: OAuthToken): boolean {
  if (!t.expiresAt) return false;
  // 30s safety window
  return Date.now() + 30_000 >= t.expiresAt;
}

async function fetchToken(cfg: OAuth2Config): Promise<OAuthToken | null> {
  const body = new URLSearchParams();
  body.set('grant_type', cfg.grant);
  if (cfg.scope) body.set('scope', cfg.scope);
  if (cfg.grant === 'password') {
    body.set('username', cfg.username ?? '');
    body.set('password', cfg.password ?? '');
  }
  return tokenRequest(cfg, body);
}

async function refreshToken(cfg: OAuth2Config, refresh: string): Promise<OAuthToken | null> {
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refresh);
  if (cfg.scope) body.set('scope', cfg.scope);
  return tokenRequest(cfg, body);
}

async function tokenRequest(cfg: OAuth2Config, body: URLSearchParams): Promise<OAuthToken | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (cfg.clientId && cfg.clientSecret) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  } else if (cfg.clientId) {
    body.set('client_id', cfg.clientId);
  }
  const res = await fetch(cfg.tokenUrl, { method: 'POST', headers, body });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type ?? 'Bearer',
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

/**
 * Build the authorize URL for the auth-code grant (with PKCE).
 * Returns the URL to send the user to + the verifier the renderer should
 * persist (and pass back when exchanging the code).
 */
export function buildAuthCodeUrl(cfg: OAuth2Config): { url: string; verifier: string } {
  const verifier = randomString(64);
  const challenge = pkceChallenge(verifier);
  const u = new URL(cfg.authUrl ?? '');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  if (cfg.redirectUri) u.searchParams.set('redirect_uri', cfg.redirectUri);
  if (cfg.scope) u.searchParams.set('scope', cfg.scope);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', randomString(16));
  return { url: u.toString(), verifier };
}

export async function exchangeAuthCode(
  cfg: OAuth2Config,
  code: string,
  verifier: string,
): Promise<OAuthToken | null> {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', cfg.clientId);
  if (cfg.redirectUri) body.set('redirect_uri', cfg.redirectUri);
  body.set('code_verifier', verifier);
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (cfg.clientSecret) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  }
  const res = await fetch(cfg.tokenUrl, { method: 'POST', headers, body });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  if (!data.access_token) return null;
  const token: OAuthToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type ?? 'Bearer',
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
  setOAuthToken(cfg.tokenCacheKey, token);
  return token;
}

function randomString(len: number): string {
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  return base64Url(Buffer.from(arr));
}
function pkceChallenge(verifier: string): string {
  // S256: sha256(verifier) → base64url
  // Avoiding extra deps — Node's crypto is in scope here.
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return base64Url(createHash('sha256').update(verifier).digest());
}
function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
