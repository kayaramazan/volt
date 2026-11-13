import { useState } from 'react';
import { Clock, GitCompareArrows, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useClearHistory, useCreateRequest, useHistory } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { toast } from '@/stores/toasts';
import { voltApi } from '@/lib/volt-api';
import { cn, formatRelativeTime, methodColorClass, statusColorClass } from '@/lib/util';

interface Props {
  workspaceId: string;
}

type HistoryRow = {
  id: string;
  requestId: string | null;
  method: string;
  url: string;
  requestSnapshot: unknown;
  statusCode: number | null;
  startedAt: string;
};

/**
 * Recent requests list. Searchable. Clicking jumps to the saved request if
 * it still exists; otherwise the recorded snapshot is re-created as a new
 * request at the workspace root (the closest thing to Postman's "open from
 * history" since Volt has no unsaved scratch tabs).
 */
export function HistoryPane({ workspaceId }: Props) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useHistory(workspaceId, search);
  const entries = (data?.entries ?? []) as HistoryRow[];
  const selectRequest = useSelection((s) => s.selectRequest);
  const { open: openModal } = useModals();
  const [picking, setPicking] = useState<string[]>([]); // up to 2 ids
  const clearHistory = useClearHistory();
  const createRequest = useCreateRequest();
  const qc = useQueryClient();

  async function openEntry(e: HistoryRow) {
    // 1. Linked to a saved request that still exists → just focus it.
    if (e.requestId) {
      const cached = qc.getQueryData(['requests', workspaceId, null]) as
        | Array<{ id: string }>
        | undefined;
      const exists = cached
        ? cached.some((r) => r.id === e.requestId)
        : !!(await voltApi['apiRequest:get']({ id: e.requestId }).catch(() => null));
      if (exists) {
        selectRequest(e.requestId);
        return;
      }
    }
    // 2. Otherwise rebuild a request from the snapshot.
    const snap = parseSnapshot(e.requestSnapshot);
    try {
      const created = await createRequest.mutateAsync({
        workspaceId,
        collectionId: null,
        name: snap.name ?? defaultName(e.method, e.url),
        method: snap.method ?? e.method,
        url: snap.url ?? e.url,
        ...(snap.headers ? { headers: snap.headers } : {}),
        ...(snap.queryParams ? { queryParams: snap.queryParams } : {}),
        ...(snap.bodyType ? { bodyType: snap.bodyType } : {}),
        ...(snap.body ? { body: snap.body } : {}),
        ...(snap.auth ? { auth: snap.auth } : {}),
      } as never);
      if (created?.id) {
        selectRequest(created.id);
        toast.info('Recreated request from history', 'Saved at the workspace root.');
      }
    } catch {
      /* useCreateRequest already toasts */
    }
  }

  function onClear() {
    if (!confirm('Clear all history for this workspace? This cannot be undone.')) return;
    setPicking([]);
    clearHistory.mutate(workspaceId);
  }

  function toggleDiffPick(id: string) {
    setPicking((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        const second = prev[1];
        return second ? [second, id] : [id];
      }
      return [...prev, id];
    });
  }

  function openDiff() {
    const [a, b] = picking;
    if (a && b) {
      openModal({ kind: 'response-diff', leftId: a, rightId: b });
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-2 space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter history…"
            className="pl-7"
          />
        </div>
        <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted">
          <span className="min-w-0 truncate">
            {picking.length === 0
              ? 'Tip: click ⇆ on two rows to diff their JSON.'
              : `${picking.length}/2 selected for diff`}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant={picking.length === 2 ? 'primary' : 'ghost'}
              disabled={picking.length !== 2}
              onClick={openDiff}
              title="Diff the two selected responses"
            >
              <GitCompareArrows size={11} />
              Diff
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={entries.length === 0 || clearHistory.isPending}
              onClick={onClear}
              title="Clear all history for this workspace"
            >
              <Trash2 size={11} />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Clock size={20} className="mb-2 text-text-muted" />
            <p className="text-xs text-text-muted">
              {isLoading ? 'Loading…' : search ? `No history matching "${search}"` : 'No history yet'}
            </p>
            {!isLoading && !search && (
              <p className="mt-1 px-4 text-[10px] text-text-muted">
                Every request you send is recorded here. History stays on this device.
              </p>
            )}
          </div>
        ) : (
          entries.map((e) => {
            const picked = picking.includes(e.id);
            return (
              <div
                key={e.id}
                className={cn(
                  'group flex items-center gap-1 border-b border-border/40 px-2 py-1.5 text-13 hover:bg-bg-elevated',
                  picked && 'bg-accent/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleDiffPick(e.id)}
                  title={picked ? 'Unselect from diff' : 'Select for diff'}
                  className={cn(
                    'rounded px-1 text-[10px]',
                    picked ? 'bg-accent text-bg' : 'text-text-muted opacity-0 hover:bg-bg group-hover:opacity-100',
                  )}
                >
                  ⇆
                </button>
                <button
                  type="button"
                  onClick={() => void openEntry(e)}
                  title={`${e.method} ${e.url}\n${new Date(e.startedAt).toLocaleString()}`}
                  className="flex flex-1 items-center gap-2 truncate text-left"
                >
                  <span className={cn('w-10 font-mono text-[10px] font-semibold', methodColorClass(e.method))}>
                    {e.method.slice(0, 4)}
                  </span>
                  <span className="flex-1 truncate text-text">{e.url}</span>
                  <span className={cn('font-mono text-[10px]', statusColorClass(e.statusCode))}>
                    {e.statusCode ?? '—'}
                  </span>
                  <span className="hidden w-14 text-right text-[10px] text-text-muted group-hover:block">
                    {formatRelativeTime(e.startedAt)}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * The snapshot is the *resolved* request main actually sent (variables
 * substituted). It may be a JSON string (raw DB column) or an object.
 */
function parseSnapshot(raw: unknown): {
  name?: string;
  method?: string;
  url?: string;
  headers?: unknown;
  queryParams?: unknown;
  bodyType?: string;
  body?: unknown;
  auth?: unknown;
} {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object') return {};
  const s = obj as Record<string, unknown>;
  const headers = Array.isArray(s.headers)
    ? s.headers
    : s.headers && typeof s.headers === 'object'
      ? Object.entries(s.headers as Record<string, string>).map(([key, value]) => ({
          key,
          value,
          enabled: true,
        }))
      : undefined;
  const body = s.body && typeof s.body === 'object' ? (s.body as { type?: string }) : undefined;
  return {
    name: typeof s.name === 'string' ? s.name : undefined,
    method: typeof s.method === 'string' ? s.method : undefined,
    url: typeof s.url === 'string' ? s.url : undefined,
    headers,
    queryParams: Array.isArray(s.queryParams) ? s.queryParams : undefined,
    bodyType: body?.type,
    body,
    auth: s.auth && typeof s.auth === 'object' ? s.auth : undefined,
  };
}

function defaultName(method: string, url: string): string {
  try {
    const u = new URL(url);
    return `${method} ${u.pathname === '/' ? u.host : u.pathname}`;
  } catch {
    return `${method} ${url}`.slice(0, 80) || 'From history';
  }
}
