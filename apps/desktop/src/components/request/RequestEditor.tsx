import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, FileCode2, Send, Save, Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { KeyValueEditor } from './KeyValueEditor';
import { BodyEditor, type Body } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { CodeEditor } from './CodeEditor';
import { AutoHeadersEditor } from '@/components/modals/AutoHeadersEditor';
import { VariablesProvider } from '@/lib/variables-context';
import {
  useActiveEnv,
  useCollections,
  useEnvironments,
  useGlobals,
  useRequest,
  useUpdateRequest,
} from '@/hooks/useData';
import { useDrafts } from '@/stores/drafts';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
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
  const { open: openModal } = useModals();
  const draft = drafts.get(requestId);
  const sendIdRef = useRef<string | null>(null);
  const [sending, setSending] = useState(false);

  // Active editor tab. Controlled so we can jump to "examples" automatically
  // when the user clicks an example row in the sidebar.
  const [tab, setTab] = useState<string>('params');
  const selectedExampleId = useSelection((s) => s.selectedExampleId);
  const setSelectedExampleId = useSelection((s) => s.setSelectedExampleId);

  // ── Example editing mode ──────────────────────────────────────────────
  // When the user picks an example in the sidebar (or the Examples panel),
  // we lift its snapshot into a *working copy* (exampleWorking). All editor
  // tabs read from this copy and edits route back into it with a debounced
  // save that writes the patched example back to the request's examples[].
  // Switching examples or leaving example mode flushes any pending save so
  // edits aren't dropped.
  const activeExample = useMemo(() => {
    if (!selectedExampleId) return null;
    const examples = ((saved as { examples?: ExampleRow[] } | undefined)?.examples ?? []) as ExampleRow[];
    return examples.find((e) => e.id === selectedExampleId) ?? null;
  }, [selectedExampleId, saved]);

  const [exampleWorking, setExampleWorking] = useState<{
    exampleId: string;
    example: ExampleRow;
  } | null>(null);
  const exampleWorkingRef = useRef(exampleWorking);
  exampleWorkingRef.current = exampleWorking;
  const pendingSaveTimerRef = useRef<number | null>(null);
  // Tracks whether there are unflushed edits — drives the small status pill.
  const [exampleSaveStatus, setExampleSaveStatus] = useState<'idle' | 'pending' | 'saving'>(
    'idle',
  );

  const flushExampleSave = useCallback(() => {
    if (pendingSaveTimerRef.current != null) {
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    }
    const working = exampleWorkingRef.current;
    if (!working) return;
    // Read the *latest* request from React Query's cache instead of the
    // closure-captured `saved`. Otherwise, when an example is deleted while
    // edits are pending, this code path could reinsert it from a stale array.
    const currentRequest = qc.getQueryData<{ examples?: ExampleRow[] }>([
      'request',
      requestId,
    ]);
    const examples = (currentRequest?.examples ?? []) as ExampleRow[];
    if (!examples.some((e) => e.id === working.exampleId)) {
      // Example was deleted under us — drop the pending edits silently.
      setExampleSaveStatus('idle');
      return;
    }
    const nextExamples = examples.map((e) =>
      e.id === working.exampleId ? working.example : e,
    );
    setExampleSaveStatus('saving');
    updateRequest
      .mutateAsync({ id: requestId, examples: nextExamples })
      .then(() => setExampleSaveStatus('idle'))
      .catch(() => setExampleSaveStatus('pending'));
  }, [qc, requestId, updateRequest]);

  const scheduleExampleSave = useCallback(() => {
    if (pendingSaveTimerRef.current != null) {
      clearTimeout(pendingSaveTimerRef.current);
    }
    setExampleSaveStatus('pending');
    pendingSaveTimerRef.current = window.setTimeout(() => {
      pendingSaveTimerRef.current = null;
      flushExampleSave();
    }, 500);
  }, [flushExampleSave]);

  // Re-init the working copy whenever the user switches examples (or leaves
  // example mode). Flush the previous example's pending edits first so they
  // aren't dropped when its working copy disappears.
  useEffect(() => {
    if (
      exampleWorkingRef.current &&
      activeExample?.id !== exampleWorkingRef.current.exampleId
    ) {
      flushExampleSave();
    }
    if (!activeExample) {
      setExampleWorking(null);
      return;
    }
    setExampleWorking({ exampleId: activeExample.id, example: activeExample });
    // Intentionally only react to *which* example is active, not to inner
    // edits from `saved` — otherwise every debounced save would overwrite
    // the local working copy mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExample?.id]);

  // Flush on unmount so pending edits aren't dropped if user navigates away.
  useEffect(() => {
    return () => {
      if (pendingSaveTimerRef.current != null) {
        clearTimeout(pendingSaveTimerRef.current);
        flushExampleSave();
      }
    };
  }, [flushExampleSave]);

  const isExampleMode = exampleWorking != null;

  // Unified read accessors — every tab pulls from here so we don't have to
  // sprinkle `isExampleMode ? … : draft.…` across the JSX.
  const activeName = isExampleMode ? exampleWorking!.example.name : draft?.name ?? '';
  const activeRequest: {
    method: string;
    url: string;
    headers: Array<{ key: string; value: string }>;
    queryParams: Array<{ key: string; value: string }>;
    bodyType: string;
    body: unknown;
    auth: unknown;
    preRequestScript: string;
    postResponseScript: string;
  } = isExampleMode
    ? {
        method: exampleWorking!.example.request.method,
        url: exampleWorking!.example.request.url,
        headers: exampleWorking!.example.request.headers ?? [],
        queryParams: exampleWorking!.example.request.queryParams ?? [],
        bodyType: exampleWorking!.example.request.bodyType ?? 'none',
        body: exampleWorking!.example.request.body,
        auth: exampleWorking!.example.request.auth ?? { type: 'none' },
        preRequestScript: exampleWorking!.example.request.preRequestScript ?? '',
        postResponseScript: exampleWorking!.example.request.postResponseScript ?? '',
      }
    : {
        method: draft?.method ?? 'GET',
        url: draft?.url ?? '',
        headers: (draft?.headers as Array<{ key: string; value: string }>) ?? [],
        queryParams: (draft?.queryParams as Array<{ key: string; value: string }>) ?? [],
        bodyType: draft?.bodyType ?? 'none',
        body: draft?.body,
        auth: draft?.auth ?? { type: 'none' },
        preRequestScript: draft?.preRequestScript ?? '',
        postResponseScript: draft?.postResponseScript ?? '',
      };

  const setActiveName = useCallback(
    (name: string) => {
      if (isExampleMode) {
        setExampleWorking((cur) =>
          cur ? { ...cur, example: { ...cur.example, name } } : cur,
        );
        scheduleExampleSave();
      } else {
        patchDraft(requestId, { name });
      }
    },
    [isExampleMode, scheduleExampleSave, patchDraft, requestId],
  );

  const patchActive = useCallback(
    (
      partial: Partial<{
        method: string;
        url: string;
        headers: unknown;
        queryParams: unknown;
        bodyType: string;
        body: unknown;
        auth: unknown;
        preRequestScript: string;
        postResponseScript: string;
      }>,
    ) => {
      if (isExampleMode) {
        setExampleWorking((cur) =>
          cur
            ? {
                ...cur,
                example: {
                  ...cur.example,
                  request: { ...cur.example.request, ...(partial as object) },
                },
              }
            : cur,
        );
        scheduleExampleSave();
      } else {
        patchDraft(requestId, partial as never);
      }
    },
    [isExampleMode, scheduleExampleSave, patchDraft, requestId],
  );

  const exitExampleMode = useCallback(() => {
    flushExampleSave();
    setSelectedExampleId(null);
  }, [flushExampleSave, setSelectedExampleId]);

  // When the user clicks an example in the sidebar (for *this* request), jump
  // to the Examples tab. Guarded by a ref so the auto-switch only happens
  // once per id — manual nav back to Params (or any tab) after a save isn't
  // overridden by `saved` re-renders carrying the same selectedExampleId.
  const autoSwitchedExampleRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedExampleId) {
      autoSwitchedExampleRef.current = null;
      return;
    }
    if (autoSwitchedExampleRef.current === selectedExampleId) return;
    const examples = (saved as { examples?: ExampleRow[] } | undefined)?.examples;
    if (examples?.some((e) => e.id === selectedExampleId)) {
      // First param tab is a sensible default — the user just clicked an
      // example, so put them on the first content tab rather than the
      // Examples list panel.
      setTab('params');
      autoSwitchedExampleRef.current = selectedExampleId;
    }
  }, [selectedExampleId, saved]);

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
        bodyType: (saved as { bodyType?: string }).bodyType ?? (saved.body as { type?: string })?.type ?? 'none',
        body: saved.body,
        auth: saved.auth,
        preRequestScript: (saved as { preRequestScript?: string }).preRequestScript ?? '',
        postResponseScript: (saved as { postResponseScript?: string }).postResponseScript ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, saved]);

  // Merged variable map (globals → env → collection chain). Each entry carries
  // not just the value but also which scope it was resolved from, so the
  // VarEditor popover knows where to persist edits. Precedence: deepest
  // collection > shallower collection > env > globals (later writes win).
  const variableMap = useMemo(() => {
    const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
    const chain = saved?.collectionId
      ? (collectColChain(saved.collectionId, collections ?? []) as Array<{
          id: string;
          name?: string;
          variables?: Array<{ key: string; value: string }>;
        }>)
      : [];
    const m = new Map<string, import('@/lib/variables-context').VarInfo>();
    for (const [k, v] of Object.entries(globals ?? {})) {
      if (v != null) {
        m.set(k, {
          value: typeof v === 'string' ? v : JSON.stringify(v),
          scope: 'globals',
          scopeId: null,
          scopeName: 'Globals',
        });
      }
    }
    if (env?.variables) {
      for (const v of env.variables as Array<{ key: string; value: string }>) {
        m.set(v.key, {
          value: v.value,
          scope: 'env',
          scopeId: env.id,
          scopeName: env.name,
        });
      }
    }
    // Iterate the chain in reverse so deepest collection wins.
    for (const c of [...chain].reverse()) {
      if (c.variables) {
        for (const v of c.variables) {
          m.set(v.key, {
            value: v.value,
            scope: 'collection',
            scopeId: c.id,
            scopeName: c.name ?? 'Collection',
          });
        }
      }
    }
    return m;
  }, [globals, environments, activeEnv?.environmentId, collections, saved?.collectionId]);

  const activeEnvName = useMemo(() => {
    const env = environments?.find((e) => e.id === activeEnv?.environmentId);
    return env?.name ?? null;
  }, [environments, activeEnv?.environmentId]);

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
      ((saved as { bodyType?: string }).bodyType ?? '') !== draft.bodyType ||
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

    // OAuth: if the request uses oauth2, refresh/fetch the token now so the
    // resolved request can carry the Authorization header. (resolveLocally is
    // sync; we can't await inside it.)
    let oauthHeader: { key: string; value: string } | null = null;
    const draftAuth = draft.auth as { type?: string } | undefined;
    if (draftAuth?.type === 'oauth2') {
      try {
        const r = (await voltApi['oauth:ensureToken'](draft.auth as never)) as {
          ok: boolean;
          accessToken?: string;
          tokenType?: string;
          error?: string;
        };
        if (!r.ok) {
          onResponse(
            buildClientError(new Error(r.error ?? 'OAuth token unavailable.'), draft.url),
          );
          setSending(false);
          return;
        }
        const prefix =
          ((draft.auth as { headerPrefix?: string }).headerPrefix as string) ?? 'Bearer';
        oauthHeader = {
          key: 'Authorization',
          value: `${prefix} ${r.accessToken}`,
        };
      } catch (err) {
        onResponse(buildClientError(err, draft.url));
        setSending(false);
        return;
      }
    }

    // Resolve client-side using globals (lowest priority) + env + collections.
    const { resolved, variables } = resolveLocally(draft, env, collectionChain, globals ?? {});
    if (oauthHeader) {
      resolved.headers[oauthHeader.key] = oauthHeader.value;
    }

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

  // Open the CodeGen modal with a snapshot of the currently-resolved request
  // (URL with vars substituted, headers as a flat record, body in resolved
  // form). The modal renders curl/fetch/axios/Python/Go/Java/PHP/Ruby snippets.
  const viewCode = useCallback(() => {
    if (!draft) return;
    const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
    const collectionChain = saved?.collectionId
      ? collectColChain(saved.collectionId, collections ?? [])
      : [];
    const { resolved } = resolveLocally(draft, env, collectionChain, globals ?? {});
    openModal({
      kind: 'codegen',
      title: draft.name ?? 'Request',
      request: {
        method: resolved.method,
        url: resolved.url,
        headers: resolved.headers,
        body: resolved.body,
      },
    });
  }, [draft, environments, activeEnv, saved, collections, globals, openModal]);

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
          // Prefer the example's snapshot scripts so re-runs reproduce the
          // captured behavior. Older examples without snapshot scripts fall
          // back to whatever the user currently has.
          preRequestScript: ex.request.preRequestScript ?? draft?.preRequestScript ?? '',
          postResponseScript: ex.request.postResponseScript ?? draft?.postResponseScript ?? '',
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

  // Send button / Cmd+Enter routes to runExample when in example mode so the
  // request that fires reflects the example's (possibly just-edited) snapshot.
  const sendActive = useCallback(async () => {
    if (isExampleMode && exampleWorking) {
      // Persist any in-flight edits so what we send matches what's on disk.
      flushExampleSave();
      await runExample(exampleWorking.example);
      return;
    }
    await send();
  }, [isExampleMode, exampleWorking, flushExampleSave, runExample, send]);

  // Save shortcut: flush in example mode (auto-save handles the rest);
  // commit the draft otherwise.
  const saveActive = useCallback(() => {
    if (isExampleMode) {
      flushExampleSave();
      return;
    }
    void save();
  }, [isExampleMode, flushExampleSave, save]);

  useHotkey('mod+enter', sendActive, { allowInInputs: true });
  useHotkey('mod+s', saveActive, { allowInInputs: true });

  if (isLoading || !saved || !draft) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
        Loading request…
      </div>
    );
  }

  return (
    <VariablesProvider
      value={{
        vars: variableMap,
        workspaceId,
        activeEnvId: activeEnv?.environmentId ?? null,
        activeEnvName,
      }}
    >
    <div className="flex h-full flex-col">
      {/* Example-mode banner. Sits above the name so it's the first thing
          users notice — makes it clear that edits don't touch the live request. */}
      {isExampleMode && (
        <div className="flex items-center justify-between gap-2 border-b border-accent/30 bg-accent/10 px-3 py-1.5 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-text">
            <FileCode2 size={12} className="flex-shrink-0 text-accent" />
            <span className="truncate">
              Editing example ·{' '}
              <span className="font-semibold">{exampleWorking!.example.name}</span>
            </span>
            <ExampleSaveBadge status={exampleSaveStatus} />
          </div>
          <button
            type="button"
            onClick={exitExampleMode}
            className="rounded px-2 py-0.5 text-text-muted hover:bg-bg hover:text-text"
            title="Return to the live request"
          >
            Back to request
          </button>
        </div>
      )}

      {/* Name */}
      <div className="border-b border-border px-3 py-2">
        <input
          value={activeName}
          onChange={(e) => setActiveName(e.target.value)}
          placeholder={isExampleMode ? 'Example name' : 'Untitled request'}
          className="w-full bg-transparent text-sm font-medium text-text outline-none placeholder:text-text-muted"
        />
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <Select
          value={activeRequest.method}
          onChange={(e) => patchActive({ method: e.target.value })}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          className={cn('w-24 font-mono font-semibold', methodColorClass(activeRequest.method))}
        />
        <HighlightedInput
          value={activeRequest.url}
          onChange={(e) => patchActive({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="flex-1"
        />
        {sending ? (
          <Button onClick={cancel} variant="danger" size="md">
            <X size={13} />
            Cancel
          </Button>
        ) : (
          <Button onClick={sendActive} variant="primary" size="md" title="Send (⌘↵)">
            <Send size={13} />
            Send
          </Button>
        )}
        {!isExampleMode && (
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
        )}
        <Button
          onClick={viewCode}
          variant="ghost"
          size="md"
          title="Generate code snippet for this request"
        >
          <Code2 size={13} />
          Code
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="params">
            Params
            {activeRequest.queryParams.length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">
                {activeRequest.queryParams.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="headers">
            Headers
            {activeRequest.headers.length > 0 && (
              <span className="ml-1 text-[10px] text-text-muted">
                {activeRequest.headers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="body">
            Body
            {activeRequest.bodyType !== 'none' && <span className="ml-1 text-[10px] text-accent">●</span>}
          </TabsTrigger>
          <TabsTrigger value="auth">
            Auth
            {(activeRequest.auth as { type: string }).type !== 'none' && (
              <span className="ml-1 text-[10px] text-accent">●</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="scripts">
            Scripts
            {(activeRequest.preRequestScript || activeRequest.postResponseScript) && (
              <span className="ml-1 text-[10px] text-accent">●</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="overflow-y-auto">
          <KeyValueEditor
            rows={activeRequest.queryParams as never}
            onChange={(rows) => patchActive({ queryParams: rows as never })}
            keyPlaceholder="Param"
            valuePlaceholder="Value"
          />
        </TabsContent>

        <TabsContent value="headers" className="overflow-y-auto">
          {!isExampleMode && <AutoHeadersEditor />}
          <KeyValueEditor
            rows={activeRequest.headers as never}
            onChange={(rows) => patchActive({ headers: rows as never })}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
            suggest="headers"
          />
        </TabsContent>

        <TabsContent value="body" className="overflow-hidden">
          <BodyEditor
            body={activeRequest.body as Body}
            onChange={(body) => patchActive({ body, bodyType: body.type })}
          />
        </TabsContent>

        <TabsContent value="auth" className="overflow-hidden">
          <AuthEditor
            auth={activeRequest.auth as never}
            onChange={(auth) => patchActive({ auth: auth as never })}
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
                value={activeRequest.preRequestScript}
                onChange={(v) => patchActive({ preRequestScript: v })}
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
                value={activeRequest.postResponseScript}
                onChange={(v) => patchActive({ postResponseScript: v })}
                language="javascript"
                className="flex-1"
                placeholder="// Runs after the response arrives — set globals from response data."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </VariablesProvider>
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
  } else if (body.type === 'graphql') {
    // GraphQL: substitute vars in both the query and the variables JSON. The
    // engine validates the variables blob is JSON before sending.
    resolvedBody = {
      type: 'graphql',
      query: subst((body.query as string) ?? ''),
      variables: subst((body.variables as string) ?? ''),
      operationName: body.operationName as string | undefined,
    };
    const hasContentType = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'content-type',
    );
    if (!hasContentType) headers['Content-Type'] = 'application/json';
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
    /** Optional — examples captured before script-snapshot landed won't have these. */
    preRequestScript?: string;
    postResponseScript?: string;
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

function ExampleSaveBadge({ status }: { status: 'idle' | 'pending' | 'saving' }) {
  if (status === 'idle') {
    return <span className="text-[10px] text-text-muted">Saved</span>;
  }
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-text-muted">
        <Loader2 size={9} className="animate-spin" /> Saving…
      </span>
    );
  }
  // pending — local edits queued for the debounced save.
  return <span className="text-[10px] text-accent">Unsaved</span>;
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
