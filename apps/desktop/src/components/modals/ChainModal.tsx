import { useEffect, useMemo, useState } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { useRequests } from '@/hooks/useData';
import { voltApi } from '@/lib/volt-api';
import { selectPath } from '@/lib/jsonpath-mini';
import { cn, methodColorClass, rowId, statusColorClass, tryDecodeBase64 } from '@/lib/util';

interface ChainStep {
  id: string;
  requestId: string;
  /** Optional: extract a JSON path from this step's response into a global. */
  extractPath?: string;
  extractGlobal?: string;
}

interface RunEntry {
  stepId: string;
  ok: boolean;
  statusCode?: number;
  durationMs?: number;
  errorMessage?: string;
  extracted?: { key: string; value: unknown };
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
    setRunning(true);
    setLog([]);
    for (const step of steps) {
      if (!step.requestId) continue;
      try {
        // Send the step's request. We open its full saved row, run it via
        // request:send + the renderer's normal resolution path. The chain
        // runner can be smarter (apply pre-resolved overrides) — keep it
        // simple here and trust globals do the chaining.
        const saved = (await voltApi['apiRequest:get']({ id: step.requestId })) as
          | Record<string, unknown>
          | null;
        if (!saved) {
          setLog((l) => [
            ...l,
            { stepId: step.id, ok: false, errorMessage: 'Request not found' },
          ]);
          continue;
        }
        const resolved = await resolveForSend(saved);
        const inFlightId = rowId('chain-send');
        const r = (await voltApi['request:send']({
          inFlightId,
          request: resolved as never,
          workspaceId,
          environmentId: null,
        } as never)) as {
          ok: boolean;
          statusCode?: number;
          bodyBase64?: string | null;
          bodyContentType?: string | null;
          errorCode?: string;
          errorMessage?: string;
          timing?: { totalMs: number };
        };

        let extracted: RunEntry['extracted'];
        if (r.ok && step.extractPath && step.extractGlobal) {
          const decoded = r.bodyBase64
            ? tryDecodeBase64(r.bodyBase64, r.bodyContentType ?? null).text
            : null;
          if (decoded) {
            try {
              const parsed = JSON.parse(decoded);
              const value = selectPath(parsed, step.extractPath);
              if (value !== undefined) {
                await voltApi['globals:set']({ key: step.extractGlobal, value });
                extracted = { key: step.extractGlobal, value };
              }
            } catch {
              /* not JSON */
            }
          }
        }

        setLog((l) => [
          ...l,
          {
            stepId: step.id,
            ok: r.ok,
            statusCode: r.statusCode,
            durationMs: r.timing?.totalMs,
            errorMessage: r.errorMessage,
            extracted,
          },
        ]);
        if (!r.ok) break; // halt on first failure
      } catch (err) {
        setLog((l) => [
          ...l,
          {
            stepId: step.id,
            ok: false,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        ]);
        break;
      }
    }
    setRunning(false);
  }

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
                  <div className="ml-7 mt-2 text-[11px]">
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
                      </p>
                    ) : (
                      <p className="text-error">
                        Failed: {result.errorMessage ?? '(no detail)'}
                      </p>
                    )}
                  </div>
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
          <span className="text-[10px] text-text-muted">
            Steps are persisted per workspace.
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
            <Button variant="primary" onClick={run} disabled={running || steps.length === 0}>
              <Play size={12} />
              {running ? 'Running…' : 'Run chain'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Builds a resolved request from a saved row using current globals/env. We
 * fetch globals fresh on each step so extracted values from the previous step
 * are picked up.
 */
async function resolveForSend(saved: Record<string, unknown>) {
  const globals = (await voltApi['globals:list']({})) as Record<string, unknown>;
  const vars = new Map<string, string>();
  for (const [k, v] of Object.entries(globals ?? {})) {
    if (v != null) vars.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const subst = (s: string) =>
    s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name: string) => vars.get(name) ?? '');

  const headers: Record<string, string> = {};
  const hdrArr =
    ((saved.headers as Array<{ key: string; value: string; enabled?: boolean }>) ?? []).filter(
      (h) => h.enabled !== false && h.key,
    );
  for (const h of hdrArr) headers[subst(h.key)] = subst(h.value);

  let url = subst(saved.url as string);
  const qp =
    ((saved.queryParams as Array<{ key: string; value: string; enabled?: boolean }>) ?? []).filter(
      (q) => q.enabled !== false && q.key,
    );
  if (qp.length) {
    const sep = url.includes('?') ? '&' : '?';
    url +=
      sep +
      qp
        .map((q) => `${encodeURIComponent(subst(q.key))}=${encodeURIComponent(subst(q.value))}`)
        .join('&');
  }

  const body = saved.body as { type: string; content?: string };
  let resolvedBody: unknown = { type: 'none' };
  if (body?.type === 'raw') resolvedBody = { type: 'raw', content: subst(body.content ?? '') };
  else if (body?.type === 'urlencoded')
    resolvedBody = { type: 'urlencoded', content: subst((body as { content?: string }).content ?? '') };
  else if (body?.type) resolvedBody = body;

  return {
    method: saved.method,
    url,
    headers,
    body: resolvedBody,
    timeoutMs: 60_000,
    followRedirects: true,
    ignoreTlsErrors: false,
  };
}
