import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { useCollections, useRequests } from '@/hooks/useData';
import { voltApi } from '@/lib/volt-api';
import { selectPath } from '@/lib/jsonpath-mini';
import { buildVariableMap, substituteVariables } from '@/lib/variables';
import { cn, methodColorClass, rowId, statusColorClass, tryDecodeBase64 } from '@/lib/util';

interface ChainStep {
  id: string;
  requestId: string;
  /** Optional: extract a JSON path from this step's response into a global. */
  extractPath?: string;
  extractGlobal?: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  error: string | null;
  skipped?: boolean;
}

interface ScriptOutput {
  logs: string[];
  error: string | null;
  tests?: TestResult[];
}

interface RunEntry {
  stepId: string;
  ok: boolean;
  statusCode?: number;
  durationMs?: number;
  errorMessage?: string;
  extracted?: { key: string; value: unknown };
  /** Extract path was configured but produced nothing (not JSON / missing). */
  extractMiss?: string;
  tests: TestResult[];
  scriptErrors: string[];
  /** Network/script error or a failed test — what "stop on failure" keys off. */
  failed: boolean;
}

/**
 * Visual request-chain runner. Steps execute in order. After each step we can
 * extract a value from the response (via `selectPath`) into a global; the
 * NEXT step will then resolve `{{globalName}}` to that value.
 */
