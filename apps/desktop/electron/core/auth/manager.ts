// Auth manager — talks to backend, stores session in keychain.
//
// Single source of truth for "am I logged in" in the main process.
// Used by IPC handlers and by sync engine.

import { app } from 'electron';
import os from 'node:os';
import { setSecret, getSecret, deleteSecret } from './keychain';
import { setState, getState, deleteState } from '../db/queries';

const SESSION_ACCOUNT = 'session.current';
const STATE_USER_KEY = 'auth.current_user';

interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: CurrentUser | null;
  sessionToken: string | null;
  deviceId: string | null;
}

const state: AuthState = {
  user: null,
  sessionToken: null,
  deviceId: null,
};

export function getApiBase(): string {
  // Explicit env override always wins. Otherwise pick the dev backend in
  // development and the production URL in packaged builds.
  const override = process.env.VITE_API_URL ?? process.env.VOLT_API_URL;
  if (override) return override;
  return app.isPackaged ? 'https://api.volt.dev' : 'http://localhost:4000';
}

/**
 * On app boot, restore session from keychain and verify via /auth/me.
 * If valid → state populated; if invalid → cleared.
 */
export async function restoreSession(): Promise<{ user: CurrentUser } | null> {
  const token = await getSecret(SESSION_ACCOUNT);
  if (!token) return null;

  state.sessionToken = token;
  try {
    const res = await fetch(`${getApiBase()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Token invalid — clean up
      await clearSession();
      return null;
    }
    const me = (await res.json()) as { id: string; email: string; name: string };
    state.user = me;
    setState(STATE_USER_KEY, JSON.stringify(me));
    return { user: me };
  } catch (err) {
    // Network failure — keep token; treat as "offline with previous identity"
    const cached = getState(STATE_USER_KEY);
    if (cached) {
      try {
        state.user = JSON.parse(cached);
        return { user: state.user! };
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

export async function login(email: string, password: string) {
  console.log("data sending1111")
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      device: deviceInfo(),
    }),
  });

  console.log("data sending")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Login failed (${res.status})`);
  }
  const data = (await res.json()) as {
    sessionId: string;
    user: CurrentUser;
    device?: { id: string };
  };

  state.user = data.user;
  state.sessionToken = data.sessionId;
  state.deviceId = data.device?.id ?? null;

  await setSecret(SESSION_ACCOUNT, data.sessionId);
  setState(STATE_USER_KEY, JSON.stringify(data.user));
  return data;
}

export async function register(input: { email: string; name: string; password: string }) {
  const res = await fetch(`${getApiBase()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Registration failed (${res.status})`);
  }
  // After register, log in to get session
  return login(input.email, input.password);
}

export async function logout() {
  if (state.sessionToken) {
    try {
      await fetch(`${getApiBase()}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.sessionToken}` },
      });
    } catch {
      /* ignore network errors on logout */
    }
  }
  await clearSession();
}

export function currentUser(): CurrentUser | null {
  return state.user;
}

export function currentSessionToken(): string | null {
  return state.sessionToken;
}

/**
 * Make an authenticated API call to the backend. Throws on non-2xx.
 */
export async function authedFetch(
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!state.sessionToken) {
    throw new Error('Not logged in.');
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${state.sessionToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${getApiBase()}${pathname}`, { ...init, headers });
}

// ─────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────

async function clearSession() {
  state.user = null;
  state.sessionToken = null;
  state.deviceId = null;
  await deleteSecret(SESSION_ACCOUNT);
  deleteState(STATE_USER_KEY);
}

function deviceInfo() {
  const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
  const label = `${os.hostname()} (${platform})`;
  return {
    label,
    platform: platform as 'macos' | 'windows' | 'linux',
    appVersion: app.getVersion(),
  };
}
