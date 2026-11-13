import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronRight, Send, X } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { KeyValueEditor, type KeyValueRow } from '@/components/request/KeyValueEditor';
import { useActiveEnv, useEnvironments, useGlobals } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { voltApi, onVoltEvent } from '@/lib/volt-api';
import { buildVariableMap, substituteVariables } from '@/lib/variables';
import { cn } from '@/lib/util';

interface Message {
  ts: number;
  direction: 'in' | 'out';
  text: string;
}

type State = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';

/**
 * Lightweight WebSocket scratchpad. Opens via the command palette
 * ("WebSocket scratch"). Persistent connection lives in main; messages flow
 * back over the `volt:event` channel.
 */
export function WebSocketModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'websocket';

  const [url, setUrl] = useState('wss://echo.websocket.org/');
  const [state, setState] = useState<State>('idle');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [headers, setHeaders] = useState<KeyValueRow[]>([]);
  const [protocols, setProtocols] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  // {{variable}} resolution: globals + active environment of the current
  // workspace (the scratchpad belongs to no collection, so no collection chain).
  const { workspaceId } = useSelection();
  const { data: activeEnv } = useActiveEnv(workspaceId);
  const { data: environments } = useEnvironments(workspaceId);
  const { data: globals } = useGlobals();
  const variableMap = useMemo(() => {
    const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
    return buildVariableMap(globals, env, []);
  }, [globals, environments, activeEnv?.environmentId]);
  const resolve = (s: string) => substituteVariables(s, variableMap);

  useEffect(() => {
    const off = onVoltEvent((evt: unknown) => {
      const e = evt as { kind?: string; connectionId?: string; state?: string; direction?: 'in' | 'out'; text?: string; timestamp?: number; code?: number; reason?: string; protocol?: string };
      if (!e.kind || !e.connectionId) return;
      if (e.connectionId !== connectionId) return;
      if (e.kind === 'ws:state') {
        if (e.state === 'open') {
          setState('open');
          setMessages((m) => [
            ...m,
            { ts: Date.now(), direction: 'in', text: `— connected${e.protocol ? ` (subprotocol: ${e.protocol})` : ''} —` },
          ]);
        } else if (e.state === 'closed') {
          // Keep the 'error' badge if the socket failed; a 1006 close always
          // follows an error and would otherwise hide it.
          setState((s) => (s === 'error' ? s : 'closed'));
          setMessages((m) => [
            ...m,
            { ts: Date.now(), direction: 'in', text: `— closed${e.code ? ` (${e.code}${closeCodeName(e.code)})` : ''}${e.reason ? `: ${e.reason}` : ''} —` },
          ]);
        } else if (e.state === 'error') {
          setState('error');
          setMessages((m) => [
            ...m,
            { ts: Date.now(), direction: 'in', text: `Error: ${e.reason ?? 'WebSocket error'}` },
          ]);
        }
      } else if (e.kind === 'ws:message') {
        setMessages((m) => [
          ...m,
          { ts: e.timestamp ?? Date.now(), direction: e.direction ?? 'in', text: e.text ?? '' },
        ]);
      }
    });
    return off;
  }, [connectionId]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function connect(e: FormEvent) {
    e.preventDefault();
    if (state === 'connecting') return;
    setState('connecting');
    setMessages([]);
    setConnectionId(null);
    const hdrs: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled === false || !h.key.trim()) continue;
      hdrs[resolve(h.key.trim())] = resolve(h.value);
    }
    const protos = resolve(protocols)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const r = (await voltApi['ws:open']({
      url: resolve(url.trim()),
      ...(Object.keys(hdrs).length > 0 ? { headers: hdrs } : {}),
      ...(protos.length > 0 ? { protocols: protos } : {}),
    })) as {
      connectionId: string;
      ok: boolean;
      error?: string;
    };
    if (!r.ok) {
      setState('error');
      setMessages([{ ts: Date.now(), direction: 'in', text: `Error: ${r.error}` }]);
      return;
    }
    setConnectionId(r.connectionId);
  }

  async function disconnect() {
    if (!connectionId) return;
    // Keep the connectionId so the final close frame (code + reason) still
    // reaches the log; the state flips to 'closed' when it arrives. Some
    // servers take seconds to answer the closing handshake.
    setState('closing');
    await voltApi['ws:close']({ connectionId });
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!connectionId || !outgoing) return;
    const r = (await voltApi['ws:send']({ connectionId, text: resolve(outgoing) })) as { ok: boolean; error?: string };
    if (!r.ok) {
      setMessages((m) => [...m, { ts: Date.now(), direction: 'in', text: `Error: ${r.error ?? 'send failed'}` }]);
      return;
    }
    setOutgoing('');
  }

  function reset() {
    setMessages([]);
    setConnectionId(null);
    setState('idle');
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          if (connectionId) voltApi['ws:close']({ connectionId });
          reset();
          close();
        }
      }}
      title="WebSocket"
      className="max-w-3xl"
    >
      {/* No VariablesProvider here on purpose: it would re-point the global
          CodeMirror var-highlight resolver (a singleton) at this modal's map
          and paint collection variables red in the request editor behind. */}
      <div className="flex h-[30rem] flex-col gap-2">
        {/* URL bar */}
        <form onSubmit={connect} className="flex items-center gap-2">
          <HighlightedInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="wss://example.com/socket"
            className="flex-1"
          />
          {state === 'open' || state === 'connecting' || state === 'closing' ? (
            <Button onClick={disconnect} variant="danger" size="md" type="button" disabled={state === 'closing'}>
              <X size={13} />
              {state === 'closing' ? 'Closing…' : 'Disconnect'}
            </Button>
          ) : (
            <Button variant="primary" size="md" type="submit">
              Connect
            </Button>
          )}
        </form>

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className={cn('rounded px-1.5 py-0.5', stateColor(state))}>{state}</span>
          {connectionId && <code className="font-mono">{connectionId}</code>}
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="ml-auto flex items-center gap-1 hover:text-text"
          >
            <ChevronRight size={11} className={cn('transition-transform', showOptions && 'rotate-90')} />
            Headers{enabledHeaderCount(headers) > 0 ? ` (${enabledHeaderCount(headers)})` : ''} · Subprotocols
          </button>
        </div>

        {/* Handshake options — applied on the next Connect */}
        {showOptions && (
          <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded border border-border p-1.5 text-xs">
            <label className="flex items-center gap-2 text-[11px] text-text-muted">
              Subprotocols
              <HighlightedInput
                value={protocols}
                onChange={(e) => setProtocols(e.target.value)}
                placeholder="comma-separated, e.g. graphql-ws, json"
                className="flex-1"
                disabled={state === 'open' || state === 'connecting'}
              />
            </label>
            <KeyValueEditor
              rows={headers}
              onChange={setHeaders}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
              suggest="headers"
              readOnly={state === 'open' || state === 'connecting'}
            />
          </div>
        )}

        {/* Message log */}
        <div className="min-h-0 flex-1 overflow-auto rounded border border-border bg-bg-elevated p-2 text-xs font-mono">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="w-16 text-[10px] text-text-muted">
                {new Date(m.ts).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'w-6 text-[10px] font-semibold',
                  m.direction === 'in' ? 'text-success' : 'text-accent',
                )}
              >
                {m.direction === 'in' ? '←' : '→'}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all text-text">{m.text}</span>
            </div>
          ))}
          <div ref={logEnd} />
        </div>

        {/* Send composer */}
        <form onSubmit={send} className="flex items-center gap-2">
          <HighlightedInput
            value={outgoing}
            onChange={(e) => setOutgoing(e.target.value)}
            placeholder="Type a message or paste JSON…"
            className="flex-1"
            disabled={state !== 'open'}
          />
          <Button variant="primary" size="md" type="submit" disabled={state !== 'open' || !outgoing}>
            <Send size={13} />
            Send
          </Button>
        </form>
      </div>
    </Dialog>
  );
}

function enabledHeaderCount(rows: KeyValueRow[]): number {
  return rows.filter((r) => r.enabled !== false && r.key.trim()).length;
}

const CLOSE_CODES: Record<number, string> = {
  1000: 'normal closure',
  1001: 'going away',
  1002: 'protocol error',
  1003: 'unsupported data',
  1005: 'no status received',
  1006: 'abnormal closure',
  1007: 'invalid payload',
  1008: 'policy violation',
  1009: 'message too big',
  1010: 'missing extension',
  1011: 'internal error',
  1012: 'service restart',
  1013: 'try again later',
  1015: 'TLS handshake failed',
};

function closeCodeName(code: number): string {
  const name = CLOSE_CODES[code];
  return name ? ` ${name}` : '';
}

function stateColor(s: State): string {
  if (s === 'open') return 'bg-success/20 text-success';
  if (s === 'error') return 'bg-error/20 text-error';
  if (s === 'connecting') return 'bg-accent/20 text-accent';
  return 'bg-bg text-text-muted';
}
