// Dedicated editor for gRPC requests. Replaces the standard RequestEditor +
// ResponseViewer pair in Workspace.tsx when `saved.body.type === 'grpc'`.
// Supports unary calls (grpc:invoke) and all three streaming modes —
// server-streaming, client-streaming, and bidirectional (grpc:openStream).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileCode, FolderOpen, Loader2, Plug, RefreshCw, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { KeyValueEditor } from '@/components/request/KeyValueEditor';
import { CodeEditor } from '@/components/request/CodeEditor';
import { useRequest, useUpdateRequest } from '@/hooks/useData';
import { useHotkey } from '@/hooks/useHotkey';
import { onVoltEvent, voltApi } from '@/lib/volt-api';
import { cn, formatBytes, formatDuration } from '@/lib/util';

interface Props {
  requestId: string;
  workspaceId: string;
}

interface GrpcBody {
  type: 'grpc';
  address: string;
  protoPath: string;
  service: string;
  method: string;
  message: string;
  metadata: Array<{ id: string; key: string; value: string; enabled: boolean }>;
}

interface ServiceInfo {
  name: string;
  methods: Array<{
    name: string;
    requestStream: boolean;
    responseStream: boolean;
    requestType: string;
    responseType: string;
  }>;
}

interface InvokeOk {
  ok: true;
  response: unknown;
  durationMs: number;
}
interface InvokeFail {
  ok: false;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
}
type InvokeResult = InvokeOk | InvokeFail;

const EMPTY_BODY: GrpcBody = {
  type: 'grpc',
  address: 'localhost:50051',
  protoPath: '',
  service: '',
  method: '',
  message: '{}',
  metadata: [],
};

