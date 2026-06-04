import { useState } from 'react';
import { Clock, GitCompareArrows, Search } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useHistory } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { cn, formatRelativeTime, methodColorClass, statusColorClass } from '@/lib/util';

interface Props {
  workspaceId: string;
}

/**
 * Recent requests list. Searchable. Clicking re-loads the request into the
 * URL bar (for ad-hoc) or jumps to the request if it still exists.
 */
export function HistoryPane({ workspaceId }: Props) {
  const [search, setSearch] = useState('');
  const { data } = useHistory(workspaceId, search);
  const entries = data?.entries ?? [];
  const selectRequest = useSelection((s) => s.selectRequest);
  const { open: openModal } = useModals();
  const [picking, setPicking] = useState<string[]>([]); // up to 2 ids

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
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {picking.length === 0
              ? 'Tip: click ⇆ on two rows to diff their JSON.'
              : `${picking.length}/2 selected for diff`}
          </span>
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
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Clock size={20} className="mb-2 text-text-muted" />
            <p className="text-xs text-text-muted">No history yet</p>
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
                  onClick={() => e.requestId && selectRequest(e.requestId)}
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
