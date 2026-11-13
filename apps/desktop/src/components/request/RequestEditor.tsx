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
import { buildVariableMap, substituteVariables, type ScopeCollection } from '@/lib/variables';
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
/**
 * Per-request snapshot (JSON) of the draft as it was built from the last
 * saved row we showed. Lets us tell "the user edited this" apart from "a
 * teammate changed the saved row underneath us". Module-level so it survives
 * tab switches, like the drafts store.
 */
const draftBaselines = new Map<string, string>();

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
  const [sendSettings, patchSendSettings] = useSendSettings();

  // Active editor tab. Controlled so we can jump to "examples" automatically
  // when the user clicks an example row in the sidebar.
  const [tab, setTab] = useState<string>('params');
  // Set when a teammate changed this request while the user has unsaved edits.
  const [remoteChange, setRemoteChange] = useState<{ requestId: string; next: unknown } | null>(null);
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
    pathVariables: QpRow[];
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
        pathVariables: exampleWorking!.example.request.pathVariables ?? [],
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
        pathVariables: ((draft as { pathVariables?: QpRow[] } | undefined)?.pathVariables) ?? [],
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
        pathVariables: unknown;
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

  // Initialize the draft when the saved row loads, and keep it live when a
  // teammate's change arrives through sync:
  //   - no local edits  → adopt their version silently;
  //   - local edits     → keep the user's draft and show a banner to choose.
  useEffect(() => {
    if (!saved) return;
    // Bring URL bar and Params table into agreement (Postman keeps them
    // synced). Pairs typed only into the URL of an older request become
    // rows; the URL is then rewritten from the rows.
    const mergedQp = mergeUrlQueryIntoRows(saved.url, (saved.queryParams as QpRow[]) ?? []);
    const fromSaved = {
      name: saved.name,
      method: saved.method,
      url: buildUrlFromParams(saved.url, mergedQp),
      headers: saved.headers as never,
      queryParams: mergedQp as never,
      pathVariables: ((saved as { pathVariables?: QpRow[] }).pathVariables ?? []) as never,
      bodyType: (saved as { bodyType?: string }).bodyType ?? (saved.body as { type?: string })?.type ?? 'none',
      body: saved.body,
      auth: saved.auth,
      preRequestScript: (saved as { preRequestScript?: string }).preRequestScript ?? '',
      postResponseScript: (saved as { postResponseScript?: string }).postResponseScript ?? '',
    };
    const nextJson = JSON.stringify(fromSaved);
    const current = drafts.get(requestId);
    const baseline = draftBaselines.get(requestId);
    if (!current) {
      setDraft(requestId, fromSaved as never);
      draftBaselines.set(requestId, nextJson);
      return;
    }
    const currentJson = JSON.stringify(current);
    if (nextJson === baseline) return; // saved row unchanged in substance
    if (currentJson === nextJson) {
      // Our own save came back (or both sides converged).
      draftBaselines.set(requestId, nextJson);
      setRemoteChange(null);
      return;
    }
    if (currentJson === baseline) {
      // No local edits: follow the server.
      setDraft(requestId, fromSaved as never);
      draftBaselines.set(requestId, nextJson);
      setRemoteChange(null);
      return;
    }
    // Local edits AND a remote change: don't clobber either side silently.
    setRemoteChange({ requestId, next: fromSaved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, saved]);

  // Merged variable map (globals → collection chain → env). Each entry carries
  // not just the value but also which scope it was resolved from, so the
  // VarEditor popover knows where to persist edits. Precedence (Postman):
  // env > deepest collection > shallower collection > globals.
  const variableMap = useMemo(() => {
    const env = environments?.find((e) => e.id === activeEnv?.environmentId) ?? null;
    const chain = saved?.collectionId
      ? (collectColChain(saved.collectionId, collections ?? []) as ScopeCollection[])
      : [];
    return buildVariableMap(globals, env, chain);
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
      JSON.stringify((saved as { pathVariables?: unknown }).pathVariables ?? []) !==
        JSON.stringify((draft as { pathVariables?: unknown }).pathVariables ?? []) ||
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
      pathVariables: (draft as { pathVariables?: unknown }).pathVariables ?? [],
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
        // Substitute {{vars}} in every string field of the OAuth config
        // (tokenUrl, clientId, clientSecret, scope, …) before the token call.
        const sendVars = buildVariableMap(globals, env, collectionChain as ScopeCollection[]);
        const oauthCfg = Object.fromEntries(
          Object.entries(draft.auth as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === 'string' ? substituteVariables(v, sendVars) : v,
          ]),
        );
        const r = (await voltApi['oauth:ensureToken'](oauthCfg as never)) as {
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
    const { resolved, variables, unresolvedUrlVar } = resolveLocally(draft, env, collectionChain, globals ?? {});
    // A pre-request script may define the variable itself, so only fail early
    // when there is no script that could still fill it in.
    if (unresolvedUrlVar && !(draft.preRequestScript ?? '').trim()) {
      onResponse(buildUnresolvedVarError(unresolvedUrlVar));
      setSending(false);
      return;
    }
    if (oauthHeader) {
      setHeaderCI(resolved.headers, oauthHeader.key, oauthHeader.value);
    }
    applySendSettings(resolved, sendSettings);

    const id = rowId('send');
    sendIdRef.current = id;
    setInFlight(requestId, id);

    try {
      const response = await voltApi['request:send']({
        inFlightId: id,
        requestId,
        requestName: draft.name ?? '',
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
  }, [draft, environments, activeEnv, saved, collections, globals, requestId, workspaceId, setInFlight, onResponse, qc, sendSettings]);

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
      const { resolved, variables, unresolvedUrlVar } = resolveLocally(
        {
          method: ex.request.method,
          url: ex.request.url,
          headers: ex.request.headers as never,
          queryParams: ex.request.queryParams as never,
          pathVariables: ex.request.pathVariables ?? [],
          bodyType: ex.request.bodyType,
          body: ex.request.body,
          auth: ex.request.auth,
        },
        env,
        collectionChain,
        globals ?? {},
      );
      const exPreScript = ex.request.preRequestScript ?? draft?.preRequestScript ?? '';
      if (unresolvedUrlVar && !exPreScript.trim()) {
        onResponse(buildUnresolvedVarError(unresolvedUrlVar));
        return;
      }
      applySendSettings(resolved, sendSettings);
      const id = rowId('send');
      sendIdRef.current = id;
      setInFlight(requestId, id);
      setSending(true);
      try {
        const response = await voltApi['request:send']({
          inFlightId: id,
          requestId,
          requestName: draft?.name ?? ex.name,
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
    [draft, environments, activeEnv, saved, collections, globals, requestId, workspaceId, setInFlight, onResponse, sendSettings],
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
      {remoteChange && remoteChange.requestId === requestId && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-text">
          <span className="truncate">
            A teammate changed this request while you have unsaved edits.
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="rounded px-2 py-0.5 font-medium hover:bg-amber-500/20"
              onClick={() => {
                setDraft(requestId, remoteChange.next as never);
                draftBaselines.set(requestId, JSON.stringify(remoteChange.next));
                setRemoteChange(null);
              }}
            >
              Load their version
            </button>
            <button
              type="button"
              className="rounded px-2 py-0.5 hover:bg-amber-500/20"
              onClick={() => {
                // Keep my edits; Save will intentionally overwrite theirs.
                draftBaselines.set(requestId, JSON.stringify(remoteChange.next));
                setRemoteChange(null);
              }}
            >
              Keep mine
            </button>
          </div>
        </div>
      )}
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
          onChange={(e) => {
            const url = e.target.value;
            // Keep the Params table in step with the query string typed here.
            patchActive({
              url,
              queryParams: syncParamsFromUrl(url, activeRequest.queryParams as QpRow[]) as never,
            });
          }}
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
          <TabsTrigger value="settings">
            Settings
            {(!sendSettings.verifyTls || !sendSettings.followRedirects) && (
              <span className="ml-1 text-[10px] text-warning">●</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="overflow-y-auto">
          <KeyValueEditor
            rows={activeRequest.queryParams as never}
            onChange={(rows) =>
              // Rows are the source of truth; rewrite the URL's query from them.
              patchActive({
                queryParams: rows as never,
                url: buildUrlFromParams(activeRequest.url, rows as QpRow[]),
              })
            }
            keyPlaceholder="Param"
            valuePlaceholder="Value"
          />
          <PathVariablesTable
            url={activeRequest.url}
            rows={activeRequest.pathVariables}
            onChange={(rows) => patchActive({ pathVariables: rows as never })}
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

        <TabsContent value="settings" className="overflow-y-auto p-3">
          <SendSettingsTab settings={sendSettings} onChange={patchSendSettings} />
        </TabsContent>
      </Tabs>
    </div>
    </VariablesProvider>
  );
}

// ─────────────────────────────────────────────────────────
// Send settings (Postman "Settings": redirects, TLS verification, timeout)
// ─────────────────────────────────────────────────────────

interface SendSettings {
  followRedirects: boolean;
  verifyTls: boolean;
  /** 0 = no timeout. */
  timeoutMs: number;
}

const SEND_SETTINGS_KEY = 'volt.sendSettings';
const DEFAULT_SEND_SETTINGS: SendSettings = { followRedirects: true, verifyTls: true, timeoutMs: 60_000 };

export function loadSendSettings(): SendSettings {
  try {
    const raw = localStorage.getItem(SEND_SETTINGS_KEY);
    if (!raw) return DEFAULT_SEND_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SendSettings>;
    return {
      followRedirects: parsed.followRedirects ?? DEFAULT_SEND_SETTINGS.followRedirects,
      verifyTls: parsed.verifyTls ?? DEFAULT_SEND_SETTINGS.verifyTls,
      timeoutMs:
        typeof parsed.timeoutMs === 'number' && Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs >= 0
          ? Math.floor(parsed.timeoutMs)
          : DEFAULT_SEND_SETTINGS.timeoutMs,
    };
  } catch {
    return DEFAULT_SEND_SETTINGS;
  }
}

/**
 * App-wide send settings, persisted in localStorage (they're per-machine
 * preferences, like Postman's, not part of the synced request definition).
 */
function useSendSettings(): [SendSettings, (patch: Partial<SendSettings>) => void] {
  const [settings, setSettings] = useState<SendSettings>(loadSendSettings);
  const patch = useCallback((p: Partial<SendSettings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(SEND_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory value */
      }
      return next;
    });
  }, []);
  return [settings, patch];
}

export function applySendSettings(
  resolved: { timeoutMs: number; followRedirects: boolean; ignoreTlsErrors: boolean },
  s: SendSettings,
) {
  resolved.timeoutMs = s.timeoutMs;
  resolved.followRedirects = s.followRedirects;
  resolved.ignoreTlsErrors = !s.verifyTls;
}

function SendSettingsTab({
  settings,
  onChange,
}: {
  settings: SendSettings;
  onChange: (patch: Partial<SendSettings>) => void;
}) {
  return (
    <div className="flex max-w-md flex-col gap-3 text-xs">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={settings.followRedirects}
          onChange={(e) => onChange({ followRedirects: e.target.checked })}
          className="mt-0.5 h-3 w-3 accent-accent"
        />
        <span>
          <span className="text-text">Automatically follow redirects</span>
          <span className="block text-[11px] text-text-muted">
            Off: 3xx responses are shown as-is instead of being followed (up to 10 hops).
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={settings.verifyTls}
          onChange={(e) => onChange({ verifyTls: e.target.checked })}
          className="mt-0.5 h-3 w-3 accent-accent"
        />
        <span>
          <span className="text-text">Verify TLS certificates</span>
          <span className="block text-[11px] text-text-muted">
            Off: accept self-signed and expired certificates (e.g. local dev servers).
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-text">Request timeout</span>
        <input
          type="number"
          min={0}
          step={1000}
          value={settings.timeoutMs}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange({ timeoutMs: Math.floor(n) });
          }}
          className="w-28 rounded border border-border bg-bg px-2 py-1 font-mono text-text outline-none focus:border-accent"
        />
        <span className="text-text-muted">ms (0 = no timeout)</span>
      </label>
      <p className="text-[11px] text-text-muted">
        These apply to every request sent from this machine and are not synced.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Local resolution helpers
// ─────────────────────────────────────────────────────────

export function collectColChain(collectionId: string, collections: Array<{ id: string; parentId: string | null; variables?: unknown }>): unknown[] {
  const chain: typeof collections = [];
  let cur = collections.find((c) => c.id === collectionId);
  while (cur) {
    chain.push(cur);
    cur = cur.parentId ? collections.find((c) => c.id === cur!.parentId) : undefined;
  }
  return chain;
}

/** Set a header, replacing any existing one with the same name in any casing. */
export function setHeaderCI(headers: Record<string, string>, name: string, value: string) {
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) delete headers[k];
  }
  headers[name] = value;
}

/** UTF-8-safe base64 — plain btoa() throws on any non-Latin1 character. */
function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Client-side resolution — handles {{var}} substitution from environment +
 * collection chain. Secret refs are not resolved here (they go via IPC to
 * keytar in main process); we send them as-is for now and rely on main
 * process to substitute. For MVP we just do simple env merging.
 */
export function resolveLocally(
  draft: {
    method: string;
    url: string;
    headers: unknown;
    queryParams: unknown;
    pathVariables?: unknown;
    bodyType: string;
    body: unknown;
    auth: unknown;
  },
  env: { id: string; name: string; variables?: Array<{ key: string; value: string }> } | null,
  collections: unknown[],
  globals: Record<string, unknown> = {},
) {
  // Precedence (Postman): env > collection chain (deepest first) > globals.
  // Disabled rows are skipped; {{$guid}} / {{$timestamp}} / … are generated.
  const vars = buildVariableMap(globals, env, collections as ScopeCollection[]);
  const subst = (s: string) => substituteVariables(s, vars);

  // Headers (filter disabled + subst)
  const headers: Record<string, string> = {};
  for (const h of (draft.headers as Array<{ key: string; value: string; enabled?: boolean }>) ?? []) {
    if (h.enabled === false) continue;
    if (h.key) headers[subst(h.key)] = subst(h.value);
  }

  // URL. The Params table is the source of truth for the query string (the
  // URL bar and the table are kept in sync while editing); pairs that exist
  // only in the raw URL (examples / rows saved before the sync landed) are
  // merged in rather than appended, so nothing is sent twice. Path segments
  // like `/users/:id` are filled from the Path Variables table. Unresolved
  // `{{name}}` placeholders in the URL are reported to the caller.
  const unresolvedInUrl = new Set<string>();
  const substUrl = (s: string) => substituteVariables(s, vars, unresolvedInUrl);
  const qpRows = mergeUrlQueryIntoRows(draft.url, (draft.queryParams as QpRow[]) ?? []);
  let url = substUrl(
    applyPathVariables(splitUrl(draft.url).base, (draft.pathVariables as QpRow[]) ?? [], substUrl),
  );
  const enabledQp = qpRows.filter((q) => q.enabled !== false && (q.key || q.value));
  if (enabledQp.length > 0) {
    url +=
      '?' +
      enabledQp
        .map((q) => `${encodeQueryComponent(substUrl(q.key))}=${encodeQueryComponent(substUrl(q.value))}`)
        .join('&');
  }
  const unresolvedUrlVar: string | null = unresolvedInUrl.size > 0 ? [...unresolvedInUrl][0]! : null;

  // Auth
  const auth = draft.auth as { type: string; [k: string]: unknown };
  // Auth helper wins over a manually typed header with the same name (any
  // casing) — otherwise the request goes out with two Authorization headers.
  if (auth.type === 'bearer' && (auth.token as string)) {
    setHeaderCI(headers, 'Authorization', `Bearer ${subst(auth.token as string)}`);
  } else if (auth.type === 'basic') {
    const encoded = utf8ToBase64(
      `${subst((auth.username as string) ?? '')}:${subst((auth.password as string) ?? '')}`,
    );
    setHeaderCI(headers, 'Authorization', `Basic ${encoded}`);
  } else if (auth.type === 'apiKey') {
    const k = subst((auth.key as string) ?? '');
    const v = subst((auth.value as string) ?? '');
    if (k) {
      if (auth.placement === 'query') {
        url += (url.includes('?') ? '&' : '?') + `${encodeQueryComponent(k)}=${encodeQueryComponent(v)}`;
      } else {
        setHeaderCI(headers, k, v);
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
    variables: Object.fromEntries(Array.from(vars, ([k, v]) => [k, v.value])),
    unresolvedUrlVar,
  };
}

// ─────────────────────────────────────────────────────────
// URL ↔ Params sync + path variables
// ─────────────────────────────────────────────────────────

type QpRow = { id: string; key: string; value: string; enabled?: boolean; description?: string };

/** Split a raw (unsubstituted) URL into base, query (without `?`) and hash. */
function splitUrl(url: string): { base: string; query: string | null; hash: string } {
  const hashIdx = url.indexOf('#');
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = noHash.indexOf('?');
  if (qIdx < 0) return { base: noHash, query: null, hash };
  return { base: noHash.slice(0, qIdx), query: noHash.slice(qIdx + 1), hash };
}

/** `a=1&b&c=` → [['a','1'],['b',''],['c','']]. Raw text, no decoding, so `{{var}}` survives. */
function parseQueryPairs(query: string | null): Array<[string, string]> {
  if (!query) return [];
  return query
    .split('&')
    .filter((p) => p.length > 0)
    .map((p) => {
      const eq = p.indexOf('=');
      return eq < 0 ? [p, ''] : [p.slice(0, eq), p.slice(eq + 1)];
    });
}

/**
 * URL bar → Params table. The query string typed in the URL replaces the
 * enabled rows (matched by position so row ids, and thus focus, stay stable
 * while typing); disabled rows aren't part of the URL and are kept.
 */
function syncParamsFromUrl(url: string, rows: QpRow[]): QpRow[] {
  const pairs = parseQueryPairs(splitUrl(url).query);
  const enabled = rows.filter((r) => r.enabled !== false);
  const disabled = rows.filter((r) => r.enabled === false);
  const next: QpRow[] = pairs.map(([key, value], i) => {
    const existing = enabled[i];
    return existing
      ? { ...existing, key, value, enabled: true }
      : { id: rowId('kv'), key, value, enabled: true };
  });
  return [...next, ...disabled];
}

/** Params table → URL bar. Enabled rows become the query; the base + hash are kept. */
export function buildUrlFromParams(url: string, rows: QpRow[]): string {
  const { base, hash } = splitUrl(url);
  const pairs = rows
    .filter((r) => r.enabled !== false && (r.key || r.value))
    .map((r) => (r.value ? `${r.key}=${r.value}` : r.key));
  return base + (pairs.length > 0 ? `?${pairs.join('&')}` : '') + hash;
}

/**
 * Union of the table rows and any pairs present only in the URL's query
 * (older saved requests / examples where only the URL was edited). Used
 * when loading a draft and at send time so nothing is lost or sent twice.
 */
export function mergeUrlQueryIntoRows(url: string, rows: QpRow[]): QpRow[] {
  const pairs = parseQueryPairs(splitUrl(url).query);
  if (pairs.length === 0) return rows;
  const enabled = rows.filter((r) => r.enabled !== false);
  const extra: QpRow[] = [];
  for (const [key, value] of pairs) {
    const present =
      enabled.some((r) => r.key === key && r.value === value) ||
      extra.some((r) => r.key === key && r.value === value);
    if (!present) extra.push({ id: rowId('kv'), key, value, enabled: true });
  }
  return extra.length > 0 ? [...rows, ...extra] : rows;
}

// `/:name` path segments (host:port is never matched because we only look at
// the part after the authority).
const PATH_VAR_RE = /\/:([A-Za-z_][\w.-]*)(?=\/|$)/g;

/** Index where the path begins in a raw URL base (after scheme + authority), or -1. */
function pathStart(base: string): number {
  const schemeIdx = base.indexOf('://');
  return schemeIdx >= 0 ? base.indexOf('/', schemeIdx + 3) : base.indexOf('/');
}

/** Ordered, de-duplicated `:name` keys in the URL path. */
function derivePathVarKeys(url: string): string[] {
  const base = splitUrl(url).base;
  const start = pathStart(base);
  if (start < 0) return [];
  const keys: string[] = [];
  for (const m of base.slice(start).matchAll(PATH_VAR_RE)) {
    const k = m[1]!;
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

/** Replace `/:name` segments with the (substituted) value from the table; empty values are left as-is. */
function applyPathVariables(base: string, rows: QpRow[], subst: (s: string) => string): string {
  const start = pathStart(base);
  if (start < 0 || rows.length === 0) return base;
  const head = base.slice(0, start);
  const path = base.slice(start).replace(PATH_VAR_RE, (match, name: string) => {
    const row = rows.find((r) => r.key === name && r.enabled !== false);
    const value = row ? subst(row.value) : '';
    return value ? `/${value}` : match;
  });
  return head + path;
}

/**
 * Postman-style Path Variables table: keys are derived from `:name` segments
 * in the URL (read-only); only the values are editable. Hidden when the URL
 * has no path variables.
 */
function PathVariablesTable({
  url,
  rows,
  onChange,
}: {
  url: string;
  rows: QpRow[];
  onChange: (rows: QpRow[]) => void;
}) {
  const keys = useMemo(() => derivePathVarKeys(url), [url]);
  if (keys.length === 0) return null;
  // Rows shown = current keys, carrying over any value already stored.
  const shown: QpRow[] = keys.map(
    (k) => rows.find((r) => r.key === k) ?? { id: `pv-${k}`, key: k, value: '', enabled: true },
  );
  const setValue = (key: string, value: string) =>
    onChange(shown.map((r) => (r.key === key ? { ...r, value } : r)));
  return (
    <div className="border-t border-border">
      <div className="bg-bg-elevated px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        Path variables
      </div>
      {shown.map((row) => (
        <div key={row.key} className="flex items-center gap-1 border-b border-border/40 px-1 py-0.5">
          <span className="w-5" />
          <span className="flex-1 truncate px-2 font-mono text-xs text-text-muted" title={`:${row.key}`}>
            {row.key}
          </span>
          <HighlightedInput
            flat
            value={row.value}
            onChange={(e) => setValue(row.key, e.target.value)}
            placeholder="Value"
            className="flex-1"
          />
          <span className="w-6" />
        </div>
      ))}
    </div>
  );
}

function buildUnresolvedVarError(name: string) {
  return {
    ok: false as const,
    errorCode: 'UNRESOLVED_VARIABLE',
    errorMessage: `Unresolved variable {{${name}}} in URL. Select an environment or define it.`,
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

interface ExampleRow {
  id: string;
  name: string;
  createdAt: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ key: string; value: string }>;
    queryParams: Array<{ key: string; value: string }>;
    pathVariables?: QpRow[];
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
      <p className="mt-2">
        Scripts use the Postman <code>pm</code> API, so snippets from Postman docs work as-is.{' '}
        <code>volt</code> is an alias for <code>pm</code>.
      </p>
      <div className="mt-2 space-y-1 font-mono">
        <p><code>pm.test(name, fn)</code> — register a test; results show in the Tests tab. <code>pm.test.skip(name, fn)</code> to skip.</p>
        <p><code>pm.expect(value)</code> — Chai-style assertions: <code>.to.equal()</code>, <code>.to.eql()</code>, <code>.to.be.true</code>, <code>.to.have.property()</code>, <code>.to.include()</code>, <code>.to.be.a()</code>…</p>
        <p><code>pm.response</code> — post-response: <code>.code</code>, <code>.status</code>, <code>.headers.get(name)</code>, <code>.text()</code>, <code>.json()</code>, <code>.responseTime</code>, <code>.to.have.status(200)</code>, <code>.to.be.ok</code></p>
        <p><code>pm.request</code> — <code>.url</code>, <code>.method</code>, <code>.headers</code>, <code>.body</code> (mutable in pre-request)</p>
        <p><code>pm.environment.get(key)</code> / <code>set(key, value)</code> / <code>unset(key)</code> / <code>has(key)</code> / <code>toObject()</code> / <code>.name</code></p>
        <p><code>pm.globals.get(key)</code> / <code>set(key, value)</code> / <code>unset(key)</code> / <code>has(key)</code> / <code>toObject()</code></p>
        <p><code>pm.variables.get(key)</code> / <code>set(key, value)</code> — merged globals + env + collection map (set = this run only); <code>pm.variables.replaceIn(str)</code></p>
        <p><code>pm.collectionVariables</code> — same shape, scoped to the collection</p>
        <p><code>pm.sendRequest(urlOrOptions, (err, res) =&gt; …)</code> — fire a side request (also returns a Promise)</p>
        <p><code>pm.info</code> — <code>.eventName</code> (<code>prerequest</code> / <code>test</code>), <code>.requestName</code>, <code>.requestId</code></p>
        <p><code>console.log(...)</code> — output appears above the response body and in the Tests tab</p>
      </div>
      <div className="mt-2 font-mono">
        <p className="text-text">Example (post-response):</p>
        <pre className="mt-1 rounded bg-bg p-2 text-text-muted">
{`pm.test('status is 200', () => pm.response.to.have.status(200));

const data = pm.response.json();
pm.test('has a token', () => {
  pm.expect(data).to.have.property('token');
});
if (data?.token) {
  // persist for later requests: globals (per-device)…
  pm.globals.set('authToken', data.token);
  // …or the active environment (synced to the backend)
  pm.environment.set('authToken', data.token);
}`}
        </pre>
      </div>
    </details>
  );
}

/**
 * Percent-encode a query key/value like Postman: everything that needs
 * encoding is encoded, but a value the user already encoded (`a%20b`,
 * `%7Bid%7D`) is left alone instead of being double-encoded to `%2520`.
 */
function encodeQueryComponent(s: string): string {
  return encodeURIComponent(s).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
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
