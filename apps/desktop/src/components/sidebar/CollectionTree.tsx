import { createContext, useContext, useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import { BookText, ChevronRight, Copy, FolderPlus, Folder, FileText, FilePlus2, MoreHorizontal, Search, Trash2, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { cn, methodColorClass } from '@/lib/util';
import {
  useCollections,
  useDeleteCollection,
  useDeleteRequest,
  useDuplicateRequest,
  useRequests,
  useUpdateCollection,
  useUpdateRequest,
} from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';

interface Props {
  workspaceId: string;
}

interface CollectionNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
}

interface RequestNode {
  id: string;
  name: string;
  method: string;
  collectionId: string | null;
  sortOrder?: number;
}

type DragPayload =
  | { kind: 'collection'; id: string }
  | { kind: 'request'; id: string };

interface TreeCtx {
  dragging: DragPayload | null;
  setDragging: (p: DragPayload | null) => void;
  moveRequest: (requestId: string, toCollectionId: string | null) => void;
  /** Returns true if moving `collectionId` under `newParentId` would create a cycle. */
  wouldCycle: (collectionId: string, newParentId: string | null) => boolean;
  moveCollection: (collectionId: string, newParentId: string | null) => void;
  /** When true, the tree is filtered to a search query (callers should force-expand). */
  searching: boolean;
  /** Collection ids that should render (own name matched OR has a matching descendant). */
  visibleCollections: Set<string>;
  /** Request ids that should render. */
  visibleRequests: Set<string>;
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
  const { open: openModal } = useModals();
  const updateRequest = useUpdateRequest();
  const updateCollection = useUpdateCollection();
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
      updateRequest.mutate({
        id: requestId,
        collectionId: toCollectionId,
        sortOrder: nextSortOrder(siblings),
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
      updateCollection.mutate({
        id: collectionId,
        parentId: newParentId,
        sortOrder: nextCollectionSortOrder(siblings),
      });
    },
    searching,
    visibleCollections,
    visibleRequests,
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
  const [dropActive, setDropActive] = useState(false);
  const { open: openModal } = useModals();
  const deleteCollection = useDeleteCollection();
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

  // Can this folder accept the currently dragged item?
  const acceptsDrop =
    tree.dragging &&
    !(tree.dragging.kind === 'collection' && tree.dragging.id === collection.id) &&
    !(tree.dragging.kind === 'collection' && tree.wouldCycle(tree.dragging.id, collection.id));

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `collection:${collection.id}`);
    tree.setDragging({ kind: 'collection', id: collection.id });
  }
  function handleDragOver(e: DragEvent) {
    if (!acceptsDrop) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropActive(true);
  }
  function handleDrop(e: DragEvent) {
    if (!acceptsDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    if (!tree.dragging) return;
    if (tree.dragging.kind === 'request') {
      tree.moveRequest(tree.dragging.id, collection.id);
    } else {
      tree.moveCollection(tree.dragging.id, collection.id);
    }
    tree.setDragging(null);
    setOpen(true); // open folder so user sees the moved item land
  }

  return (
    <div onDragEnd={() => tree.setDragging(null)}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
        className={cn(
          'group flex items-center justify-between rounded px-1.5 py-1 hover:bg-bg-elevated',
          dropActive && 'bg-accent/10 ring-1 ring-accent/40',
          tree.dragging?.kind === 'collection' &&
            tree.dragging.id === collection.id &&
            'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-1.5 truncate text-left text-13"
        >
          <ChevronRight
            size={12}
            className={cn('text-text-muted transition-transform', expanded && 'rotate-90')}
          />
          <Folder size={13} className="text-text-muted" />
          <span className="truncate text-text">{collection.name}</span>
        </button>

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
              label: 'Documentation',
              icon: <BookText size={13} />,
              onClick: () =>
                openModal({ kind: 'collection-docs', collectionId: collection.id }),
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
  request: { id: string; name: string; method: string };
  depth: number;
}) {
  const { requestId, selectRequest } = useSelection();
  const deleteRequest = useDeleteRequest();
  const duplicate = useDuplicateRequest();
  const { open: openModal } = useModals();
  const active = requestId === request.id;
  const tree = useTree();
  const beingDragged = tree.dragging?.kind === 'request' && tree.dragging.id === request.id;

  function handleDragStart(e: DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `request:${request.id}`);
    tree.setDragging({ kind: 'request', id: request.id });
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => tree.setDragging(null)}
      className={cn(
        'group flex items-center justify-between rounded px-1.5 py-1 hover:bg-bg-elevated',
        active && 'bg-bg-elevated',
        beingDragged && 'opacity-40',
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <button
        type="button"
        onClick={() => selectRequest(request.id)}
        className="flex flex-1 items-center gap-2 truncate text-left text-13"
      >
        <span className={cn('font-mono text-[10px] font-semibold', methodColorClass(request.method))}>
          {request.method.slice(0, 4)}
        </span>
        <span className="truncate text-text">{request.name}</span>
      </button>

      <ItemMenu
        actions={[
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
  );
}

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
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
