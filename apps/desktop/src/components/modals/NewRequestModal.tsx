import { useState, type FormEvent } from 'react';
import { Globe, Plug, Hexagon, Network } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useCreateRequest } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { cn, methodColorClass } from '@/lib/util';

type Kind = 'http' | 'graphql' | 'websocket' | 'grpc';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface KindMeta {
  id: Kind;
  label: string;
  sub: string;
  icon: React.ReactNode;
  available: boolean;
  /** Why the user can't pick this one (shown on hover). */
  hint?: string;
}

const KINDS: KindMeta[] = [
  {
    id: 'http',
    label: 'HTTP',
    sub: 'REST / plain HTTP — GET, POST, etc.',
    icon: <Globe size={16} />,
    available: true,
  },
  {
    id: 'graphql',
    label: 'GraphQL',
    sub: 'POST a query + variables JSON envelope.',
    icon: <Hexagon size={16} />,
    available: true,
  },
  {
    id: 'websocket',
    label: 'WebSocket',
    sub: 'Live connection — opens the scratchpad.',
    icon: <Plug size={16} />,
    available: true,
  },
  {
    id: 'grpc',
    label: 'gRPC',
    sub: 'Unary calls via .proto — streaming + reflection coming soon.',
    icon: <Network size={16} />,
    available: true,
  },
];

/**
 * New Request entry-point. The user picks a request kind first (HTTP /
 * GraphQL / WebSocket / gRPC); the form below shows just the inputs that
 * kind needs. WebSocket opens the live scratchpad immediately because Volt
 * doesn't yet have a "saved WS request" type.
 */
export function NewRequestModal() {
  const { current, close, open } = useModals();
  const isOpen = current.kind === 'new-request';
  const collectionId = current.kind === 'new-request' ? current.collectionId : null;

  const { workspaceId, selectRequest } = useSelection();
  const createRequest = useCreateRequest();

  const [kind, setKind] = useState<Kind>('http');
  const [name, setName] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    if (kind === 'websocket') {
      // We don't yet persist WS requests — hand the user off to the
      // scratchpad (URL will be re-entered there; non-blocking).
      close();
      open({ kind: 'websocket' });
      return;
    }

    if (!name.trim()) return;
    const base = {
      workspaceId,
      collectionId,
      name: name.trim(),
      url: url.trim(),
    } as Parameters<typeof createRequest.mutateAsync>[0];

    // On failure the hook toasts; we get null back and keep the modal open.
    const create = (input: Parameters<typeof createRequest.mutateAsync>[0]) =>
      createRequest.mutateAsync(input).catch(() => null);

    let r;
    if (kind === 'graphql') {
      r = await create({
        ...base,
        method: 'POST',
        // bodyType + body shape are stripped by the create contract's optional
        // partials and passed through to the IPC.
        bodyType: 'graphql',
        body: { type: 'graphql', query: '', variables: '' },
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      } as never);
    } else if (kind === 'grpc') {
      // gRPC requests reuse the ApiRequest row: `url` is repurposed as the
      // server address (e.g., "localhost:50051") so it shows up in the tab
      // strip; `method` is a no-op sentinel. The actual call details live
      // in body.* (service, method, message, metadata, proto path).
      r = await create({
        ...base,
        method: 'POST',
        url: url.trim() || 'localhost:50051',
        bodyType: 'grpc',
        body: {
          type: 'grpc',
          address: url.trim() || 'localhost:50051',
          protoPath: '',
          service: '',
          method: '',
          message: '{}',
          metadata: [],
        },
      } as never);
    } else {
      r = await create({
        ...base,
        method,
      });
    }
    if (!r) return;
    selectRequest(r.id);
    reset();
    close();
  }

  function reset() {
    setName('');
    setUrl('');
    setMethod('GET');
    setKind('http');
  }

  const httpLike = kind === 'http' || kind === 'graphql' || kind === 'grpc';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          close();
        }
      }}
      title="New request"
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Kind picker — two-column card grid */}
        <div>
          <label className="mb-1 block text-xs text-text-muted">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => k.available && setKind(k.id)}
                disabled={!k.available}
                title={k.hint}
                className={cn(
                  'flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  kind === k.id && k.available
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:bg-bg-elevated',
                  !k.available && 'cursor-not-allowed opacity-50',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    kind === k.id && k.available ? 'text-accent' : 'text-text-muted',
                  )}
                >
                  {k.icon}
                </span>
                <span className="flex-1">
                  <span className="block text-13 font-medium text-text">
                    {k.label}
                    {!k.available && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-text-muted">
                        soon
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-text-muted">{k.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Kind-specific fields */}
        {kind === 'websocket' ? (
          <div className="rounded-md border border-border bg-bg-elevated p-3 text-xs text-text-muted">
            WebSocket connections aren't saved as requests yet — clicking{' '}
            <span className="text-text">Open scratchpad</span> launches a live connection panel.
            (Saving WS requests is on the v1.1 list.)
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'graphql' ? 'List users' : 'Get users'}
                autoFocus
                required
              />
            </div>

            {httpLike && (
              <div className="flex gap-2">
                {kind === 'http' && (
                  <div className="w-28">
                    <label className="mb-1 block text-xs text-text-muted">Method</label>
                    <Select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      options={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
                      className={cn('font-mono font-semibold', methodColorClass(method))}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-text-muted">
                    {kind === 'grpc'
                      ? 'Server address'
                      : kind === 'graphql'
                        ? 'URL (POST endpoint)'
                        : 'URL (optional)'}
                  </label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={
                      kind === 'grpc'
                        ? 'localhost:50051'
                        : kind === 'graphql'
                          ? 'https://api.example.com/graphql'
                          : 'https://api.example.com/users'
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={
              (kind !== 'websocket' && !name.trim()) || createRequest.isPending
            }
          >
            {kind === 'websocket' ? 'Open scratchpad' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
