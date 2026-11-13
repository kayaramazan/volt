import { createContext, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { BookText, ChevronRight, Copy, Download, FileCode2, FolderPlus, Folder, FileText, FilePlus2, MoreHorizontal, Pencil, Search, Server, Trash2, X, Zap, ZapOff } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';

import { cn, methodColorClass } from '@/lib/util';
import { voltApi } from '@/lib/volt-api';
import {
  useCollections,
  useDeleteCollection,
  useDeleteRequest,
  useDuplicateCollection,
  useDuplicateRequest,
  useRequests,
  useSetWidgetFavorite,
  useUpdateCollection,
  useUpdateRequest,
  useWidgetFavorites,
} from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { toast } from '@/stores/toasts';

interface Props {
  workspaceId: string;
}

interface CollectionNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
}

interface ExampleSummary {
  id: string;
  name: string;
  /** Captured response status code, if any (used for a small numeric chip). */
  statusCode?: number;
}

interface RequestNode {
  id: string;
  name: string;
  method: string;
  collectionId: string | null;
  sortOrder?: number;
  /** Discriminates gRPC requests from HTTP ones so the row can show "gRPC". */
  body?: { type?: string };
  /** Examples saved against this request, as returned by listRequests. */
  examples?: Array<{
    id: string;
    name: string;
    response?: { ok?: boolean; statusCode?: number } | null;
  }>;
}

type DragPayload =
  | { kind: 'collection'; id: string }
  | { kind: 'request'; id: string };

interface TreeCtx {
  dragging: DragPayload | null;
  setDragging: (p: DragPayload | null) => void;
  /** Drop a request into a folder (or root) — appends at the end. */
  moveRequest: (requestId: string, toCollectionId: string | null) => void;
  /** Returns true if moving `collectionId` under `newParentId` would create a cycle. */
  wouldCycle: (collectionId: string, newParentId: string | null) => boolean;
  /** Drop a collection into a folder (or root) — appends at the end. */
  moveCollection: (collectionId: string, newParentId: string | null) => void;
  /** Re-position a request relative to a target row. `side === 'above'`
   *  drops the dragged item before the target, `'below'` after. The dragged
   *  item inherits the target's parent collection. */
  reorderRequestNear: (
    requestId: string,
    targetRequestId: string,
    side: 'above' | 'below',
  ) => void;
  /** Same idea for collections — drop above/below another collection. */
  reorderCollectionNear: (
    collectionId: string,
    targetCollectionId: string,
    side: 'above' | 'below',
  ) => void;
  /** When true, the tree is filtered to a search query (callers should force-expand). */
  searching: boolean;
  /** Collection ids that should render (own name matched OR has a matching descendant). */
  visibleCollections: Set<string>;
  /** Request ids that should render. */
  visibleRequests: Set<string>;
  /** Collection ids on the path from the root to the active request. */
  activeAncestors: Set<string>;
}

const TreeContext = createContext<TreeCtx | null>(null);
const useTree = () => {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('CollectionTree internals used outside provider');
  return ctx;
};

/**
 * Hierarchical view of collections + requests for the current workspace.
 *
 * - Top level: collections with parentId === null + root-level requests
 * - Expandable folders show nested collections + requests
 * - Right-click / kebab menu: rename, delete, new request, new sub-folder
 */
