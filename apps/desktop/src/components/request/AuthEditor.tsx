import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

type Auth =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; key: string; value: string; placement: 'header' | 'query' };

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
