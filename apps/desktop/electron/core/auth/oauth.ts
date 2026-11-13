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

/**
 * Cache key for the persisted token. Requests created in the UI get a random
 * `tokenCacheKey`; imported / older rows may have an empty one, so fall back
 * to a deterministic key. Must be used by every read AND write so the
 * auth-code exchange and `ensureToken` agree on where the token lives.
 */
function cacheKey(cfg: OAuth2Config): string {
  return cfg.tokenCacheKey || `${cfg.grant}_${cfg.clientId}_${cfg.tokenUrl}`;
}

function requireTokenUrl(cfg: OAuth2Config): string {
  const url = (cfg.tokenUrl ?? '').trim();
  if (!url) throw new Error('OAuth 2.0: Token URL is required.');
  try {
    new URL(url);
  } catch {
    throw new Error(`OAuth 2.0: Token URL is not a valid URL: ${url}`);
  }
  return url;
}

/** Returns a still-valid access token, fetching/refreshing if needed. */
export async function ensureToken(cfg: OAuth2Config): Promise<OAuthToken | null> {
  const key = cacheKey(cfg);
  const cached = getOAuthToken(key);
  if (cached && !isExpired(cached)) return cached;
  if (cached?.refreshToken) {
    // A failed refresh is not fatal: for machine grants we re-fetch below,
    // for auth-code the user has to re-authorize (null → clear message).
    try {
      const refreshed = await refreshToken(cfg, cached.refreshToken);
      if (refreshed) {
        setOAuthToken(key, refreshed);
        return refreshed;
      }
    } catch (err) {
      console.warn('[oauth] refresh failed:', (err as Error).message);
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
  const tokenUrl = requireTokenUrl(cfg);
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
  const res = await fetch(tokenUrl, { method: 'POST', headers, body });
  return parseTokenResponse(res);
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Turn a token-endpoint response into an OAuthToken, or throw with the
 * provider's own error text so the user sees *why* (invalid_client, bad
 * scope, …) instead of a generic "no token".
 */
async function parseTokenResponse(res: Response): Promise<OAuthToken> {
  const text = await res.text();
  let data: TokenResponse = {};
  try {
    data = JSON.parse(text) as TokenResponse;
  } catch {
    // Some providers (e.g. older GitHub) answer form-encoded.
    data = Object.fromEntries(new URLSearchParams(text)) as TokenResponse;
  }
  if (!res.ok || data.error || !data.access_token) {
    const detail =
      data.error_description ??
      data.error ??
      (res.ok ? 'response did not contain access_token' : text.slice(0, 200) || res.statusText);
    throw new Error(`OAuth 2.0 token request failed (${res.status}): ${detail}`);
  }
  const expiresIn = Number(data.expires_in);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type ?? 'Bearer',
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
  };
}

/**
 * Build the authorize URL for the auth-code grant (with PKCE).
 * Returns the URL to send the user to + the verifier the renderer should
 * persist (and pass back when exchanging the code).
 */
export function buildAuthCodeUrl(cfg: OAuth2Config): { url: string; verifier: string; state: string } {
  const authUrl = (cfg.authUrl ?? '').trim();
  if (!authUrl) throw new Error('OAuth 2.0: Authorize URL is required for the authorization code grant.');
  if (!cfg.clientId) throw new Error('OAuth 2.0: Client ID is required.');
  let u: URL;
  try {
    u = new URL(authUrl);
  } catch {
    throw new Error(`OAuth 2.0: Authorize URL is not a valid URL: ${authUrl}`);
  }
  const verifier = randomString(64);
  const challenge = pkceChallenge(verifier);
  const state = randomString(16);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  if (cfg.redirectUri) u.searchParams.set('redirect_uri', cfg.redirectUri.trim());
  if (cfg.scope) u.searchParams.set('scope', cfg.scope);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', state);
  return { url: u.toString(), verifier, state };
}

export async function exchangeAuthCode(
  cfg: OAuth2Config,
  code: string,
  verifier: string,
): Promise<OAuthToken | null> {
  const tokenUrl = requireTokenUrl(cfg);
  if (!code) throw new Error('OAuth 2.0: authorization code is empty.');
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', cfg.clientId);
  if (cfg.redirectUri) body.set('redirect_uri', cfg.redirectUri.trim());
  body.set('code_verifier', verifier);
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (cfg.clientSecret) {
    headers.Authorization =
      'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  }
  const res = await fetch(tokenUrl, { method: 'POST', headers, body });
  const token = await parseTokenResponse(res);
  // Same key `ensureToken` reads — previously this wrote to the raw (possibly
  // empty) tokenCacheKey, so a successful exchange was never found at send time.
  setOAuthToken(cacheKey(cfg), token);
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