export function CollectionTree({ workspaceId }: Props) {
  const { data: collections } = useCollections(workspaceId);
  const { data: requests } = useRequests(workspaceId);
  const qc = useQueryClient();
  const { open: openModal } = useModals();
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLowerCase();
  const searching = searchTerm.length > 0;

  // Build parentId → children index
  const collectionsByParent = new Map<string | null, CollectionNode[]>();
  for (const c of (collections ?? []) as CollectionNode[]) {
    const parent = c.parentId ?? null;
    if (!collectionsByParent.has(parent)) collectionsByParent.set(parent, []);
    collectionsByParent.get(parent)!.push(c);
  }

  const requestsByCollection = new Map<string | null, RequestNode[]>();
  for (const r of (requests ?? []) as RequestNode[]) {
    const key = r.collectionId ?? null;
    if (!requestsByCollection.has(key)) requestsByCollection.set(key, []);
    requestsByCollection.get(key)!.push(r);
  }

  const rootCollections = collectionsByParent.get(null) ?? [];
  const rootRequests = requestsByCollection.get(null) ?? [];

  // Filter sets for search. When not searching, every id is visible.
  const { visibleCollections, visibleRequests } = useMemo(() => {
    const allCols = (collections ?? []) as CollectionNode[];
    const allReqs = (requests ?? []) as RequestNode[];
    if (!searching) {
      return {
        visibleCollections: new Set(allCols.map((c) => c.id)),
        visibleRequests: new Set(allReqs.map((r) => r.id)),
      };
    }
    const reqMatch = new Set(
      allReqs
        .filter(
          (r) =>
            r.name.toLowerCase().includes(searchTerm) ||
            (r as { url?: string }).url?.toLowerCase().includes(searchTerm),
        )
        .map((r) => r.id),
    );
    // A collection is visible if its name matches OR any descendant request /
    // sub-collection is visible. Walk bottom-up.
    const collectionMatch = new Set<string>();
    const childrenOf = collectionsByParent;
    const reqsOf = requestsByCollection;
    function collectVisible(colId: string): boolean {
      const c = allCols.find((x) => x.id === colId);
      if (!c) return false;
      const ownMatch = c.name.toLowerCase().includes(searchTerm);
      const reqHit = (reqsOf.get(colId) ?? []).some((r) => reqMatch.has(r.id));
      let childHit = false;
      for (const child of childrenOf.get(colId) ?? []) {
        if (collectVisible(child.id)) childHit = true;
      }
      const visible = ownMatch || reqHit || childHit;
      if (visible) collectionMatch.add(colId);
      return visible;
    }
    for (const root of childrenOf.get(null) ?? []) collectVisible(root.id);
    return { visibleCollections: collectionMatch, visibleRequests: reqMatch };
  }, [collections, requests, searching, searchTerm, collectionsByParent, requestsByCollection]);

  // Folders that contain the active request (directly or nested). Used to
  // auto-expand the path to it and to tint those folder rows.
  const activeRequestId = useSelection((s) => s.requestId);
  const activeAncestors = useMemo(() => {
    const out = new Set<string>();
    const req = ((requests ?? []) as RequestNode[]).find((r) => r.id === activeRequestId);
    if (!req) return out;
    const parentOf = new Map<string, string | null>();
    for (const c of (collections ?? []) as CollectionNode[]) parentOf.set(c.id, c.parentId ?? null);
    let cur = req.collectionId ?? null;
    while (cur && !out.has(cur)) {
      out.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return out;
  }, [requests, collections, activeRequestId]);

  // Move helpers — append to end of destination by giving the highest sortOrder.
  function nextSortOrder(parentRequests: RequestNode[] = []) {
    return parentRequests.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), -1) + 1;
  }
  function nextCollectionSortOrder(parentCollections: CollectionNode[] = []) {
    return parentCollections.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1) + 1;
  }

  const ctx: TreeCtx = {
    dragging,
    setDragging,
    moveRequest: (requestId, toCollectionId) => {
      const current = (requests ?? []).find((r) => r.id === requestId);
      if (!current) return;
      if ((current.collectionId ?? null) === toCollectionId) return;
      const siblings = requestsByCollection.get(toCollectionId) ?? [];
      const newSortOrder = nextSortOrder(siblings);
      // Optimistic write so the sidebar reorders before the IPC round-trip.
      qc.setQueryData<RequestNode[]>(['requests', workspaceId, null], (prev) =>
        prev?.map((r) =>
          r.id === requestId
            ? { ...r, collectionId: toCollectionId, sortOrder: newSortOrder }
            : r,
        ),
      );
      voltApi['apiRequest:update']({
        id: requestId,
        collectionId: toCollectionId,
        sortOrder: newSortOrder,
      } as never)
        .catch((err) => toast.error('Could not move request', err))
        .finally(() => {
          qc.invalidateQueries({ queryKey: ['requests'] });
        });
    },
    wouldCycle: (collectionId, newParentId) => {
      // Walk newParent → its parent → ... ; cycle iff we encounter collectionId.
      let cursor: string | null = newParentId;
      while (cursor) {
        if (cursor === collectionId) return true;
        const parent = (collections ?? []).find((c) => c.id === cursor);
        cursor = parent?.parentId ?? null;
      }
      return false;
    },
    moveCollection: (collectionId, newParentId) => {
      const current = (collections ?? []).find((c) => c.id === collectionId) as
        | CollectionNode
        | undefined;
      if (!current) return;
      if ((current.parentId ?? null) === newParentId) return;
      if (newParentId === collectionId) return;
      const siblings = collectionsByParent.get(newParentId) ?? [];
      const newSortOrder = nextCollectionSortOrder(siblings);
      qc.setQueryData<CollectionNode[]>(['collections', workspaceId], (prev) =>
        prev?.map((c) =>
          c.id === collectionId
            ? { ...c, parentId: newParentId, sortOrder: newSortOrder }
            : c,
        ),
      );
      voltApi['collection:update']({
        id: collectionId,
        parentId: newParentId,
        sortOrder: newSortOrder,
      } as never)
        .catch((err) => toast.error('Could not move collection', err))
        .finally(() => {
          qc.invalidateQueries({ queryKey: ['collections'] });
        });
    },
    // Drop a request before/after another request. Renumbers siblings in
    // the target parent + writes a new sortOrder per row. Uses an
    // optimistic React Query cache write so the sidebar redraws instantly;
    // the actual DB writes happen via direct IPC calls (bypassing
    // useUpdateRequest so we don't trigger N invalidations).
    reorderRequestNear: (requestId, targetRequestId, side) => {
      if (requestId === targetRequestId) return;
      const all = (requests ?? []) as RequestNode[];
      const draggedRow = all.find((r) => r.id === requestId);
      const targetRow = all.find((r) => r.id === targetRequestId);
      if (!draggedRow || !targetRow) return;
      const toCollectionId = targetRow.collectionId ?? null;
      const allInParent = all
        .filter((r) => (r.collectionId ?? null) === toCollectionId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const without = allInParent.filter((r) => r.id !== requestId);
      const targetIndex = without.findIndex((r) => r.id === targetRequestId);
      if (targetIndex < 0) return;
      const insertIndex = side === 'above' ? targetIndex : targetIndex + 1;
      const next: Array<RequestNode | null> = [
        ...without.slice(0, insertIndex),
        null,
        ...without.slice(insertIndex),
      ];
      const updates: Array<{ id: string; sortOrder: number; collectionId?: string | null }> = [];
      next.forEach((r, i) => {
        if (r === null) {
          const needsParentChange =
            (draggedRow.collectionId ?? null) !== toCollectionId;
          const needsOrderChange = (draggedRow.sortOrder ?? 0) !== i;
          if (needsParentChange || needsOrderChange) {
            updates.push({
              id: requestId,
              sortOrder: i,
              ...(needsParentChange ? { collectionId: toCollectionId } : {}),
            });
          }
        } else if ((r.sortOrder ?? 0) !== i) {
          updates.push({ id: r.id, sortOrder: i });
        }
      });
      if (updates.length === 0) return;

      // Optimistic cache write — the sidebar re-renders instantly with the
      // new order. The reconciliation invalidation at the end will
      // overwrite this with whatever the DB returns.
      qc.setQueryData<RequestNode[]>(['requests', workspaceId, null], (prev) => {
        if (!prev) return prev;
        const byId = new Map(updates.map((u) => [u.id, u] as const));
        return prev.map((row) => {
          const u = byId.get(row.id);
          if (!u) return row;
          return {
            ...row,
            sortOrder: u.sortOrder,
            ...(u.collectionId !== undefined ? { collectionId: u.collectionId } : {}),
          };
        });
      });

      // Background writes — direct IPC (no React Query mutation hook = no
      // per-write invalidations). One invalidation at the end reconciles.
      void Promise.all(
        updates.map((u) =>
          voltApi['apiRequest:update']({
            id: u.id,
            ...(u.collectionId !== undefined ? { collectionId: u.collectionId } : {}),
            sortOrder: u.sortOrder,
          } as never),
        ),
      )
        .catch((err) => toast.error('Could not reorder requests', err))
        .finally(() => {
          qc.invalidateQueries({ queryKey: ['requests'] });
        });
    },
    reorderCollectionNear: (collectionId, targetCollectionId, side) => {
      if (collectionId === targetCollectionId) return;
      const all = (collections ?? []) as CollectionNode[];
      const draggedRow = all.find((c) => c.id === collectionId);
      const targetRow = all.find((c) => c.id === targetCollectionId);
      if (!draggedRow || !targetRow) return;
      const toParentId = targetRow.parentId ?? null;
      // Cycle guard: a collection can't become its own descendant.
      let cursor: string | null = toParentId;
      while (cursor) {
        if (cursor === collectionId) return;
        const parent = all.find((c) => c.id === cursor);
        cursor = parent?.parentId ?? null;
      }
      const allInParent = all
        .filter((c) => (c.parentId ?? null) === toParentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const without = allInParent.filter((c) => c.id !== collectionId);
      const targetIndex = without.findIndex((c) => c.id === targetCollectionId);
      if (targetIndex < 0) return;
      const insertIndex = side === 'above' ? targetIndex : targetIndex + 1;
      const next: Array<CollectionNode | null> = [
        ...without.slice(0, insertIndex),
        null,
        ...without.slice(insertIndex),
      ];
      const updates: Array<{ id: string; sortOrder: number; parentId?: string | null }> = [];
      next.forEach((c, i) => {
        if (c === null) {
          const needsParentChange = (draggedRow.parentId ?? null) !== toParentId;
          const needsOrderChange = (draggedRow.sortOrder ?? 0) !== i;
          if (needsParentChange || needsOrderChange) {
            updates.push({
              id: collectionId,
              sortOrder: i,
              ...(needsParentChange ? { parentId: toParentId } : {}),
            });
          }
        } else if ((c.sortOrder ?? 0) !== i) {
          updates.push({ id: c.id, sortOrder: i });
        }
      });
      if (updates.length === 0) return;

      qc.setQueryData<CollectionNode[]>(['collections', workspaceId], (prev) => {
        if (!prev) return prev;
        const byId = new Map(updates.map((u) => [u.id, u] as const));
        return prev.map((row) => {
          const u = byId.get(row.id);
          if (!u) return row;
          return {
            ...row,
            sortOrder: u.sortOrder,
            ...(u.parentId !== undefined ? { parentId: u.parentId } : {}),
          };
        });
      });

      void Promise.all(
        updates.map((u) =>
          voltApi['collection:update']({
            id: u.id,
            ...(u.parentId !== undefined ? { parentId: u.parentId } : {}),
            sortOrder: u.sortOrder,
          } as never),
        ),
      )
        .catch((err) => toast.error('Could not reorder collections', err))
        .finally(() => {
          qc.invalidateQueries({ queryKey: ['collections'] });
        });
    },
    searching,
    visibleCollections,
    visibleRequests,
    activeAncestors,
  };

  const searchBar = (
    <div className="sticky top-0 z-10 border-b border-border bg-bg px-2 py-1.5">
      <div className="relative flex items-center">
        <Search size={12} className="pointer-events-none absolute left-2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requests…"
          className="h-7 w-full rounded-md border border-border bg-bg-elevated pl-7 pr-7 text-xs text-text outline-none placeholder:text-text-muted focus:ring-1 focus:ring-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-1 rounded p-0.5 text-text-muted hover:bg-bg hover:text-text"
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );

  // Filter root lists by visibility sets so the top-level reflects search.
  const visibleRootCollections = rootCollections.filter((c) => visibleCollections.has(c.id));
  const visibleRootRequests = rootRequests.filter((r) => visibleRequests.has(r.id));

  if (rootCollections.length === 0 && rootRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-xs text-text-muted">No requests yet</p>
        <button
          onClick={() => openModal({ kind: 'new-request', collectionId: null })}
          className="mt-2 text-xs text-accent hover:underline"
        >
          Create your first request
        </button>
      </div>
    );
  }

  function handleRootDragOver(e: DragEvent) {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setRootDropActive(true);
  }
  function handleRootDrop(e: DragEvent) {
    e.preventDefault();
    setRootDropActive(false);
    if (!dragging) return;
    if (dragging.kind === 'request') ctx.moveRequest(dragging.id, null);
    else if (dragging.kind === 'collection') {
      if (!ctx.wouldCycle(dragging.id, null)) ctx.moveCollection(dragging.id, null);
    }
    setDragging(null);
  }

  return (
    <TreeContext.Provider value={ctx}>
      {searchBar}
      <div
        className={cn(
          'min-h-full py-1 transition-colors',
          rootDropActive && 'bg-accent/5',
        )}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setRootDropActive(false)}
        onDrop={handleRootDrop}
      >
        {searching && visibleRootCollections.length === 0 && visibleRootRequests.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-text-muted">
            No matches for "{query}"
          </p>
        )}
        {visibleRootCollections.map((c) => (
          <CollectionItem
            key={c.id}
            collection={c}
            depth={0}
            collectionsByParent={collectionsByParent}
            requestsByCollection={requestsByCollection}
          />
        ))}
        {visibleRootRequests.map((r) => (
          <RequestItem key={r.id} request={r} depth={0} />
        ))}
      </div>
    </TreeContext.Provider>
  );
}