export function GrpcRequestEditor({ requestId }: Props) {
  const { data: saved, isLoading } = useRequest(requestId);
  const updateRequest = useUpdateRequest();

  // Local working copy of the gRPC body. Auto-saves to DB on a 500 ms debounce
  // (mirrors the pattern used by ExampleEditor in RequestEditor.tsx).
  const [body, setBody] = useState<GrpcBody>(EMPTY_BODY);
  // Always-current body for flushes that run from stale closures (unmount,
  // debounce timers). Without it the unmount flush captured the initial
  // EMPTY_BODY and overwrote the saved request with defaults.
  const bodyRef = useRef<GrpcBody>(EMPTY_BODY);
  bodyRef.current = body;
  const nameRef = useRef<string | null>(null);
  // Updated in an effect (not during render) so the cleanup that runs when
  // requestId changes still sees the *previous* id and flushes to that row.
  const requestIdRef = useRef(requestId);
  const updateRequestRef = useRef(updateRequest);
  updateRequestRef.current = updateRequest;
  const lastLoadedRef = useRef<string | null>(null);
  const pendingSaveTimerRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving'>('idle');

  // Loaded services from the proto file. Cleared when the path changes; the
  // user must click "Load" to refresh (or it auto-loads on first mount when
  // a path is already stored on the request).
  const [services, setServices] = useState<ServiceInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [name, setName] = useState('');

  // ── Streaming state ─────────────────────────────────────────────
  type StreamState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  type StreamMode = 'server' | 'client' | 'bidi' | null;
  type StreamLogEntry =
    | { id: number; kind: 'msg'; direction: 'in' | 'out'; text: string; timestamp: number }
    | { id: number; kind: 'state'; state: 'open' | 'closed' | 'error' | 'status'; code?: string; details?: string | null; timestamp: number };

  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [streamMode, setStreamMode] = useState<StreamMode>(null);
  const [streamLog, setStreamLog] = useState<StreamLogEntry[]>([]);
  const streamIdRef = useRef<string | null>(null);
  const logSeqRef = useRef(0);

  // Hydrate working copy from the saved row when the requestId changes.
  useEffect(() => {
    if (!saved) return;
    if (lastLoadedRef.current === saved.id) return;
    lastLoadedRef.current = saved.id;
    setName(saved.name);
    const b = saved.body as Partial<GrpcBody> | undefined;
    setBody({
      type: 'grpc',
      address: b?.address ?? saved.url ?? 'localhost:50051',
      protoPath: b?.protoPath ?? '',
      service: b?.service ?? '',
      method: b?.method ?? '',
      message: b?.message ?? '{}',
      metadata: b?.metadata ?? [],
    });
    // Clear any previous-request state.
    setServices(null);
    setLoadError(null);
    setResult(null);
  }, [saved]);

  const flushSave = useCallback(
    (patch: Partial<GrpcBody> & { name?: string }) => {
      if (pendingSaveTimerRef.current != null) {
        clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }
      setSaveStatus('saving');
      // Read through the refs: `body` in this closure may predate edits made
      // after the timer was scheduled (or be EMPTY_BODY on unmount).
      const next = { ...bodyRef.current, ...patch };
      const pendingName = patch.name ?? nameRef.current ?? undefined;
      nameRef.current = null;
      updateRequestRef.current
        .mutateAsync({
          id: requestIdRef.current,
          ...(pendingName != null ? { name: pendingName } : {}),
          // Mirror address into the top-level url so the tab strip + sidebar
          // can show a meaningful label without learning about gRPC bodies.
          url: next.address,
          bodyType: 'grpc',
          body: {
            type: 'grpc',
            address: next.address,
            protoPath: next.protoPath,
            service: next.service,
            method: next.method,
            message: next.message,
            metadata: next.metadata,
          } as never,
        })
        .then(() => setSaveStatus('idle'))
        .catch(() => setSaveStatus('pending'));
    },
    [],
  );

  const scheduleSave = useCallback(
    (patch: Partial<GrpcBody> & { name?: string }) => {
      if (pendingSaveTimerRef.current != null) clearTimeout(pendingSaveTimerRef.current);
      if (patch.name != null) nameRef.current = patch.name;
      setSaveStatus('pending');
      pendingSaveTimerRef.current = window.setTimeout(() => {
        pendingSaveTimerRef.current = null;
        // Body edits are already in bodyRef (patch() updates it synchronously);
        // only the name travels separately.
        flushSave({});
      }, 500);
    },
    [flushSave],
  );

  // Flush pending edits when the editor switches to another request or
  // unmounts, so nothing is dropped and nothing lands on the wrong row.
  useEffect(() => {
    requestIdRef.current = requestId;
    return () => {
      if (pendingSaveTimerRef.current != null) {
        clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
        // Best-effort, fire-and-forget; reads the previous body + id via refs.
        flushSave({});
      }
    };
  }, [requestId, flushSave]);

  const patch = useCallback(
    (p: Partial<GrpcBody>) => {
      bodyRef.current = { ...bodyRef.current, ...p };
      setBody((cur) => ({ ...cur, ...p }));
      scheduleSave(p);
    },
    [scheduleSave],
  );

  const pickProtoFile = useCallback(async () => {
    const picked = await voltApi['app:showFilePicker']({
      filters: [{ name: 'Protocol Buffers', extensions: ['proto'] }],
    });
    if (picked.cancelled || !picked.filePath) return;
    patch({ protoPath: picked.filePath, service: '', method: '' });
    setServices(null);
    setLoadError(null);
  }, [patch]);

  const loadServicesNow = useCallback(
    async (path: string) => {
      if (!path) return;
      setLoading(true);
      setLoadError(null);
      try {
        const out = await voltApi['grpc:loadProto']({ protoPath: path });
        if (!out.ok) {
          setLoadError(out.error ?? 'Failed to load proto.');
          setServices([]);
          return;
        }
        setServices(out.services);
        // If the previously-saved service/method no longer exists, clear them.
        const svc = out.services.find((s) => s.name === body.service);
        if (!svc) {
          if (body.service || body.method) patch({ service: '', method: '' });
        } else if (!svc.methods.find((m) => m.name === body.method)) {
          if (body.method) patch({ method: '' });
        }
      } catch (e) {
        setLoadError((e as Error).message);
        setServices([]);
      } finally {
        setLoading(false);
      }
    },
    [body.service, body.method, patch],
  );

  // Auto-load on first paint when there's already a proto path stored.
  // Guarded by `loading`: loadServicesNow changes identity on every body
  // edit, which re-ran this effect and kicked off parallel loads.
  useEffect(() => {
    if (services == null && body.protoPath && !loading) {
      void loadServicesNow(body.protoPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, body.protoPath]);

  const selectedService = useMemo(
    () => services?.find((s) => s.name === body.service) ?? null,
    [services, body.service],
  );
  const selectedMethod = useMemo(
    () => selectedService?.methods.find((m) => m.name === body.method) ?? null,
    [selectedService, body.method],
  );

  const methodIsStreaming =
    selectedMethod != null && (selectedMethod.requestStream || selectedMethod.responseStream);

  const canSend =
    Boolean(body.address) &&
    Boolean(body.protoPath) &&
    Boolean(body.service) &&
    Boolean(body.method) &&
    selectedMethod != null &&
    !methodIsStreaming &&
    !sending;

  const canConnect =
    Boolean(body.address) &&
    Boolean(body.protoPath) &&
    Boolean(body.service) &&
    Boolean(body.method) &&
    methodIsStreaming &&
    (streamState === 'idle' || streamState === 'closed' || streamState === 'error');

  // Subscribe to server→client stream events. Filters by the active stream id
  // so only entries for the current connection make it into the log.
  useEffect(() => {
    return onVoltEvent((evt) => {
      // The volt:event union is defined for sync/ws kinds; gRPC streaming
      // events come through the same channel but aren't in that union, so
      // we narrow manually via the runtime kind tag.
      const raw = evt as unknown as { kind?: string; connectionId?: string } & Record<string, unknown>;
      if (raw.kind !== 'grpc:stream:message' && raw.kind !== 'grpc:stream:state') return;
      // Only the active stream's events; main defers the 'open' event until
      // after the openStream reply so the id is always known here.
      if (!streamIdRef.current || raw.connectionId !== streamIdRef.current) return;
      const timestamp = (raw.timestamp as number | undefined) ?? Date.now();
      if (raw.kind === 'grpc:stream:message') {
        const direction = raw.direction as 'in' | 'out';
        const text = (raw.text as string | undefined) ?? '';
        const id = ++logSeqRef.current;
        setStreamLog((prev) => [
          ...prev,
          { id, kind: 'msg', direction, text, timestamp },
        ]);
      } else {
        const state = raw.state as 'open' | 'closed' | 'error' | 'status';
        if (state === 'open') setStreamState('open');
        else if (state === 'closed') setStreamState('closed');
        else if (state === 'error') setStreamState('error');
        const code = raw.code as string | undefined;
        const details = (raw.details as string | null | undefined) ?? null;
        const id = ++logSeqRef.current;
        setStreamLog((prev) => [
          ...prev,
          { id, kind: 'state', state, code, details, timestamp },
        ]);
      }
    });
  }, []);

  // Clean up the live stream when the user switches request or unmounts.
  useEffect(() => {
    return () => {
      const sid = streamIdRef.current;
      if (sid) void voltApi['grpc:streamClose']({ connectionId: sid });
      streamIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const connectStream = useCallback(async () => {
    if (!canConnect) return;
    flushSave({});
    setStreamLog([]);
    setStreamState('connecting');
    setStreamMode(null);
    streamIdRef.current = null;
    const meta: Record<string, string> = {};
    for (const m of body.metadata) {
      if (m.enabled === false || !m.key) continue;
      meta[m.key] = m.value;
    }
    const out = await voltApi['grpc:openStream']({
      address: body.address,
      protoPath: body.protoPath,
      service: body.service,
      method: body.method,
      // Server-streaming + bidi accept an initial request. Client-streaming
      // ignores it — the first frame comes via grpc:streamSend.
      message:
        selectedMethod?.requestStream && !selectedMethod?.responseStream
          ? undefined
          : body.message,
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
    });
    if (out.ok) {
      streamIdRef.current = out.connectionId;
      setStreamMode(out.mode);
      // The open state arrives via the volt:event listener.
    } else {
      setStreamState('error');
      const id = ++logSeqRef.current;
      setStreamLog((prev) => [
        ...prev,
        { id, kind: 'state', state: 'error', code: out.errorCode, details: out.errorMessage, timestamp: Date.now() },
      ]);
    }
  }, [body, canConnect, flushSave, selectedMethod]);

  const sendStreamMessage = useCallback(async () => {
    const sid = streamIdRef.current;
    if (!sid || streamState !== 'open') return;
    const out = await voltApi['grpc:streamSend']({ connectionId: sid, message: body.message });
    if (!out.ok) {
      const id = ++logSeqRef.current;
      setStreamLog((prev) => [
        ...prev,
        { id, kind: 'state', state: 'error', details: out.error ?? 'send failed', timestamp: Date.now() },
      ]);
    }
  }, [body.message, streamState]);

  const halfCloseStream = useCallback(async () => {
    const sid = streamIdRef.current;
    if (!sid) return;
    await voltApi['grpc:streamHalfClose']({ connectionId: sid });
  }, []);

  const closeStream = useCallback(async () => {
    const sid = streamIdRef.current;
    if (!sid) return;
    await voltApi['grpc:streamClose']({ connectionId: sid });
    streamIdRef.current = null;
  }, []);

  const send = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    // Persist any pending edits so what we send matches the row.
    flushSave({});
    try {
      const meta: Record<string, string> = {};
      for (const m of body.metadata) {
        if (m.enabled === false) continue;
        if (!m.key) continue;
        meta[m.key] = m.value;
      }
      const out = await voltApi['grpc:invoke']({
        address: body.address,
        protoPath: body.protoPath,
        service: body.service,
        method: body.method,
        message: body.message,
        metadata: Object.keys(meta).length > 0 ? meta : undefined,
        timeoutMs: 30_000,
      });
      setResult(out as InvokeResult);
    } finally {
      setSending(false);
    }
  }, [body, canSend, flushSave]);

  useHotkey('mod+enter', send, { allowInInputs: true });

  if (isLoading || !saved) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
        Loading request…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Name */}
      <div className="border-b border-border px-3 py-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleSave({ name: e.target.value });
          }}
          placeholder="Untitled gRPC request"
          className="w-full bg-transparent text-sm font-medium text-text outline-none placeholder:text-text-muted"
        />
      </div>

      {/* Address + action button (unary Invoke / streaming Connect/Disconnect) */}
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <span className="font-mono text-[10px] font-semibold text-accent">gRPC</span>
        <Input
          value={body.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="localhost:50051  ·  grpcs://api.example.com:443 for TLS"
          title="host:port (plaintext). Prefix with grpcs:// or use port 443 for TLS."
          className="flex-1"
          disabled={streamState === 'open' || streamState === 'connecting'}
        />
        {methodIsStreaming ? (
          streamState === 'open' || streamState === 'connecting' ? (
            <Button
              onClick={closeStream}
              variant="danger"
              size="md"
              title="End this streaming call"
            >
              <X size={13} />
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={connectStream}
              variant="primary"
              size="md"
              disabled={!canConnect}
              title={!body.protoPath ? 'Pick a .proto file first.' : 'Open the streaming call'}
            >
              <Plug size={13} />
              {streamState === 'closed' || streamState === 'error' ? 'Reconnect' : 'Connect'}
            </Button>
          )
        ) : (
          <Button
            onClick={send}
            variant="primary"
            size="md"
            disabled={!canSend}
            title={!body.protoPath ? 'Pick a .proto file first.' : 'Invoke (⌘↵)'}
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Invoke
          </Button>
        )}
        <StreamStateBadge state={streamState} mode={streamMode} />
        <SaveBadge status={saveStatus} />
      </div>

      {/* Proto file + service + method */}
      <div className="flex flex-col gap-2 border-b border-border p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pickProtoFile}
            className="flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-2 py-1 text-xs text-text hover:bg-bg"
            title="Choose a .proto file"
          >
            <FolderOpen size={12} />
            {body.protoPath ? 'Change proto…' : 'Choose .proto…'}
          </button>
          {body.protoPath && (
            <>
              <button
                type="button"
                onClick={() => loadServicesNow(body.protoPath)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded border border-border bg-bg-elevated px-2 py-1 text-xs text-text-muted hover:text-text disabled:opacity-50"
                title="Reload services from the proto file"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reload
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] text-text-muted">
                <FileCode size={11} className="flex-shrink-0" />
                <span className="truncate font-mono" title={body.protoPath}>
                  {body.protoPath}
                </span>
              </div>
            </>
          )}
        </div>

        {loadError && (
          <div className="rounded border border-error/30 bg-error/10 px-2 py-1.5 text-[11px] text-error">
            {loadError}
          </div>
        )}

        {services && services.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
              Service
              <Select
                value={body.service}
                onChange={(e) => patch({ service: e.target.value, method: '' })}
                options={[
                  { value: '', label: '— select —' },
                  ...services.map((s) => ({ value: s.name, label: s.name })),
                ]}
                className="font-mono"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
              Method
              <Select
                value={body.method}
                onChange={(e) => patch({ method: e.target.value })}
                options={[
                  { value: '', label: '— select —' },
                  ...(selectedService?.methods ?? []).map((m) => ({
                    value: m.name,
                    label: `${m.name}${m.requestStream || m.responseStream ? ' (streaming)' : ''}`,
                  })),
                ]}
                disabled={!selectedService}
                className="font-mono"
              />
            </label>
            {selectedMethod && (
              <span className="font-mono text-[10px] text-text-muted">
                {selectedMethod.requestType} → {selectedMethod.responseType}
              </span>
            )}
          </div>
        )}
        {methodIsStreaming && (
          <p className="text-[11px] text-text-muted">
            {streamingHint(selectedMethod)}
          </p>
        )}
      </div>

      {/* Message + Metadata tabs */}
      <Tabs defaultValue="message" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="message">Message</TabsTrigger>
          <TabsTrigger value="metadata">
            Metadata
            {body.metadata.length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">{body.metadata.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="response">
            Response
            {result && (
              <span className="ml-1 text-[10px] text-text-muted">
                {result.ok ? 'OK' : result.errorCode}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="flex flex-col overflow-hidden">
          {/* Per-frame send/half-close controls for client + bidi streams */}
          {methodIsStreaming && (selectedMethod?.requestStream ?? false) && (
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-[11px]">
              <Button
                size="sm"
                variant="primary"
                disabled={streamState !== 'open'}
                onClick={sendStreamMessage}
                title="Send this message to the server"
              >
                <ArrowUp size={11} /> Send frame
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={streamState !== 'open'}
                onClick={halfCloseStream}
                title="Signal end-of-stream so the server can finish responding"
              >
                Half-close
              </Button>
              <span className="ml-auto text-text-muted">
                {streamState === 'open' ? 'Live' : streamState}
              </span>
            </div>
          )}
          <CodeEditor
            value={body.message}
            onChange={(v) => patch({ message: v })}
            language="json"
            className="flex-1"
            placeholder="{}"
          />
        </TabsContent>

        <TabsContent value="metadata" className="overflow-y-auto">
          <KeyValueEditor
            rows={body.metadata as never}
            onChange={(rows) => patch({ metadata: rows as never })}
            keyPlaceholder="key"
            valuePlaceholder="value"
          />
        </TabsContent>

        <TabsContent value="response" className="overflow-y-auto p-2">
          {methodIsStreaming ? (
            <StreamLogPanel
              log={streamLog}
              streamState={streamState}
              mode={streamMode}
            />
          ) : (
            <ResponsePanel result={result} sending={sending} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function streamingHint(method: {
  requestStream: boolean;
  responseStream: boolean;
} | null): string {
  if (!method) return '';
  if (method.requestStream && method.responseStream)
    return 'Bidirectional streaming — connect, send messages from the editor, the server replies on the same channel.';
  if (method.requestStream)
    return "Client streaming — connect, send N messages, half-close to receive the server's single response.";
  return 'Server streaming — connect with a single request, server emits messages until it ends the stream.';
}

function StreamStateBadge({
  state,
  mode,
}: {
  state: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  mode: 'server' | 'client' | 'bidi' | null;
}) {
  if (state === 'idle') return null;
  const dotColor =
    state === 'open'
      ? 'bg-success'
      : state === 'error'
        ? 'bg-error'
        : state === 'connecting'
          ? 'bg-accent'
          : 'bg-text-muted';
  const label =
    state === 'open' && mode ? `${mode} · live` : state.charAt(0).toUpperCase() + state.slice(1);
  return (
    <span className="ml-1 flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      {label}
    </span>
  );
}

function StreamLogPanel({
  log,
  streamState,
  mode,
}: {
  log: Array<
    | { id: number; kind: 'msg'; direction: 'in' | 'out'; text: string; timestamp: number }
    | { id: number; kind: 'state'; state: 'open' | 'closed' | 'error' | 'status'; code?: string; details?: string | null; timestamp: number }
  >;
  streamState: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  mode: 'server' | 'client' | 'bidi' | null;
}) {
  if (streamState === 'idle' && log.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-text-muted">
        Click <span className="text-text">Connect</span> to open the streaming call. Incoming and
        outgoing messages will appear here in order.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[11px]">
      {log.length === 0 && streamState === 'connecting' && (
        <p className="px-2 py-2 text-text-muted">Connecting…</p>
      )}
      {log.map((e) =>
        e.kind === 'msg' ? (
          <div
            key={e.id}
            className={cn(
              'flex items-start gap-2 rounded border px-2 py-1.5',
              e.direction === 'in'
                ? 'border-success/20 bg-success/5'
                : 'border-accent/20 bg-accent/5',
            )}
          >
            {e.direction === 'in' ? (
              <ArrowDown size={11} className="mt-0.5 flex-shrink-0 text-success" />
            ) : (
              <ArrowUp size={11} className="mt-0.5 flex-shrink-0 text-accent" />
            )}
            <span className="flex-shrink-0 text-[10px] text-text-muted">
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <pre className="flex-1 whitespace-pre-wrap break-all text-text">
              {prettyJson(e.text)}
            </pre>
          </div>
        ) : (
          <div
            key={e.id}
            className={cn(
              'rounded border px-2 py-1 text-[10px]',
              e.state === 'error'
                ? 'border-error/30 bg-error/10 text-error'
                : 'border-border bg-bg text-text-muted',
            )}
          >
            <span className="font-semibold uppercase">{e.state}</span>
            {e.code && <span className="ml-1 font-mono">{e.code}</span>}
            {e.details && <span className="ml-1">— {e.details}</span>}
            <span className="ml-2 text-text-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>
        ),
      )}
      {mode && streamState === 'open' && (
        <p className="px-2 py-1 text-[10px] text-text-muted">{mode} stream is live</p>
      )}
    </div>
  );
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function SaveBadge({ status }: { status: 'idle' | 'pending' | 'saving' }) {
  if (status === 'idle') return null;
  return (
    <span className="ml-1 flex items-center gap-1 text-[10px] text-text-muted">
      {status === 'saving' ? <Loader2 size={9} className="animate-spin" /> : null}
      {status === 'saving' ? 'Saving…' : 'Unsaved'}
    </span>
  );
}

function ResponsePanel({ result, sending }: { result: InvokeResult | null; sending: boolean }) {
  if (sending) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        <Loader2 size={12} className="mr-2 animate-spin" /> Waiting for response…
      </div>
    );
  }
  if (!result) {
    return (
      <p className="px-3 py-6 text-center text-xs text-text-muted">
        Press <kbd className="rounded border border-border bg-bg-elevated px-1 py-0.5 font-mono text-[10px]">⌘↵</kbd>
        {' '}or click Invoke to send a unary call.
      </p>
    );
  }
  if (!result.ok) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-error">{result.errorCode}</span>
          <span className="text-text-muted">{formatDuration(result.durationMs)}</span>
        </div>
        <pre className="rounded border border-error/30 bg-error/10 p-2 font-mono text-[11px] text-error">
          {result.errorMessage}
        </pre>
      </div>
    );
  }
  const json = JSON.stringify(result.response, null, 2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-success">OK</span>
        <span className="text-text-muted">{formatDuration(result.durationMs)}</span>
        <span className="text-text-muted">{formatBytes(new Blob([json]).size)}</span>
      </div>
      <CodeEditor value={json} language="json" readOnly className={cn('min-h-[12rem] flex-1')} />
    </div>
  );
}

