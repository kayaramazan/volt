import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Save, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { KeyValueEditor } from './KeyValueEditor';
import { BodyEditor, type Body } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { CodeEditor } from './CodeEditor';
import {
  useActiveEnv,
  useCollections,
  useEnvironments,
  useGlobals,
  useRequest,
  useUpdateRequest,
} from '@/hooks/useData';
import { useDrafts } from '@/stores/drafts';
import { useHotkey } from '@/hooks/useHotkey';
import { voltApi } from '@/lib/volt-api';
import { cn, methodColorClass, rowId } from '@/lib/util';

interface Props {
  requestId: string;
  workspaceId: string;
  onResponse: (response: unknown) => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Request editor. Shows the saved version as the baseline; user edits
 * accumulate in a "draft" in the drafts store. Save commits to local DB.
 * Send executes the request (using draft state, even unsaved) and streams
 * the response to the parent.
 */
export function RequestEditor({ requestId, workspaceId, onResponse }: Props) {
  const { data: saved, isLoading } = useRequest(requestId);
  const updateRequest = useUpdateRequest();
  const { data: activeEnv } = useActiveEnv(workspaceId);
  const { data: environments } = useEnvironments(workspaceId);
  const { data: collections } = useCollections(workspaceId);
  const { data: globals } = useGlobals();
  const qc = useQueryClient();

  const { drafts, setDraft, clearDraft, patchDraft, setInFlight, inFlight } = useDrafts();
  const draft = drafts.get(requestId);
  const sendIdRef = useRef<string | null>(null);
  const [sending, setSending] = useState(false);

  // Initialize draft when saved loads or request changes
  useEffect(() => {
    if (!saved) return;
    if (!drafts.has(requestId)) {
      setDraft(requestId, {
        name: saved.name,
        method: saved.method,
        url: saved.url,
        headers: saved.headers as never,
        queryParams: saved.queryParams as never,
        bodyType: saved.bodyType,
        body: saved.body,
        auth: saved.auth,
        preRequestScript: (saved as { preRequestScript?: string }).preRequestScript ?? '',
        postResponseScript: (saved as { postResponseScript?: string }).postResponseScript ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, saved]);

  // Detect dirty
  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    const savedPre = (saved as { preRequestScript?: string }).preRequestScript ?? '';
    const savedPost = (saved as { postResponseScript?: string }).postResponseScript ?? '';
    return (
      saved.name !== draft.name ||
      saved.method !== draft.method ||
      saved.url !== draft.url ||
      JSON.stringify(saved.headers) !== JSON.stringify(draft.headers) ||
      JSON.stringify(saved.queryParams) !== JSON.stringify(draft.queryParams) ||
      saved.bodyType !== draft.bodyType ||
      JSON.stringify(saved.body) !== JSON.stringify(draft.body) ||
      JSON.stringify(saved.auth) !== JSON.stringify(draft.auth) ||
      savedPre !== draft.preRequestScript ||
      savedPost !== draft.postResponseScript
    );
  }, [saved, draft]);

  const save = useCallback(async () => {
    if (!draft) return;
    await updateRequest.mutateAsync({
      id: requestId,
      name: draft.name,
      method: draft.method,
      url: draft.url,
      headers: draft.headers,
      queryParams: draft.queryParams,
      bodyType: draft.bodyType,
      body: draft.body,
      auth: draft.auth,
      preRequestScript: draft.preRequestScript,
      postResponseScript: draft.postResponseScript,
    });
  }, [draft, requestId, updateRequest]);

  const send = useCallback(async () => {
    if (!draft) return;
    setSending(true);

    // Build the active environment + collection chain for resolution
    const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
    const collectionChain = saved?.collectionId
      ? collectColChain(saved.collectionId, collections ?? [])
      : [];

    // Resolve client-side using globals (lowest priority) + env + collections.
    const { resolved, variables } = resolveLocally(draft, env, collectionChain, globals ?? {});

    const id = rowId('send');
    sendIdRef.current = id;
    setInFlight(requestId, id);

    try {
      const response = await voltApi['request:send']({
        inFlightId: id,
        request: resolved as never,
        preRequestScript: (draft as { preRequestScript?: string }).preRequestScript ?? '',
        postResponseScript: (draft as { postResponseScript?: string }).postResponseScript ?? '',
        variables,
        workspaceId,
        environmentId: activeEnv?.environmentId ?? null,
      });
      onResponse(response);
    } catch (err) {
      onResponse(buildClientError(err, resolved.url));
    } finally {
      setSending(false);
      setInFlight(requestId, null);
      sendIdRef.current = null;
      // Scripts may have mutated env vars / globals in the main process —
      // refetch so the modals + substitution layer reflect the new state.
      qc.invalidateQueries({ queryKey: ['environments', workspaceId] });
      qc.invalidateQueries({ queryKey: ['globals'] });
    }
  }, [draft, environments, activeEnv, saved, collections, globals, requestId, workspaceId, setInFlight, onResponse, qc]);

  // Run an example: re-dispatch the snapshot's request through the current
  // env/globals so {{vars}} are re-resolved with today's values.
  const runExample = useCallback(
    async (ex: ExampleRow) => {
      const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
      const collectionChain = saved?.collectionId
        ? collectColChain(saved.collectionId, collections ?? [])
        : [];
      const { resolved, variables } = resolveLocally(
        {
          method: ex.request.method,
          url: ex.request.url,
          headers: ex.request.headers as never,
          queryParams: ex.request.queryParams as never,
          bodyType: ex.request.bodyType,
          body: ex.request.body,
          auth: ex.request.auth,
        },
        env,
        collectionChain,
        globals ?? {},
      );
      const id = rowId('send');
      sendIdRef.current = id;
      setInFlight(requestId, id);
      setSending(true);
      try {
        const response = await voltApi['request:send']({
          inFlightId: id,
          request: resolved as never,
          // Examples don't carry their own scripts — use the current request's.
          preRequestScript: draft?.preRequestScript ?? '',
          postResponseScript: draft?.postResponseScript ?? '',
          variables,
          workspaceId,
          environmentId: activeEnv?.environmentId ?? null,
        });
        onResponse(response);
      } catch (err) {
        onResponse(buildClientError(err, resolved.url));
      } finally {
        setSending(false);
        setInFlight(requestId, null);
        sendIdRef.current = null;
      }
    },
    [draft, environments, activeEnv, saved, collections, globals, requestId, workspaceId, setInFlight, onResponse],
  );

  const cancel = useCallback(() => {
    if (sendIdRef.current) {
      void voltApi['request:cancel']({ inFlightId: sendIdRef.current });
    }
  }, []);

  useHotkey('mod+enter', send, { allowInInputs: true });
  useHotkey('mod+s', save, { allowInInputs: true });

  if (isLoading || !saved || !draft) {
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
          value={draft.name}
          onChange={(e) => patchDraft(requestId, { name: e.target.value })}
          placeholder="Untitled request"
          className="w-full bg-transparent text-sm font-medium text-text outline-none placeholder:text-text-muted"
        />
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <Select
          value={draft.method}
          onChange={(e) => patchDraft(requestId, { method: e.target.value })}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          className={cn('w-24 font-mono font-semibold', methodColorClass(draft.method))}
        />
        <HighlightedInput
          value={draft.url}
          onChange={(e) => patchDraft(requestId, { url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="flex-1"
        />
        {sending ? (
          <Button onClick={cancel} variant="danger" size="md">
            <X size={13} />
            Cancel
          </Button>
        ) : (
          <Button onClick={send} variant="primary" size="md" title="Send (⌘↵)">
            <Send size={13} />
            Send
          </Button>
        )}
        <Button
          onClick={save}
          variant={dirty ? 'default' : 'ghost'}
          size="md"
          disabled={!dirty}
          title="Save (⌘S)"
        >
          {updateRequest.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="params" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="params">
            Params
            {(draft.queryParams as unknown[]).length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">
                {(draft.queryParams as unknown[]).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            {(draft.headers as unknown[]).length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">
                {(draft.headers as unknown[]).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="body">
            Body
            {draft.bodyType !== 'none' && <span className="ml-1 text-[10px] text-accent">●</span>}
          </TabsTrigger>
          <TabsTrigger value="auth">
            Auth
            {(draft.auth as { type: string }).type !== 'none' && (
              <span className="ml-1 text-[10px] text-accent">●</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="scripts">
            Scripts
            {(draft.preRequestScript || draft.postResponseScript) && (
              <span className="ml-1 text-[10px] text-accent">●</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="examples">
            Examples
            {(saved as { examples?: unknown[] } | undefined)?.examples?.length ? (
              <span className="ml-1 text-[10px] text-text-muted">
                {(saved as { examples?: unknown[] } | undefined)?.examples?.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="overflow-y-auto">
          <KeyValueEditor
            rows={(draft.queryParams as never) ?? []}
            onChange={(rows) => patchDraft(requestId, { queryParams: rows as never })}
            keyPlaceholder="Param"
            valuePlaceholder="Value"
          />
        </TabsContent>

        <TabsContent value="headers" className="overflow-y-auto">
          <KeyValueEditor
            rows={(draft.headers as never) ?? []}
            onChange={(rows) => patchDraft(requestId, { headers: rows as never })}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
          />
        </TabsContent>

        <TabsContent value="body" className="overflow-hidden">
          <BodyEditor
            body={draft.body as Body}
            onChange={(body) => patchDraft(requestId, { body, bodyType: body.type })}
          />
        </TabsContent>

        <TabsContent value="auth" className="overflow-hidden">
          <AuthEditor
            auth={draft.auth as never}
            onChange={(auth) => patchDraft(requestId, { auth: auth as never })}
          />
        </TabsContent>

        <TabsContent value="examples" className="overflow-y-auto p-2">
          <ExamplesPanel
            examples={
              ((saved as { examples?: ExampleRow[] } | undefined)?.examples ?? []) as ExampleRow[]
            }
            sending={sending}
            onRun={runExample}
            onDelete={async (exId) => {
              const current =
                ((saved as { examples?: ExampleRow[] } | undefined)?.examples as ExampleRow[]) ??
                [];
              await updateRequest.mutateAsync({
                id: requestId,
                examples: current.filter((e) => e.id !== exId),
              });
            }}
          />
        </TabsContent>

        <TabsContent value="scripts" className="flex flex-col gap-2 overflow-y-auto p-2">
          <ScriptsHelp />
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-[10rem] flex-1 flex-col rounded border border-border">
              <div className="border-b border-border bg-bg-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Pre-request
              </div>
              <CodeEditor
                value={draft.preRequestScript}
                onChange={(v) => patchDraft(requestId, { preRequestScript: v })}
                language="javascript"
                className="flex-1"
                placeholder="// Runs before the request is sent — see help above."
              />
            </div>
            <div className="flex min-h-[10rem] flex-1 flex-col rounded border border-border">
              <div className="border-b border-border bg-bg-elevated px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Post-response
              </div>
              <CodeEditor
                value={draft.postResponseScript}
                onChange={(v) => patchDraft(requestId, { postResponseScript: v })}
                language="javascript"
                className="flex-1"
                placeholder="// Runs after the response arrives — set globals from response data."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Local resolution helpers
// ─────────────────────────────────────────────────────────

function collectColChain(collectionId: string, collections: Array<{ id: string; parentId: string | null; variables?: unknown }>): unknown[] {
  const chain: typeof collections = [];
  let cur = collections.find((c) => c.id === collectionId);
  while (cur) {
    chain.push(cur);
    cur = cur.parentId ? collections.find((c) => c.id === cur!.parentId) : undefined;
  }
  return chain;
}

/**
 * Client-side resolution — handles {{var}} substitution from environment +
 * collection chain. Secret refs are not resolved here (they go via IPC to
 * keytar in main process); we send them as-is for now and rely on main
 * process to substitute. For MVP we just do simple env merging.
 */
function resolveLocally(
  draft: {
    method: string;
    url: string;
    headers: unknown;
    queryParams: unknown;
    bodyType: string;
    body: unknown;
    auth: unknown;
  },
  env: { variables?: Array<{ key: string; value: string }> } | null,
  collections: unknown[],
  globals: Record<string, unknown> = {},
) {
  const vars = new Map<string, string>();
  // Precedence (lowest first; later overrides earlier):
  //   1. Globals (set by scripts)
  //   2. Active environment
  //   3. Collection chain root → deepest (deeper overrides)
  for (const [k, v] of Object.entries(globals)) {
    if (v != null) vars.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  if (env?.variables) for (const v of env.variables) vars.set(v.key, v.value);
  for (const c of [...collections].reverse() as Array<{ variables?: Array<{ key: string; value: string }> }>) {
    if (c.variables) for (const v of c.variables) vars.set(v.key, v.value);
  }

  const subst = (s: string) =>
    s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars.get(name) ?? '');

  // Headers (filter disabled + subst)
  const headers: Record<string, string> = {};
  for (const h of (draft.headers as Array<{ key: string; value: string; enabled?: boolean }>) ?? []) {
    if (h.enabled === false) continue;
    if (h.key) headers[subst(h.key)] = subst(h.value);
  }

  // URL + query params
  let url = subst(draft.url);
  const qp = (draft.queryParams as Array<{ key: string; value: string; enabled?: boolean }>) ?? [];
  const enabledQp = qp.filter((q) => q.enabled !== false && q.key);
  if (enabledQp.length > 0) {
    const sep = url.includes('?') ? '&' : '?';
    url +=
      sep +
      enabledQp
        .map((q) => `${encodeURIComponent(subst(q.key))}=${encodeURIComponent(subst(q.value))}`)
        .join('&');
  }

  // Auth
  const auth = draft.auth as { type: string; [k: string]: unknown };
  if (auth.type === 'bearer' && (auth.token as string)) {
    headers['Authorization'] = `Bearer ${subst(auth.token as string)}`;
  } else if (auth.type === 'basic') {
    const encoded = btoa(`${subst((auth.username as string) ?? '')}:${subst((auth.password as string) ?? '')}`);
    headers['Authorization'] = `Basic ${encoded}`;
  } else if (auth.type === 'apiKey') {
    const k = subst((auth.key as string) ?? '');
    const v = subst((auth.value as string) ?? '');
    if (k) {
      if (auth.placement === 'query') {
        url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      } else {
        headers[k] = v;
      }
    }
  }

  // Body
  const body = draft.body as { type: string; [k: string]: unknown };
  let resolvedBody: unknown = { type: 'none' };
  if (body.type === 'raw') {
    resolvedBody = { type: 'raw', content: subst((body.content as string) ?? '') };
    // Default Content-Type from `language` when user hasn't set one — otherwise
    // most JSON/XML APIs treat the body as empty.
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
    if (!hasContentType) {
      const ct = rawLanguageContentType(body.language as string | undefined);
      if (ct) headers['Content-Type'] = ct;
    }
  } else if (body.type === 'urlencoded') {
    const fields = (body.fields as Array<{ key: string; value: string; enabled?: boolean }>) ?? [];
    const content = fields
      .filter((f) => f.enabled !== false && f.key)
      .map((f) => `${encodeURIComponent(subst(f.key))}=${encodeURIComponent(subst(f.value))}`)
      .join('&');
    resolvedBody = { type: 'urlencoded', content };
  } else if (body.type === 'form') {
    resolvedBody = {
      type: 'form',
      fields: ((body.fields as Array<{ key: string; kind: 'text' | 'file'; value: string; enabled?: boolean }>) ?? [])
        .filter((f) => f.enabled !== false)
        .map((f) => ({
          key: subst(f.key),
          kind: f.kind,
          value: f.kind === 'text' ? subst(f.value) : f.value,
        })),
    };
  } else if (body.type === 'binary') {
    resolvedBody = { type: 'binary', filePath: body.filePath as string };
  }

  return {
    resolved: {
      method: draft.method,
      url,
      headers,
      body: resolvedBody,
      timeoutMs: 60_000,
      followRedirects: true,
      ignoreTlsErrors: false,
    },
    variables: Object.fromEntries(vars),
  };
}

interface ExampleRow {
  id: string;
  name: string;
  createdAt: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ key: string; value: string }>;
    queryParams: Array<{ key: string; value: string }>;
    bodyType: string;
    body: unknown;
    auth: unknown;
  };
  response:
    | {
        ok: true;
        statusCode: number;
        headers: [string, string][];
        contentType: string | null;
        bodyText: string | null;
        bodySizeBytes: number;
        durationMs: number;
      }
    | {
        ok: false;
        errorCode?: string;
        errorMessage?: string;
        durationMs: number;
      }
    | null;
}

function ExamplesPanel({
  examples,
  sending,
  onRun,
  onDelete,
}: {
  examples: ExampleRow[];
  sending: boolean;
  onRun: (ex: ExampleRow) => void | Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(examples[0]?.id ?? null);
  const selected = examples.find((e) => e.id === selectedId) ?? examples[0] ?? null;

  if (examples.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-text-muted">
        No examples saved. Right-click the request → <span className="text-text">Add example</span>{' '}
        to capture the current request + response as a snapshot.
      </p>
    );
  }

  return (
    <div className="flex h-full gap-2">
      <div className="flex w-48 flex-col gap-1 border-r border-border pr-2">
        {examples.map((e) => (
          <div
            key={e.id}
            className={cn(
              'group flex items-center gap-1 rounded',
              selected?.id === e.id ? 'bg-bg-elevated' : 'hover:bg-bg-elevated/60',
            )}
          >
            <button
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={cn(
                'flex-1 truncate px-2 py-1 text-left text-xs',
                selected?.id === e.id ? 'text-text' : 'text-text-muted',
              )}
            >
              {e.name}
            </button>
            <button
              type="button"
              onClick={() => onRun(e)}
              disabled={sending}
              title="Run this example"
              className="mr-1 rounded p-1 text-text-muted opacity-0 hover:bg-bg hover:text-accent group-hover:opacity-100 disabled:opacity-30"
            >
              <Send size={11} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-auto text-xs">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <p className="text-13 font-medium text-text">{selected.name}</p>
                <p className="text-[10px] text-text-muted">
                  Saved {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={sending}
                  onClick={() => onRun(selected)}
                  title="Re-send this request snapshot, resolving {{vars}} with current env + globals"
                >
                  <Send size={12} />
                  Run
                </Button>
                <button
                  type="button"
                  onClick={() => onDelete(selected.id)}
                  className="rounded p-1 text-text-muted hover:bg-bg hover:text-error"
                  title="Delete example"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <section>
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Request
              </h4>
              <p className="font-mono text-text">
                <span className={cn('font-semibold', methodColorClass(selected.request.method))}>
                  {selected.request.method}
                </span>{' '}
                {selected.request.url}
              </p>
            </section>

            <section>
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Response
              </h4>
              {!selected.response ? (
                <p className="text-text-muted">No response captured.</p>
              ) : selected.response.ok ? (
                <div className="space-y-1">
                  <p>
                    <span className={cn('font-mono font-semibold', methodColorClass('GET'))}>
                      {selected.response.statusCode}
                    </span>
                    <span className="ml-2 text-text-muted">
                      {selected.response.durationMs}ms · {selected.response.bodySizeBytes} bytes
                    </span>
                  </p>
                  {selected.response.bodyText && (
                    <pre className="max-h-64 overflow-auto rounded border border-border bg-bg-elevated p-2 font-mono text-[11px] text-text">
                      {selected.response.bodyText}
                    </pre>
                  )}
                </div>
              ) : (
                <p className="text-error">
                  {selected.response.errorCode}: {selected.response.errorMessage}
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScriptsHelp() {
  return (
    <details className="rounded border border-border bg-bg-elevated p-2 text-[11px] text-text-muted">
      <summary className="cursor-pointer text-text">
        Available API
        <span className="ml-2 text-text-muted">(click to expand)</span>
      </summary>
      <div className="mt-2 space-y-1 font-mono">
        <p><code>volt.globals.get(key)</code> / <code>set(key, value)</code> / <code>unset(key)</code> / <code>has(key)</code> / <code>all()</code></p>
        <p><code>volt.environment.get(key)</code> / <code>set(key, value)</code> / <code>unset(key)</code> / <code>has(key)</code> / <code>all()</code> / <code>.name</code></p>
        <p><code>volt.variables.get(key)</code> — read the merged env + collection + globals map</p>
        <p><code>volt.request</code> — pre-request: mutate <code>.url</code>, <code>.headers</code>, <code>.body</code>, etc.</p>
        <p><code>volt.response</code> — post-response: <code>.status</code>, <code>.headers</code>, <code>.text</code>, <code>.json</code></p>
        <p><code>console.log(...)</code> — output appears in the response panel</p>
      </div>
      <div className="mt-2 font-mono">
        <p className="text-text">Example (post-response):</p>
        <pre className="mt-1 rounded bg-bg p-2 text-text-muted">
{`const data = volt.response.json;
if (data?.token) {
  // either persist to globals (per-device)
  volt.globals.set('authToken', data.token);
  // or write through to the active environment (synced to backend)
  volt.environment.set('authToken', data.token);
}`}
        </pre>
      </div>
    </details>
  );
}

function rawLanguageContentType(lang: string | undefined): string | null {
  switch (lang) {
    case 'json':
      return 'application/json';
    case 'xml':
      return 'application/xml';
    case 'html':
      return 'text/html';
    case 'javascript':
      return 'application/javascript';
    case 'text':
      return 'text/plain';
    default:
      return null;
  }
}

/**
 * Turn an IPC rejection (Zod validation, etc.) into a synthetic SendResponse
 * so the response panel renders an explanatory failure instead of going blank.
 */
function buildClientError(err: unknown, url: string) {
  const raw = err instanceof Error ? err.message : String(err);
  // Wrapper prefixes "Invalid input for <channel>: " — strip it for clarity.
  const stripped = raw.replace(/^Invalid input for [^:]+:\s*/, '');

  let code = 'INVALID_REQUEST';
  let message = stripped;
  if (/url/i.test(stripped)) {
    code = 'INVALID_URL';
    message = url
      ? `"${url}" is not a valid URL. Include the scheme, e.g. https://api.example.com/path`
      : 'Please enter a URL before sending. Include the scheme (http:// or https://).';
  }

  return {
    ok: false as const,
    errorCode: code,
    errorMessage: message,
    timing: {
      dnsMs: null,
      tcpMs: null,
      tlsMs: null,
      ttfbMs: null,
      downloadMs: null,
      totalMs: 0,
    },
  };
}