export function ChainModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'chain';
  const { workspaceId } = useSelection();
  const { data: requests } = useRequests(workspaceId);
  const { data: collections } = useCollections(workspaceId);
  const qc = useQueryClient();

  // Chain definition is persisted in localStorage so it survives a reload.
  const storageKey = `volt:chain:${workspaceId ?? 'none'}`;
  const [steps, setSteps] = useState<ChainStep[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      setSteps(Array.isArray(saved) ? saved : []);
    } catch {
      setSteps([]);
    }
  }, [isOpen, storageKey]);
  useEffect(() => {
    if (isOpen) localStorage.setItem(storageKey, JSON.stringify(steps));
  }, [isOpen, steps, storageKey]);

  const requestById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; method: string }>();
    for (const r of (requests as Array<{ id: string; name: string; method: string }>) ?? []) {
      m.set(r.id, r);
    }
    return m;
  }, [requests]);

  const [log, setLog] = useState<RunEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [stopOnFailure, setStopOnFailure] = useState(true);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);

  function addStep() {
    setSteps([...steps, { id: rowId('step'), requestId: '' }]);
  }
  function updateStep(id: string, patch: Partial<ChainStep>) {
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  }
  function removeStep(id: string) {
    setSteps((s) => s.filter((st) => st.id !== id));
  }

  async function run() {
    if (!workspaceId) return;
    setRunning(true);
    setLog([]);
    setStoppedAt(null);
    const failEntry = (step: ChainStep, errorMessage: string): RunEntry => ({
      stepId: step.id,
      ok: false,
      errorMessage,
      tests: [],
      scriptErrors: [],
      failed: true,
    });
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        if (!step.requestId) continue;
        let entry: RunEntry;
        try {
          // Each step is resolved against the CURRENT env / globals / collection
          // vars (re-read per step) so values written by an earlier step's
          // post-response script or extract rule are visible to the next one.
          const saved = (await voltApi['apiRequest:get']({ id: step.requestId })) as
            | Record<string, unknown>
            | null;
          if (!saved) {
            entry = failEntry(step, 'Request not found (was it deleted?)');
          } else {
            const { resolved, variables, environmentId } = await resolveForSend(
              saved,
              workspaceId,
              (collections ?? []) as CollectionRow[],
            );
            const inFlightId = rowId('chain-send');
            const r = (await voltApi['request:send']({
              inFlightId,
              request: resolved as never,
              preRequestScript: (saved.preRequestScript as string | undefined) ?? '',
              postResponseScript: (saved.postResponseScript as string | undefined) ?? '',
              variables,
              workspaceId,
              environmentId,
            } as never)) as {
              ok: boolean;
              statusCode?: number;
              bodyBase64?: string | null;
              bodyContentType?: string | null;
              errorCode?: string;
              errorMessage?: string;
              timing?: { totalMs: number } | null;
              preScript?: ScriptOutput;
              postScript?: ScriptOutput;
            };

            let extracted: RunEntry['extracted'];
            let extractMiss: string | undefined;
            if (r.ok && step.extractPath && step.extractGlobal) {
              const decoded = r.bodyBase64
                ? tryDecodeBase64(r.bodyBase64, r.bodyContentType ?? null).text
                : null;
              let value: unknown;
              let parsedOk = false;
              if (decoded) {
                try {
                  value = selectPath(JSON.parse(decoded), step.extractPath);
                  parsedOk = true;
                } catch {
                  /* not JSON */
                }
              }
              if (value !== undefined) {
                await voltApi['globals:set']({ key: step.extractGlobal, value });
                extracted = { key: step.extractGlobal, value };
              } else {
                extractMiss = parsedOk
                  ? `path "${step.extractPath}" not found in response JSON`
                  : 'response body is not JSON';
              }
            }

            const tests = [...(r.preScript?.tests ?? []), ...(r.postScript?.tests ?? [])];
            const scriptErrors = [
              r.preScript?.error ? `Pre-request script: ${r.preScript.error}` : null,
              r.postScript?.error ? `Post-response script: ${r.postScript.error}` : null,
            ].filter((x): x is string => !!x);
            entry = {
              stepId: step.id,
              ok: r.ok,
              statusCode: r.statusCode,
              durationMs: r.timing?.totalMs ?? undefined,
              errorMessage: r.errorMessage,
              extracted,
              extractMiss,
              tests,
              scriptErrors,
              failed: !r.ok || scriptErrors.length > 0 || tests.some((t) => !t.passed),
            };
          }
        } catch (err) {
          entry = failEntry(step, err instanceof Error ? err.message : String(err));
        }
        setLog((l) => [...l, entry]);
        if (entry.failed && stopOnFailure) {
          setStoppedAt(i);
          break;
        }
      }
    } finally {
      setRunning(false);
      // Scripts / extract rules may have written env vars + globals — refresh
      // so the rest of the UI (env modal, {{var}} highlighting) reflects it.
      qc.invalidateQueries({ queryKey: ['environments', workspaceId] });
      qc.invalidateQueries({ queryKey: ['globals'] });
    }
  }

  const summary = useMemo(() => {
    const ran = log.length;
    const failedSteps = log.filter((l) => l.failed).length;
    const allTests = log.flatMap((l) => l.tests);
    const passed = allTests.filter((t) => t.passed).length;
    return { ran, failedSteps, tests: allTests.length, passed };
  }, [log]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Request chain"
      className="max-w-3xl"
    >
      <div className="flex h-[30rem] flex-col gap-3">
        <p className="text-[11px] text-text-muted">
          Run a sequence of requests. Optionally extract a JSON path from each response into a
          global; the next step can reference it as <code className="font-mono text-text">{'{{varname}}'}</code>.
        </p>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          {steps.map((step, i) => {
            const req = requestById.get(step.requestId);
            const result = log.find((l) => l.stepId === step.id);
            return (
              <div
                key={step.id}
                className="rounded-md border border-border bg-bg p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 text-[10px] text-text-muted">{i + 1}.</span>
                  <Select
                    value={step.requestId}
                    onChange={(e) => updateStep(step.id, { requestId: e.target.value })}
                    options={[
                      { value: '', label: 'Pick request…' },
                      ...((requests ?? []) as Array<{ id: string; name: string; method: string }>).map(
                        (r) => ({ value: r.id, label: `${r.method} · ${r.name}` }),
                      ),
                    ]}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="rounded p-1 text-text-muted hover:bg-bg-elevated hover:text-error"
                    title="Remove step"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {req && (
                  <p className="ml-7 mt-1 text-[10px] text-text-muted">
                    <span className={cn('font-mono font-semibold', methodColorClass(req.method))}>
                      {req.method}
                    </span>{' '}
                    {req.name}
                  </p>
                )}

                {/* Optional extract */}
                <div className="ml-7 mt-2 grid grid-cols-2 gap-2">
                  <Input
                    value={step.extractPath ?? ''}
                    onChange={(e) => updateStep(step.id, { extractPath: e.target.value })}
                    placeholder="Extract JSON path (e.g. data.token)"
                  />
                  <Input
                    value={step.extractGlobal ?? ''}
                    onChange={(e) => updateStep(step.id, { extractGlobal: e.target.value })}
                    placeholder="…into global (e.g. authToken)"
                  />
                </div>

                {result && (
                  <div className="ml-7 mt-2 space-y-1 text-[11px]">
                    {result.ok ? (
                      <p>
                        <span className={cn('font-mono font-semibold', statusColorClass(result.statusCode))}>
                          {result.statusCode}
                        </span>
                        <span className="ml-2 text-text-muted">{result.durationMs}ms</span>
                        {result.extracted && (
                          <span className="ml-2 text-success">
                            → set <code className="font-mono">{result.extracted.key}</code>
                          </span>
                        )}
                        {result.extractMiss && (
                          <span className="ml-2 text-warning">extract skipped: {result.extractMiss}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-error">
                        Failed: {result.errorMessage ?? '(no detail)'}
                      </p>
                    )}
                    {result.scriptErrors.map((e, idx) => (
                      <p key={idx} className="font-mono text-error">
                        {e}
                      </p>
                    ))}
                    {result.tests.length > 0 && (
                      <ul className="space-y-0.5 font-mono">
                        {result.tests.map((t, idx) => (
                          <li
                            key={idx}
                            className={cn(
                              t.skipped ? 'text-text-muted' : t.passed ? 'text-success' : 'text-error',
                            )}
                          >
                            {t.skipped ? '○' : t.passed ? '✓' : '✗'} {t.name}
                            {!t.passed && t.error && (
                              <span className="text-text-muted"> — {t.error}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {stoppedAt === i && i < steps.length - 1 && (
                  <p className="ml-7 mt-1 text-[10px] text-warning">
                    Stopped here — remaining steps were not run.
                  </p>
                )}
              </div>
            );
          })}

          <Button size="sm" variant="ghost" onClick={addStep} className="self-start">
            <Plus size={12} />
            Add step
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={stopOnFailure}
                onChange={(e) => setStopOnFailure(e.target.checked)}
                disabled={running}
              />
              Stop on failure
            </label>
            {log.length > 0 && (
              <span>
                {summary.ran} step{summary.ran === 1 ? '' : 's'} ran
                {summary.failedSteps > 0 && (
                  <span className="text-error">, {summary.failedSteps} failed</span>
                )}
                {summary.tests > 0 && (
                  <>
                    {' · '}
                    <span className={summary.passed === summary.tests ? 'text-success' : 'text-error'}>
                      {summary.passed}/{summary.tests} tests passed
                    </span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={run}
              disabled={running || !workspaceId || steps.every((s) => !s.requestId)}
            >
              <Play size={12} />
              {running ? 'Running…' : 'Run chain'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

interface CollectionRow {
  id: string;
  name?: string;
  parentId: string | null;
  variables?: Array<{ key: string; value: string; enabled?: boolean }>;
}

interface KV {
  key: string;
  value: string;
  enabled?: boolean;
}

/**
 * Builds a resolved request from a saved row the same way the request editor
 * does (globals < collection chain < active environment, auth folded into
 * headers / URL, every body type). Env + globals are re-read from the main
 * process on every call so values written by the previous step's scripts or
 * extract rule are picked up.
 */
async function resolveForSend(
  saved: Record<string, unknown>,
  workspaceId: string,
  collections: CollectionRow[],
) {
  const [globals, envs, active] = await Promise.all([
    voltApi['globals:list']({}) as Promise<Record<string, unknown>>,
    voltApi['env:list']({ workspaceId }) as Promise<
      Array<{ id: string; name: string; variables?: KV[] }>
    >,
    voltApi['env:getActive']({ workspaceId }) as Promise<{ environmentId: string | null }>,
  ]);
  const environmentId = active?.environmentId ?? null;
  const env = environmentId ? (envs ?? []).find((e) => e.id === environmentId) ?? null : null;

  // Collection chain: direct parent first, like collectColChain in RequestEditor.
  const chain: CollectionRow[] = [];
  let cur = saved.collectionId
    ? collections.find((c) => c.id === (saved.collectionId as string))
    : undefined;
  while (cur) {
    chain.push(cur);
    const parentId = cur.parentId;
    cur = parentId ? collections.find((c) => c.id === parentId) : undefined;
  }

  const varMap = buildVariableMap(globals ?? {}, env, chain);
  const subst = (s: string) => substituteVariables(s ?? '', varMap);
  const variables: Record<string, string> = {};
  for (const [k, v] of varMap) variables[k] = v.value;

  const headers: Record<string, string> = {};
  for (const h of ((saved.headers as KV[]) ?? []).filter((h) => h.enabled !== false && h.key)) {
    headers[subst(h.key)] = subst(h.value);
  }
  const hasHeader = (name: string) =>
    Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

  let url = subst(saved.url as string);
  const qp = ((saved.queryParams as KV[]) ?? []).filter((q) => q.enabled !== false && q.key);
  if (qp.length) {
    url +=
      (url.includes('?') ? '&' : '?') +
      qp
        .map((q) => `${encodeURIComponent(subst(q.key))}=${encodeURIComponent(subst(q.value))}`)
        .join('&');
  }

  // Auth — same subset the request editor folds in synchronously. OAuth2
  // needs an async token fetch and is left to the user's saved headers.
  const auth = (saved.auth as { type?: string; [k: string]: unknown }) ?? { type: 'none' };
  if (auth.type === 'bearer' && auth.token) {
    headers['Authorization'] = `Bearer ${subst(auth.token as string)}`;
  } else if (auth.type === 'basic') {
    const encoded = btoa(
      `${subst((auth.username as string) ?? '')}:${subst((auth.password as string) ?? '')}`,
    );
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

  const body = (saved.body as { type?: string; [k: string]: unknown }) ?? { type: 'none' };
  let resolvedBody: unknown = { type: 'none' };
  if (body.type === 'raw') {
    resolvedBody = { type: 'raw', content: subst((body.content as string) ?? '') };
    const ct = rawLanguageContentType(body.language as string | undefined);
    if (ct && !hasHeader('content-type')) headers['Content-Type'] = ct;
  } else if (body.type === 'urlencoded') {
    const fields = (body.fields as KV[]) ?? [];
    const content = fields.length
      ? fields
          .filter((f) => f.enabled !== false && f.key)
          .map((f) => `${encodeURIComponent(subst(f.key))}=${encodeURIComponent(subst(f.value))}`)
          .join('&')
      : subst((body.content as string) ?? '');
    resolvedBody = { type: 'urlencoded', content };
  } else if (body.type === 'form') {
    resolvedBody = {
      type: 'form',
      fields: ((body.fields as Array<KV & { kind: 'text' | 'file' }>) ?? [])
        .filter((f) => f.enabled !== false)
        .map((f) => ({
          key: subst(f.key),
          kind: f.kind,
          value: f.kind === 'text' ? subst(f.value) : f.value,
        })),
    };
  } else if (body.type === 'binary') {
    resolvedBody = { type: 'binary', filePath: (body.filePath as string) ?? '' };
  } else if (body.type === 'graphql') {
    resolvedBody = {
      type: 'graphql',
      query: subst((body.query as string) ?? ''),
      variables: subst((body.variables as string) ?? ''),
      operationName: body.operationName as string | undefined,
    };
    if (!hasHeader('content-type')) headers['Content-Type'] = 'application/json';
  }

  return {
    resolved: {
      method: saved.method,
      url,
      headers,
      body: resolvedBody,
      timeoutMs: 60_000,
      followRedirects: true,
      ignoreTlsErrors: false,
    },
    variables,
    environmentId,
  };
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
