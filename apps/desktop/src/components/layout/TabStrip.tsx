import { X } from 'lucide-react';

import { useSelection } from '@/stores/selection';
import { useDrafts } from '@/stores/drafts';
import { useQueries } from '@tanstack/react-query';
import { voltApi } from '@/lib/volt-api';
import { cn, methodColorClass } from '@/lib/util';

/**
 * Strip of open request tabs above the editor. Click a tab to switch;
 * x button closes. A bullet (•) marks unsaved tabs.
 */
export function TabStrip() {
  const { openTabs, requestId, selectRequest, closeTab } = useSelection();
  const drafts = useDrafts((s) => s.drafts);

  // Fetch each open tab's request meta in parallel — cheap because TanStack
  // dedups against existing query cache.
  const results = useQueries({
    queries: openTabs.map((id) => ({
      queryKey: ['request', id],
      queryFn: () => voltApi['apiRequest:get']({ id }),
      staleTime: 60_000,
    })),
  });

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-9 items-center gap-px overflow-x-auto border-b border-border bg-bg">
      {openTabs.map((id, i) => {
        const data = results[i]?.data as
          | { name?: string; method?: string; body?: { type?: string } }
          | undefined;
        const active = id === requestId;
        const dirty = drafts.has(id); // crude — would track per-tab dirtiness via deep compare
        const isGrpc = data?.body?.type === 'grpc';
        const label = isGrpc ? 'gRPC' : (data?.method ?? 'GET').slice(0, 4);
        return (
          <div
            key={id}
            onClick={() => selectRequest(id)}
            className={cn(
              'group flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-2.5 text-13',
              active
                ? 'bg-bg-elevated text-text'
                : 'bg-bg text-text-muted hover:bg-bg-elevated/60 hover:text-text',
            )}
          >
            <span className={cn('font-mono text-[9px] font-semibold', isGrpc ? 'text-accent' : methodColorClass(data?.method ?? 'GET'))}>
              {label}
            </span>
            <span className="max-w-[140px] truncate">{data?.name ?? 'Loading…'}</span>
            {dirty && <span className="text-accent">•</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(id);
              }}
              className="ml-1 rounded p-0.5 text-text-muted opacity-0 hover:bg-bg group-hover:opacity-100"
              aria-label="Close tab"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
