import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { useModals } from '@/stores/modals';
import { voltApi, onVoltEvent } from '@/lib/volt-api';
import { cn } from '@/lib/util';

interface Message {
  ts: number;
  direction: 'in' | 'out';
  text: string;
}

type State = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

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
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = onVoltEvent((evt: unknown) => {
      const e = evt as { kind?: string; connectionId?: string; state?: string; direction?: 'in' | 'out'; text?: string; timestamp?: number; code?: number; reason?: string };
      if (!e.kind || !e.connectionId) return;
      if (e.connectionId !== connectionId) return;
      if (e.kind === 'ws:state') {
        if (e.state === 'open') setState('open');
        else if (e.state === 'closed') {
          setState('closed');
          setMessages((m) => [
            ...m,
            { ts: Date.now(), direction: 'in', text: `— closed${e.code ? ` (${e.code})` : ''}${e.reason ? `: ${e.reason}` : ''} —` },
          ]);
        } else if (e.state === 'error') setState('error');
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
    setState('connecting');
    setMessages([]);
    const r = (await voltApi['ws:open']({ url })) as {
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
    await voltApi['ws:close']({ connectionId });
    setState('closed');
    setConnectionId(null);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!connectionId || !outgoing) return;
    await voltApi['ws:send']({ connectionId, text: outgoing });
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
      <div className="flex h-[28rem] flex-col gap-2">
        {/* URL bar */}
        <form onSubmit={connect} className="flex items-center gap-2">
          <HighlightedInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="wss://example.com/socket"
            className="flex-1"
          />
          {state === 'open' || state === 'connecting' ? (
            <Button onClick={disconnect} variant="danger" size="md" type="button">
              <X size={13} />
              Disconnect
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
        </div>

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

function stateColor(s: State): string {
  if (s === 'open') return 'bg-success/20 text-success';
  if (s === 'error') return 'bg-error/20 text-error';
  if (s === 'connecting') return 'bg-accent/20 text-accent';
  return 'bg-bg text-text-muted';
}
