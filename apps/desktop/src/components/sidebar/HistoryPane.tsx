import { useState } from 'react';
import { Clock, Search } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { useHistory } from '@/hooks/useData';
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

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-2">
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
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Clock size={20} className="mb-2 text-text-muted" />
            <p className="text-xs text-text-muted">No history yet</p>
          </div>
        ) : (
          entries.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => e.requestId && selectRequest(e.requestId)}
              className={cn(
                'group flex w-full items-center gap-2 border-b border-border/40 px-2 py-1.5 text-left text-13 hover:bg-bg-elevated',
              )}
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
          ))
        )}
      </div>
    </div>
  );
}
