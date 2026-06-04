// Conflict-resolution panel. Lists every active entry in the local
// conflict_log for the current workspace — i.e. local edits that got
// overwritten by a pulled change. The user can either:
//   • Restore mine — re-apply the captured previousState locally so the
//     next push sends it back to the server.
//   • Dismiss — accept the teammate's version and drop the log row.
// Both close the banner once no active conflicts remain.

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { CodeEditor } from '@/components/request/CodeEditor';
import {
  useConflicts,
  useDismissConflict,
  useRestoreConflict,
} from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { formatRelativeTime, cn } from '@/lib/util';

interface ConflictRow {
  id: string;
  workspaceId: string;
  table: 'collection' | 'request' | 'environment';
  rowId: string;
  previousState: unknown;
  overwrittenByName: string;
  overwrittenByUserId: string;
  overwrittenAt: number;
  dismissedAt: number | null;
}

export function ConflictsModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'conflicts';
  const workspaceId = current.kind === 'conflicts' ? current.workspaceId : null;
  const { data, isLoading } = useConflicts(workspaceId);
  const restore = useRestoreConflict();
  const dismiss = useDismissConflict();
  const conflicts = (data ?? []) as ConflictRow[];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Resolve conflicts"
      description="Your local edits below were overwritten by a sync pull. Restore yours to push them back, or dismiss to accept the incoming version."
      className="max-w-3xl"
    >
      {isLoading ? (
        <p className="px-3 py-6 text-center text-xs text-text-muted">Loading…</p>
      ) : conflicts.length === 0 ? (
        <div className="rounded border border-success/30 bg-success/5 px-3 py-6 text-center text-xs text-success">
          No active conflicts. You're all caught up.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] text-text-muted">
            {conflicts.length} unresolved conflict{conflicts.length === 1 ? '' : 's'}.
          </div>
          {conflicts.map((c) => (
            <ConflictRowView
              key={c.id}
              conflict={c}
              restoring={restore.isPending}
              dismissing={dismiss.isPending}
              onRestore={() => restore.mutate({ id: c.id })}
              onDismiss={() => dismiss.mutate({ id: c.id })}
            />
          ))}
        </div>
      )}
    </Dialog>
  );
}

function ConflictRowView({
  conflict,
  restoring,
  dismissing,
  onRestore,
  onDismiss,
}: {
  conflict: ConflictRow;
  restoring: boolean;
  dismissing: boolean;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const prevName = nameFromState(conflict.previousState);
  const prevJson = useStableJson(conflict.previousState);

  return (
    <div className="rounded border border-border bg-bg-elevated">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg"
      >
        {expanded ? (
          <ChevronDown size={12} className="flex-shrink-0 text-text-muted" />
        ) : (
          <ChevronRight size={12} className="flex-shrink-0 text-text-muted" />
        )}
        <AlertTriangle size={12} className="flex-shrink-0 text-warning" />
        <span className="font-mono text-[10px] uppercase text-text-muted">
          {conflict.table}
        </span>
        <span className="flex-1 truncate text-text">
          {prevName ?? <span className="font-mono">{conflict.rowId.slice(0, 8)}…</span>}
        </span>
        <span className="text-[11px] text-text-muted">
          {conflict.overwrittenByName && (
            <>
              by <span className="text-text">{conflict.overwrittenByName}</span>{' '}
            </>
          )}
          {formatRelativeTime(new Date(conflict.overwrittenAt).toISOString())}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-2">
          <p className="mb-1 text-[11px] text-text-muted">
            Your version (before the overwrite):
          </p>
          <div className={cn('flex min-h-[8rem] flex-col rounded border border-border')}>
            <CodeEditor value={prevJson} language="json" readOnly className="min-h-[8rem]" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-1 border-t border-border px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={dismissing}
          onClick={onDismiss}
        >
          <X size={11} /> Dismiss
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={restoring}
          onClick={onRestore}
          title="Re-apply your version locally so the next push sends it back to the server"
        >
          {restoring ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <RotateCcw size={11} />
          )}
          Restore mine
        </Button>
      </div>
    </div>
  );
}

function nameFromState(state: unknown): string | null {
  if (state && typeof state === 'object' && 'name' in state) {
    const n = (state as { name?: unknown }).name;
    if (typeof n === 'string' && n.length > 0) return n;
  }
  return null;
}

function useStableJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
