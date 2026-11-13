import { useEffect, useRef, useState, type DragEvent } from 'react';
import { X } from 'lucide-react';

import { useSelection } from '@/stores/selection';
import { useDrafts, isDraftDirty } from '@/stores/drafts';
import { useTabActions } from '@/hooks/useTabActions';
import { useQueries } from '@tanstack/react-query';
import { voltApi } from '@/lib/volt-api';
import { cn, methodColorClass } from '@/lib/util';

/**
 * Strip of open request tabs above the editor. Click a tab to switch;
 * × (or middle-click) closes — with a prompt when the tab has unsaved edits.
 * A bullet (•) marks tabs whose draft differs from the saved request.
 * Tabs can be dragged to reorder.
 */
export function TabStrip() {
  const { openTabs, requestId, selectRequest, reorderTab } = useSelection();
  const drafts = useDrafts((s) => s.drafts);
  const { closeTab, closeOtherTabs } = useTabActions();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());

  // Keep the active tab visible: when the active request changes (sidebar
  // click, history, search, closing a tab…) scroll the strip to it.
  useEffect(() => {
    if (!requestId) return;
    const id = requestAnimationFrame(() =>
      tabRefs.current.get(requestId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
    return () => cancelAnimationFrame(id);
  }, [requestId, openTabs.length]);

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

  function handleDragStart(i: number, e: DragEvent) {
    setDragIndex(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `tab:${i}`);
  }
  function handleDragOver(i: number, e: DragEvent) {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIndex !== i) setOverIndex(i);
  }
  function handleDrop(i: number, e: DragEvent) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== i) reorderTab(dragIndex, i);
    setDragIndex(null);
    setOverIndex(null);
  }
  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div role="tablist" className="flex h-9 items-center gap-px overflow-x-auto border-b border-border bg-bg">
      {openTabs.map((id, i) => {
        const data = results[i]?.data as
          | { name?: string; method?: string; body?: { type?: string } }
          | undefined;
        const active = id === requestId;
        const dirty = isDraftDirty(drafts.get(id), data);
        const isGrpc = data?.body?.type === 'grpc';
        const label = isGrpc ? 'gRPC' : (data?.method ?? 'GET').slice(0, 4);
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) tabRefs.current.set(id, el);
              else tabRefs.current.delete(id);
            }}
            aria-selected={active}
            role="tab"
            draggable
            onDragStart={(e) => handleDragStart(i, e)}
            onDragOver={(e) => handleDragOver(i, e)}
            onDrop={(e) => handleDrop(i, e)}
            onDragEnd={handleDragEnd}
            onClick={() => selectRequest(id)}
            onAuxClick={(e) => {
              // Middle-click closes, like browser tabs.
              if (e.button === 1) {
                e.preventDefault();
                closeTab(id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (openTabs.length > 1 && confirm('Close all other tabs?')) closeOtherTabs(id);
            }}
            title={dirty ? `${data?.name ?? ''} (unsaved changes)` : data?.name}
            className={cn(
              'group relative flex h-full cursor-pointer select-none items-center gap-1.5 border-r border-border px-2.5 text-13',
              active
                ? 'bg-bg-elevated text-text'
                : 'bg-bg text-text-muted hover:bg-bg-elevated/60 hover:text-text',
              dragIndex === i && 'opacity-40',
              overIndex === i && dragIndex !== null && dragIndex !== i && 'ring-1 ring-inset ring-accent/60',
            )}
          >
            {active && (
              <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-accent" />
            )}
            <span className={cn('font-mono text-[9px] font-semibold', isGrpc ? 'text-accent' : methodColorClass(data?.method ?? 'GET'))}>
              {label}
            </span>
            <span className="max-w-[140px] truncate">{data?.name ?? 'Loading…'}</span>
            {dirty && <span className="text-accent" aria-label="Unsaved changes">•</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(id);
              }}
              className={cn(
                'ml-1 rounded p-0.5 text-text-muted hover:bg-bg group-hover:opacity-100',
                active ? 'opacity-60' : 'opacity-0',
              )}
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
