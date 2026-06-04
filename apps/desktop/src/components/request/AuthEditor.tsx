import { useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { voltApi } from '@/lib/volt-api';

type Auth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; placement: 'header' | 'query' }
  | {
      type: 'oauth2';
      grant: 'client_credentials' | 'password' | 'authorization_code';
      tokenUrl: string;
      authUrl?: string;
      redirectUri?: string;
      clientId: string;
      clientSecret: string;
      scope?: string;
      username?: string;
      password?: string;
      headerPrefix: string;
      tokenCacheKey: string;
    };

interface Props {
  auth: Auth;
  onChange: (auth: Auth) => void;
}

export function AuthEditor({ auth, onChange }: Props) {
  function setType(t: Auth['type']) {
    switch (t) {
      case 'none':
        return onChange({ type: 'none' });
      case 'bearer':
        return onChange({ type: 'bearer', token: '' });
      case 'basic':
        return onChange({ type: 'basic', username: '', password: '' });
      case 'apiKey':
        return onChange({ type: 'apiKey', key: '', value: '', placement: 'header' });
      case 'oauth2':
        return onChange({
          type: 'oauth2',
          grant: 'client_credentials',
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          headerPrefix: 'Bearer',
          tokenCacheKey: `oauth_${Math.random().toString(36).slice(2, 10)}`,
        });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <span className="text-xs text-text-muted">Type</span>
        <Select
          value={auth.type}
          onChange={(e) => setType(e.target.value as Auth['type'])}
          options={[
            { value: 'none', label: 'No auth' },
            { value: 'bearer', label: 'Bearer token' },
            { value: 'basic', label: 'Basic auth' },
            { value: 'apiKey', label: 'API key' },
            { value: 'oauth2', label: 'OAuth 2.0' },
          ]}
          className="w-40"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {auth.type === 'none' && (
          <p className="text-xs text-text-muted">No authentication is sent with this request.</p>
        )}

        {auth.type === 'bearer' && (
          <Field label="Token">
            <Input
              type="text"
              value={auth.token}
              onChange={(e) => onChange({ ...auth, token: e.target.value })}
              placeholder="e.g. {{accessToken}}"
            />
          </Field>
        )}

        {auth.type === 'basic' && (
          <>
            <Field label="Username">
              <Input
                value={auth.username}
                onChange={(e) => onChange({ ...auth, username: e.target.value })}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={auth.password}
                onChange={(e) => onChange({ ...auth, password: e.target.value })}
              />
            </Field>
          </>
        )}

        {auth.type === 'oauth2' && <OAuthPanel auth={auth} onChange={onChange} />}

        {auth.type === 'apiKey' && (
          <>
            <Field label="Key">
              <Input
                value={auth.key}
                onChange={(e) => onChange({ ...auth, key: e.target.value })}
                placeholder="X-API-Key"
              />
            </Field>
            <Field label="Value">
              <Input
                value={auth.value}
                onChange={(e) => onChange({ ...auth, value: e.target.value })}
                placeholder="{{apiKey}}"
              />
            </Field>
            <Field label="Add to">
              <Select
                value={auth.placement}
                onChange={(e) =>
                  onChange({ ...auth, placement: e.target.value as 'header' | 'query' })
                }
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query string' },
                ]}
                className="w-40"
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-[100px_1fr] items-center gap-2">
      <label className="text-xs text-text-muted">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function OAuthPanel({
  auth,
  onChange,
}: {
  auth: Extract<Auth, { type: 'oauth2' }>;
  onChange: (a: Auth) => void;
}) {
  const [verifier, setVerifier] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function fetchToken() {
    setBusy(true);
    setStatus(null);
    try {
      const r = (await voltApi['oauth:ensureToken'](auth as never)) as {
        ok: boolean;
        accessToken?: string;
        expiresAt?: number;
        error?: string;
      };
      if (!r.ok) setStatus(`Failed: ${r.error}`);
      else
        setStatus(
          `Token cached${r.expiresAt ? ` (expires ${new Date(r.expiresAt).toLocaleString()})` : ''}.`,
        );
    } finally {
      setBusy(false);
    }
  }

  async function openAuthUrl() {
    setBusy(true);
    setStatus(null);
    try {
      const r = (await voltApi['oauth:getAuthUrl'](auth as never)) as { url: string; verifier: string };
      setVerifier(r.verifier);
      await voltApi['app:openExternal']({ url: r.url });
      setStatus('Browser opened. Paste the returned code below.');
    } finally {
      setBusy(false);
    }
  }

  async function exchange() {
    if (!verifier || !authCode.trim()) return;
    setBusy(true);
    try {
      const r = (await voltApi['oauth:exchangeCode']({
        ...(auth as Record<string, unknown>),
        code: authCode.trim(),
        verifier,
      } as never)) as { ok: boolean; error?: string };
      setStatus(r.ok ? 'Token cached.' : `Failed: ${r.error}`);
      if (r.ok) setAuthCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Field label="Grant type">
        <Select
          value={auth.grant}
          onChange={(e) => onChange({ ...auth, grant: e.target.value as typeof auth.grant })}
          options={[
            { value: 'client_credentials', label: 'Client credentials' },
            { value: 'password', label: 'Password' },
            { value: 'authorization_code', label: 'Authorization code (PKCE)' },
          ]}
          className="w-56"
        />
      </Field>
      <Field label="Token URL">
        <Input
          value={auth.tokenUrl}
          onChange={(e) => onChange({ ...auth, tokenUrl: e.target.value })}
          placeholder="https://provider.example.com/oauth/token"
        />
      </Field>
      {auth.grant === 'authorization_code' && (
        <>
          <Field label="Authorize URL">
            <Input
              value={auth.authUrl ?? ''}
              onChange={(e) => onChange({ ...auth, authUrl: e.target.value })}
              placeholder="https://provider.example.com/oauth/authorize"
            />
          </Field>
          <Field label="Redirect URI">
            <Input
              value={auth.redirectUri ?? ''}
              onChange={(e) => onChange({ ...auth, redirectUri: e.target.value })}
              placeholder="http://localhost:8765/callback"
            />
          </Field>
        </>
      )}
      <Field label="Client ID">
        <Input
          value={auth.clientId}
          onChange={(e) => onChange({ ...auth, clientId: e.target.value })}
        />
      </Field>
      <Field label="Client secret">
        <Input
          type="password"
          value={auth.clientSecret}
          onChange={(e) => onChange({ ...auth, clientSecret: e.target.value })}
        />
      </Field>
      <Field label="Scope">
        <Input
          value={auth.scope ?? ''}
          onChange={(e) => onChange({ ...auth, scope: e.target.value })}
          placeholder="read write"
        />
      </Field>
      {auth.grant === 'password' && (
        <>
          <Field label="Username">
            <Input
              value={auth.username ?? ''}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={auth.password ?? ''}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
            />
          </Field>
        </>
      )}
      <Field label="Header prefix">
        <Input
          value={auth.headerPrefix}
          onChange={(e) => onChange({ ...auth, headerPrefix: e.target.value })}
          placeholder="Bearer"
        />
      </Field>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        {auth.grant === 'authorization_code' ? (
          <>
            <Button type="button" variant="primary" onClick={openAuthUrl} disabled={busy}>
              Open authorize URL
            </Button>
            {verifier && (
              <div className="flex gap-2">
                <Input
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code"
                />
                <Button variant="primary" onClick={exchange} disabled={busy || !authCode.trim()}>
                  Exchange
                </Button>
              </div>
            )}
          </>
        ) : (
          <Button type="button" variant="primary" onClick={fetchToken} disabled={busy}>
            Fetch token now
          </Button>
        )}
        {status && <p className="text-[11px] text-text-muted">{status}</p>}
      </div>
    </>
  );
}
