import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Globe, Plug, Puzzle, Search, FileText, FolderPlus, Link2, Upload, Settings, LogOut } from 'lucide-react';

import { useRequests, useCollections, useSignOut } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { voltApi } from '@/lib/volt-api';
import { useQueryClient } from '@tanstack/react-query';
import { methodColorClass, cn } from '@/lib/util';

import './command-palette.css';

export function CommandPalette() {
  const { current, close, open } = useModals();
  const isOpen = current.kind === 'command-palette';
  const { workspaceId, selectRequest } = useSelection();
  const { data: requests } = useRequests(workspaceId);
  const { data: collections } = useCollections(workspaceId);
  const [query, setQuery] = useState('');
  const qc = useQueryClient();
  const signOut = useSignOut();

  // Reset query each open
  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  // Build collection name lookup for breadcrumb
  const collectionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collections ?? []) map.set(c.id, c.name);
    return map;
  }, [collections]);

  // Pre-filter on our side before capping the list. Slicing the raw list
  // first meant any request past #50 could never be found by typing.
  const visibleRequests = useMemo(() => {
    const all = requests ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.url.toLowerCase().includes(q) ||
            r.method.toLowerCase().includes(q) ||
            (r.collectionId && (collectionNames.get(r.collectionId) ?? '').toLowerCase().includes(q)),
        )
      : all;
    return filtered.slice(0, 50);
  }, [requests, query, collectionNames]);

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      label="Command palette"
      className="cmd-palette"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search size={14} className="text-text-muted" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search requests or run a command…"
          className="flex h-10 w-full bg-transparent text-13 text-text outline-none placeholder:text-text-muted"
        />
      </div>

      <Command.List className="max-h-[380px] overflow-y-auto p-1">
        <Command.Empty className="px-3 py-6 text-center text-xs text-text-muted">
          No results.
        </Command.Empty>

        {visibleRequests.length > 0 && (
          <Command.Group heading="Requests" className="cmd-group">
            {visibleRequests.map((r) => (
              <Command.Item
                key={r.id}
                value={`${r.method} ${r.name} ${r.url} ${r.id}`}
                onSelect={() => {
                  selectRequest(r.id);
                  close();
                }}
                className="cmd-item"
              >
                <FileText size={13} className="text-text-muted" />
                <span
                  className={cn(
                    'w-10 font-mono text-[10px] font-semibold',
                    methodColorClass(r.method),
                  )}
                >
                  {r.method.slice(0, 4)}
                </span>
                <span className="flex-1 truncate text-text">{r.name}</span>
                {r.collectionId && (
                  <span className="truncate text-[10px] text-text-muted">
                    {collectionNames.get(r.collectionId) ?? ''}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Actions" className="cmd-group">
          <Command.Item
            value="new request"
            onSelect={() => {
              close();
              open({ kind: 'new-request', collectionId: null });
            }}
            className="cmd-item"
          >
            <FileText size={13} />
            <span>New request</span>
            <kbd className="ml-auto text-[10px] text-text-muted">⌘N</kbd>
          </Command.Item>
          <Command.Item
            value="new collection folder"
            onSelect={() => {
              close();
              open({ kind: 'new-collection', parentId: null });
            }}
            className="cmd-item"
          >
            <FolderPlus size={13} />
            <span>New collection</span>
          </Command.Item>
          <Command.Item
            value="import postman insomnia openapi curl har"
            onSelect={() => {
              close();
              open({ kind: 'import' });
            }}
            className="cmd-item"
          >
            <Upload size={13} />
            <span>Import…</span>
          </Command.Item>
          <Command.Item
            value="search requests global fuzzy"
            onSelect={() => {
              close();
              open({ kind: 'global-search' });
            }}
            className="cmd-item"
          >
            <Search size={13} />
            <span>Search requests…</span>
            <kbd className="ml-auto text-[10px] text-text-muted">⌘P</kbd>
          </Command.Item>
          <Command.Item
            value="websocket ws scratchpad"
            onSelect={() => {
              close();
              open({ kind: 'websocket' });
            }}
            className="cmd-item"
          >
            <Plug size={13} />
            <span>WebSocket scratchpad…</span>
          </Command.Item>
          <Command.Item
            value="chain runner request flow"
            onSelect={() => {
              close();
              open({ kind: 'chain' });
            }}
            className="cmd-item"
          >
            <Link2 size={13} />
            <span>Request chain…</span>
          </Command.Item>
          <Command.Item
            value="globals view environment variables"
            onSelect={() => {
              close();
              open({ kind: 'globals' });
            }}
            className="cmd-item"
          >
            <Globe size={13} />
            <span>Globals…</span>
          </Command.Item>
          <Command.Item
            value="plugins extensions transformers"
            onSelect={() => {
              close();
              open({ kind: 'plugins' });
            }}
            className="cmd-item"
          >
            <Puzzle size={13} />
            <span>Plugins…</span>
          </Command.Item>
          <Command.Item
            value="settings preferences"
            onSelect={() => {
              close();
              open({ kind: 'settings' });
            }}
            className="cmd-item"
          >
            <Settings size={13} />
            <span>Open settings</span>
            <kbd className="ml-auto text-[10px] text-text-muted">⌘,</kbd>
          </Command.Item>
          <Command.Item
            value="sign out logout"
            onSelect={async () => {
              await signOut();
              close();
            }}
            className="cmd-item"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
