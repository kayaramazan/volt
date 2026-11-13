import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { voltApi } from '@/lib/volt-api';
import { diffJson, formatValue } from '@/lib/json-diff';
import { cn, tryDecodeBase64 } from '@/lib/util';

interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  statusCode: number | null;
  startedAt: string | number;
  durationMs: number;
  /** history:get ships the body base64-encoded (see HistoryGetContract). */
  responseBodyBase64: string | null;
  responseBodyTempFile: string | null;
  responseHeaders: Array<[string, string]> | null;
  responseContentType: string | null;
}

export function ResponseDiffModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'response-diff';
  const leftId = current.kind === 'response-diff' ? current.leftId : null;
  const rightId = current.kind === 'response-diff' ? current.rightId : null;

  const left = useQuery({
    queryKey: ['history', leftId],
    queryFn: () =>
      voltApi['history:get']({ id: leftId! }) as unknown as Promise<HistoryEntry>,
    enabled: !!leftId && isOpen,
  });
  const right = useQuery({
    queryKey: ['history', rightId],
    queryFn: () =>
      voltApi['history:get']({ id: rightId! }) as unknown as Promise<HistoryEntry>,
    enabled: !!rightId && isOpen,
  });

  const diff = useMemo(() => {
    if (!left.data || !right.data) return null;
    const lj = bodyAsJson(left.data);
    const rj = bodyAsJson(right.data);
    if (!lj.ok || !rj.ok) {
      return { error: 'One or both responses are not JSON. Diffing only works on JSON bodies.' };
    }
    return { entries: diffJson(lj.value, rj.value) };
  }, [left.data, right.data]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Response diff"
      className="max-w-4xl"
    >
      <div className="flex h-[32rem] flex-col">
        {/* Header: which two responses we're comparing */}
        <div className="grid grid-cols-2 gap-2 border-b border-border pb-2 text-xs">
          <HistoryHeader entry={left.data} label="A (left)" />
          <HistoryHeader entry={right.data} label="B (right)" />
        </div>

        <div className="flex-1 overflow-auto py-2">
          {!left.data || !right.data ? (
            <p className="text-center text-xs text-text-muted">Loading…</p>
          ) : 'error' in diff! ? (
            <p className="px-3 py-6 text-center text-xs text-text-muted">{diff!.error}</p>
          ) : (diff as { entries: ReturnType<typeof diffJson> }).entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-success">
              No semantic differences. The two JSON bodies are equivalent.
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="py-1 pr-2 font-medium">Path</th>
                  <th className="py-1 pr-2 font-medium">A</th>
                  <th className="w-4"></th>
                  <th className="py-1 font-medium">B</th>
                </tr>
              </thead>
              <tbody>
                {(diff as { entries: ReturnType<typeof diffJson> }).entries.map((d, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1 pr-2 align-top">
                      <code className={cn('font-mono', kindColor(d.kind))}>{d.path}</code>
                      <span className="ml-2 text-[10px] uppercase text-text-muted">{d.kind}</span>
                    </td>
                    <td className="py-1 pr-2 align-top">
                      <code className="font-mono text-text-muted">{formatValue(d.left)}</code>
                    </td>
                    <td className="text-text-muted">
                      <ArrowRight size={10} />
                    </td>
                    <td className="py-1 align-top">
                      <code className={cn('font-mono', kindColor(d.kind))}>
                        {formatValue(d.right)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function HistoryHeader({ entry, label }: { entry?: HistoryEntry; label: string }) {
  if (!entry) {
    return <p className="text-text-muted">{label}: loading…</p>;
  }
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="font-mono text-text">
        {entry.statusCode ?? '—'} · {entry.method} {entry.url}
      </p>
      <p className="text-[10px] text-text-muted">
        {new Date(entry.startedAt).toLocaleString()} · {entry.durationMs}ms
      </p>
    </div>
  );
}

function kindColor(k: 'added' | 'removed' | 'changed') {
  if (k === 'added') return 'text-success';
  if (k === 'removed') return 'text-error';
  return 'text-warning';
}

function bodyAsJson(entry: HistoryEntry): { ok: true; value: unknown } | { ok: false } {
  // history:get returns the body base64-encoded. Decode to bytes and then
  // UTF-8 (atob alone would mangle non-ASCII strings in the JSON).
  const b64 = entry.responseBodyBase64;
  if (!b64) return { ok: false };
  let text: string | null = null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    text = new TextDecoder('utf-8').decode(bytes);
  } catch {
    text = tryDecodeBase64(b64, entry.responseContentType).text;
  }
  if (!text || !text.trim()) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
