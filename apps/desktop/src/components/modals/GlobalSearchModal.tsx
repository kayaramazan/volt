import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';

import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { useWorkspaces } from '@/hooks/useData';
import { voltApi } from '@/lib/volt-api';
import { cn, methodColorClass } from '@/lib/util';

import './command-palette.css';

interface Hit {
  workspaceId: string;
  workspaceName: string;
  id: string;
  name: string;
  method: string;
  url: string;
}

/**
 * Global fuzzy search (Cmd/Ctrl+P). Searches every request across every
 * workspace by name OR URL. Grouped by workspace. Enter opens — and switches
 * workspace if needed.
 */
export function GlobalSearchModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'global-search';
  const { setWorkspaceId, selectRequest } = useSelection();
  const { data: workspaces } = useWorkspaces();

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  // Walk every workspace's requests once when the modal opens. Cheap enough
  // for the local DB (an indexed table read per workspace).
  useEffect(() => {
    if (!isOpen) return;
    if (!workspaces) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all: Hit[] = [];
      const ws = [
        ...((workspaces as { personal?: Array<{ id: string; name: string }> }).personal ?? []),
        ...((workspaces as { team?: Array<{ id: string; name: string }> }).team ?? []),
      ];
      for (const w of ws) {
        try {
          const reqs = (await voltApi['apiRequest:list']({
            workspaceId: w.id,
          })) as Array<{ id: string; name: string; method: string; url: string }>;
          for (const r of reqs) {
            all.push({
              workspaceId: w.id,
              workspaceName: w.name,
              id: r.id,
              name: r.name,
              method: r.method,
              url: r.url,
            });
          }
        } catch {
          /* a missing workspace is non-fatal — skip */
        }
      }
      if (!cancelled) {
        setHits(all);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaces]);

  // Group filtered hits by workspace for display. cmdk handles the fuzzy
  // matching via the `value` we pass to each Command.Item.
  const grouped = useMemo(() => {
    const byWs = new Map<string, Hit[]>();
    for (const h of hits) {
      if (!byWs.has(h.workspaceId)) byWs.set(h.workspaceId, []);
      byWs.get(h.workspaceId)!.push(h);
    }
    return [...byWs.entries()];
  }, [hits]);

  function pick(h: Hit) {
    setWorkspaceId(h.workspaceId);
    selectRequest(h.id);
    close();
  }

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      label="Global search"
      className="cmd-palette"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search size={14} className="text-text-muted" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search requests across all workspaces…"
          className="flex h-10 w-full bg-transparent text-13 text-text outline-none placeholder:text-text-muted"
        />
      </div>
      <Command.List className="max-h-[28rem] overflow-auto p-1">
        {loading && hits.length === 0 ? (
          <Command.Empty className="py-6 text-center text-xs text-text-muted">
            Loading requests…
          </Command.Empty>
        ) : (
          <Command.Empty className="py-6 text-center text-xs text-text-muted">
            No matches.
          </Command.Empty>
        )}

        {grouped.map(([wsId, list]) => (
          <Command.Group
            key={wsId}
            heading={list[0]?.workspaceName ?? 'Workspace'}
            className="text-text-muted"
          >
            {list.map((h) => (
              <Command.Item
                key={h.id}
                value={`${h.name} ${h.url}`}
                onSelect={() => pick(h)}
                className="cmd-item"
              >
                <span
                  className={cn('font-mono text-[10px] font-semibold', methodColorClass(h.method))}
                >
                  {h.method.slice(0, 4)}
                </span>
                <span className="truncate text-text">{h.name}</span>
                <span className="ml-auto truncate font-mono text-[10px] text-text-muted">
                  {h.url}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