function CollectionItem({
  collection,
  depth,
  collectionsByParent,
  requestsByCollection,
}: {
  collection: CollectionNode;
  depth: number;
  collectionsByParent: Map<string | null, CollectionNode[]>;
  requestsByCollection: Map<string | null, RequestNode[]>;
}) {
  const [open, setOpen] = useState(depth < 1);
  // Drop zone within this folder row: 'above' = insert before this folder,
  // 'into' = move dragged item into this folder (existing behavior),
  // 'below' = insert after this folder.
  const [dropZone, setDropZone] = useState<'above' | 'into' | 'below' | null>(null);
  const { open: openModal } = useModals();
  const deleteCollection = useDeleteCollection();
  const updateCollection = useUpdateCollection();
  const duplicateCollection = useDuplicateCollection();
  const [renaming, setRenaming] = useState(false);
  const tree = useTree();

  // While searching, force-expand and only render visible descendants.
  const allChildren = collectionsByParent.get(collection.id) ?? [];
  const allChildRequests = requestsByCollection.get(collection.id) ?? [];
  const children = tree.searching
    ? allChildren.filter((c) => tree.visibleCollections.has(c.id))
    : allChildren;
  const childRequests = tree.searching
    ? allChildRequests.filter((r) => tree.visibleRequests.has(r.id))
    : allChildRequests;
  const expanded = tree.searching ? true : open;
  const onActivePath = tree.activeAncestors.has(collection.id);
  const activeRequestId = useSelection((s) => s.requestId);
  // Reveal the active request: open every folder on its path whenever the
  // active request changes (the user can still collapse it afterwards).
  useEffect(() => {
    if (onActivePath) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequestId, onActivePath]);

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `collection:${collection.id}`);
    tree.setDragging({ kind: 'collection', id: collection.id });
  }

  // Compute which of the three zones the mouse is currently in. Returns
  // null when the row refuses the drop (self, would-cycle, etc.).
  function computeDropZone(clientY: number, rect: DOMRect): 'above' | 'into' | 'below' | null {
    const drag = tree.dragging;
    if (!drag) return null;
    const yFrac = (clientY - rect.top) / rect.height;
    if (drag.kind === 'collection') {
      if (drag.id === collection.id) return null;
      if (yFrac < 0.25) return 'above';
      if (yFrac > 0.75) return 'below';
      return tree.wouldCycle(drag.id, collection.id) ? null : 'into';
    }
    // Request being dragged: only "into" makes sense for a folder row.
    return 'into';
  }

  function handleDragOver(e: DragEvent) {
    if (!tree.dragging) return;
    const zone = computeDropZone(e.clientY, e.currentTarget.getBoundingClientRect());
    if (!zone) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropZone(zone);
  }
  function handleDrop(e: DragEvent) {
    const zone = dropZone;
    setDropZone(null);
    if (!tree.dragging || !zone) return;
    e.preventDefault();
    e.stopPropagation();
    const drag = tree.dragging;
    tree.setDragging(null);
    if (zone === 'into') {
      if (drag.kind === 'request') tree.moveRequest(drag.id, collection.id);
      else tree.moveCollection(drag.id, collection.id);
      setOpen(true); // open the folder so user sees the moved item land
      return;
    }
    // above/below — drop this collection above/below the target row.
    if (drag.kind !== 'collection') return;
    tree.reorderCollectionNear(drag.id, collection.id, zone);
  }

  return (
    <div onDragEnd={() => tree.setDragging(null)}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropZone(null)}
        onDrop={handleDrop}
        className={cn(
          'group relative flex items-center justify-between rounded px-1.5 py-1 hover:bg-bg-elevated',
          dropZone === 'into' && 'bg-accent/10 ring-1 ring-accent/40',
          tree.dragging?.kind === 'collection' &&
            tree.dragging.id === collection.id &&
            'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {/* Insertion line for above/below — absolute so it doesn't shift layout. */}
        {dropZone === 'above' && (
          <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-accent" />
        )}
        {dropZone === 'below' && (
          <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />
        )}
        {renaming ? (
          <InlineRename
            initial={collection.name}
            icon={<Folder size={13} className="text-text-muted" />}
            onCancel={() => setRenaming(false)}
            onCommit={(name) => {
              setRenaming(false);
              if (name !== collection.name) updateCollection.mutate({ id: collection.id, name });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            onDoubleClick={() => setRenaming(true)}
            className="flex flex-1 items-center gap-1.5 truncate text-left text-13"
          >
            <ChevronRight
              size={12}
              className={cn('text-text-muted transition-transform', expanded && 'rotate-90')}
            />
            <Folder size={13} className={onActivePath ? 'text-accent' : 'text-text-muted'} />
            <span className={cn('truncate text-text', onActivePath && 'font-medium')}>
              {collection.name}
            </span>
          </button>
        )}

        <ItemMenu
          actions={[
            {
              label: 'New request',
              icon: <FileText size={13} />,
              onClick: () => openModal({ kind: 'new-request', collectionId: collection.id }),
            },
            {
              label: 'New sub-folder',
              icon: <FolderPlus size={13} />,
              onClick: () => openModal({ kind: 'new-collection', parentId: collection.id }),
            },
            {
              label: 'Rename',
              icon: <Pencil size={13} />,
              onClick: () => setRenaming(true),
            },
            {
              label: 'Duplicate',
              icon: <Copy size={13} />,
              onClick: () => duplicateCollection.mutate(collection.id),
            },
            {
              label: 'Documentation',
              icon: <BookText size={13} />,
              onClick: () =>
                openModal({ kind: 'collection-docs', collectionId: collection.id }),
            },
            {
              label: 'Mocks…',
              icon: <Server size={13} />,
              onClick: () =>
                openModal({ kind: 'collection-mocks', collectionId: collection.id }),
            },
            {
              label: 'Export…',
              icon: <Download size={13} />,
              onClick: () =>
                openModal({
                  kind: 'export-collection',
                  collectionId: collection.id,
                  collectionName: collection.name,
                }),
            },
            {
              label: 'Delete',
              icon: <Trash2 size={13} />,
              destructive: true,
              onClick: () => {
                if (confirm(`Delete "${collection.name}" and all its contents?`)) {
                  deleteCollection.mutate(collection.id);
                }
              },
            },
          ]}
        />
      </div>

      {expanded && (
        <div>
          {children.map((c) => (
            <CollectionItem
              key={c.id}
              collection={c}
              depth={depth + 1}
              collectionsByParent={collectionsByParent}
              requestsByCollection={requestsByCollection}
            />
          ))}
          {childRequests.map((r) => (
            <RequestItem key={r.id} request={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestItem({
  request,
  depth,
}: {
  request: RequestNode;
  depth: number;
}) {
  const { requestId, selectRequest } = useSelection();
  const deleteRequest = useDeleteRequest();
  const duplicate = useDuplicateRequest();
  const updateRequest = useUpdateRequest();
  const [renaming, setRenaming] = useState(false);
  const { open: openModal } = useModals();
  const active = requestId === request.id;
  const { data: widget } = useWidgetFavorites();
  const setWidgetFavorite = useSetWidgetFavorite();
  const inWidget = widget?.requestIds.includes(request.id) ?? false;
  const tree = useTree();
  const rowRef = useRef<HTMLDivElement>(null);
  // Scroll the active row into view when it becomes active (tab switch,
  // global search, command palette…). Deferred a frame so parent folders
  // that just auto-expanded have rendered.
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() =>
      rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
    return () => cancelAnimationFrame(id);
  }, [active]);
  const beingDragged = tree.dragging?.kind === 'request' && tree.dragging.id === request.id;
  const examples = request.examples ?? [];
  const hasExamples = examples.length > 0;
  // Local expand state; force open while searching so any matched descendant
  // is reachable. Default collapsed so existing requests don't reflow.
  const [open, setOpen] = useState(false);
  // 'above' / 'below' — request rows are leaves so there's no "into".
  const [dropZone, setDropZone] = useState<'above' | 'below' | null>(null);
  const expanded = tree.searching ? true : open;

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `request:${request.id}`);
    tree.setDragging({ kind: 'request', id: request.id });
  }

  function handleDragOver(e: DragEvent) {
    const drag = tree.dragging;
    // Only request → request reorder makes sense on a request row. A
    // dragged collection should land on a collection or root.
    if (!drag || drag.kind !== 'request' || drag.id === request.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropZone(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }
  function handleDrop(e: DragEvent) {
    const zone = dropZone;
    setDropZone(null);
    const drag = tree.dragging;
    if (!drag || drag.kind !== 'request' || !zone) return;
    e.preventDefault();
    e.stopPropagation();
    tree.setDragging(null);
    tree.reorderRequestNear(drag.id, request.id, zone);
  }

  // Build the summary list once per render; cheap, examples are small.
  const exampleSummaries: ExampleSummary[] = examples.map((e) => ({
    id: e.id,
    name: e.name,
    statusCode: e.response?.ok ? e.response.statusCode : undefined,
  }));

  return (
    <div onDragEnd={() => tree.setDragging(null)}>
      <div
        ref={rowRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropZone(null)}
        onDrop={handleDrop}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'group relative flex items-center justify-between rounded px-1.5 py-1 hover:bg-bg-elevated',
          active && 'bg-accent/15 hover:bg-accent/20',
          beingDragged && 'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {active && (
          <span className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent" />
        )}
        {dropZone === 'above' && (
          <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded-full bg-accent" />
        )}
        {dropZone === 'below' && (
          <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />
        )}
        {/* Chevron column — always rendered (even when empty) so request rows
            align horizontally regardless of whether they have examples. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasExamples) setOpen(!open);
          }}
          className={cn(
            'mr-0.5 flex h-4 w-4 items-center justify-center rounded text-text-muted',
            hasExamples ? 'hover:bg-bg' : 'invisible',
          )}
          tabIndex={hasExamples ? 0 : -1}
          aria-label={expanded ? 'Collapse examples' : 'Expand examples'}
        >
          <ChevronRight
            size={11}
            className={cn('transition-transform', expanded && 'rotate-90')}
          />
        </button>

        {renaming ? (
          <InlineRename
            initial={request.name}
            icon={
              <span className={cn('font-mono text-[10px] font-semibold', methodColorClass(request.method))}>
                {request.method.slice(0, 4)}
              </span>
            }
            onCancel={() => setRenaming(false)}
            onCommit={(name) => {
              setRenaming(false);
              if (name !== request.name) updateRequest.mutate({ id: request.id, name });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => selectRequest(request.id)}
            onDoubleClick={() => setRenaming(true)}
            className="flex flex-1 items-center gap-2 truncate text-left text-13"
          >
            {request.body?.type === 'grpc' ? (
              <span className="font-mono text-[10px] font-semibold text-accent">gRPC</span>
            ) : (
              <span className={cn('font-mono text-[10px] font-semibold', methodColorClass(request.method))}>
                {request.method.slice(0, 4)}
              </span>
            )}
            <span className={cn('truncate text-text', active && 'font-medium')}>{request.name}</span>
            {hasExamples && (
              <span className="ml-1 text-[10px] text-text-muted">{examples.length}</span>
            )}
            {inWidget && widget?.supported && (
              <Zap size={10} className="ml-auto shrink-0 fill-accent text-accent" aria-label="In desktop widget" />
            )}
          </button>
        )}

        <ItemMenu
          actions={[
            {
              label: 'Rename',
              icon: <Pencil size={13} />,
              onClick: () => setRenaming(true),
            },
            {
              label: 'Duplicate',
              icon: <Copy size={13} />,
              onClick: () => duplicate.mutate(request.id),
            },
            {
              label: 'Documentation',
              icon: <BookText size={13} />,
              onClick: () => openModal({ kind: 'request-docs', requestId: request.id }),
            },
            {
              label: 'Add example',
              icon: <FilePlus2 size={13} />,
              onClick: () => openModal({ kind: 'add-example', requestId: request.id }),
            },
            ...(widget?.supported
              ? [
                  {
                    label: inWidget ? 'Remove from Widget' : 'Add to Widget',
                    icon: inWidget ? <ZapOff size={13} /> : <Zap size={13} />,
                    onClick: () => setWidgetFavorite.mutate({ requestId: request.id, favorite: !inWidget }),
                  },
                ]
              : []),
            {
              label: 'Delete',
              icon: <Trash2 size={13} />,
              destructive: true,
              onClick: () => {
                if (confirm(`Delete "${request.name}"?`)) {
                  deleteRequest.mutate(request.id);
                }
              },
            },
          ]}
        />
      </div>

      {expanded && hasExamples && (
        <div>
          {exampleSummaries.map((ex) => (
            <ExampleItem
              key={ex.id}
              requestId={request.id}
              example={ex}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExampleItem({
  requestId,
  example,
  depth,
}: {
  requestId: string;
  example: ExampleSummary;
  depth: number;
}) {
  const {
    requestId: activeRequestId,
    selectedExampleId,
    selectExample,
    setSelectedExampleId,
  } = useSelection();
  const updateRequest = useUpdateRequest();
  const qc = useQueryClient();
  const active = activeRequestId === requestId && selectedExampleId === example.id;

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-bg-elevated',
        active && 'bg-bg-elevated text-text',
        !active && 'text-text-muted',
      )}
      style={{ paddingLeft: `${depth * 12 + 30}px` }}
    >
      <button
        type="button"
        onClick={() => selectExample(requestId, example.id)}
        className="flex flex-1 items-center gap-2 truncate text-left"
        title={example.name}
      >
        <FileCode2 size={11} className="flex-shrink-0" />
        <span className="truncate">{example.name}</span>
        {example.statusCode != null && (
          <span className="ml-1 font-mono text-[10px] text-text-muted">
            {example.statusCode}
          </span>
        )}
      </button>

      <ItemMenu
        actions={[
          {
            label: 'Delete',
            icon: <Trash2 size={13} />,
            destructive: true,
            onClick: () => {
              if (!confirm(`Delete example "${example.name}"?`)) return;
              // Read from the React Query cache so we pick up any pending
              // edits to other examples (e.g. an auto-save in flight) instead
              // of stale data from the list query.
              const current = qc.getQueryData<{ examples?: Array<{ id: string }> }>([
                'request',
                requestId,
              ]);
              const examples = (current?.examples ?? []) as Array<{ id: string }>;
              updateRequest.mutate({
                id: requestId,
                examples: examples.filter((e) => e.id !== example.id) as never,
              });
              if (selectedExampleId === example.id) setSelectedExampleId(null);
            },
          },
        ]}
      />
    </div>
  );
}

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

/**
 * Inline rename field that replaces a row's label. Enter / blur commits,
 * Escape cancels. (window.prompt isn't available in Electron renderers.)
 */
function InlineRename({
  initial,
  icon,
  onCommit,
  onCancel,
}: {
  initial: string;
  icon?: React.ReactNode;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard so blur-after-Enter / blur-after-Escape doesn't commit twice.
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function finish(commit: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    const trimmed = value.trim();
    if (commit && trimmed) onCommit(trimmed);
    else onCancel();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  }

  return (
    <div className="flex flex-1 items-center gap-1.5 truncate text-13" onClick={(e) => e.stopPropagation()}>
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => finish(true)}
        maxLength={200}
        className="h-5 min-w-0 flex-1 rounded border border-accent bg-bg px-1 text-13 text-text outline-none"
        aria-label="Rename"
      />
    </div>
  );
}

function ItemMenu({ actions }: { actions: MenuAction[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e: MouseEvent) => e.stopPropagation()}
          className="rounded p-1 text-text-muted opacity-0 hover:bg-bg group-hover:opacity-100"
          aria-label="More actions"
        >
          <MoreHorizontal size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[140px] rounded-md border border-border bg-bg-elevated p-1 text-xs shadow-lg"
        >
          {actions.map((a, i) => (
            <DropdownMenu.Item
              key={i}
              onClick={a.onClick}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5',
                'data-[highlighted]:bg-bg outline-none',
                a.destructive ? 'text-error' : 'text-text',
              )}
            >
              {a.icon}
              {a.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
