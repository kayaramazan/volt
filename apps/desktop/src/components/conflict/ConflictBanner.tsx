// Sticky banner at the top of the workspace when one or more local edits
// got overwritten by a teammate's sync. The conflict_log table is
// populated by the sync engine in main; we read it via conflict:list and
// invalidate on sync:conflictDetected events (see useSyncEvents).

import { AlertTriangle, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useConflicts, useDismissConflict } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { formatRelativeTime } from '@/lib/util';

interface Props {
  workspaceId: string;
}

export function ConflictBanner({ workspaceId }: Props) {
  const { data: conflicts } = useConflicts(workspaceId);
  const dismiss = useDismissConflict();
  const { open: openModal } = useModals();

  if (!conflicts || conflicts.length === 0) return null;

  const latest = conflicts[0]!;
  const latestAt = new Date(latest.overwrittenAt).toISOString();

  return (
    <div className="flex items-center gap-3 border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs">
      <AlertTriangle size={14} className="shrink-0 text-warning" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-text">
          {conflicts.length === 1 ? '1 of your edits was' : `${conflicts.length} of your edits were`} overwritten
          {latest.overwrittenByName ? (
            <>
              {' by '}
              <span className="font-medium">{latest.overwrittenByName}</span>
            </>
          ) : null}
        </p>
        <p className="text-[11px] text-text-muted">
          Most recent {formatRelativeTime(latestAt)} · {tableLabel(latest.table)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => openModal({ kind: 'conflicts', workspaceId })}
        title="Review and optionally restore overwritten edits"
      >
        <RotateCcw size={11} />
        Review
      </Button>
      <button
        type="button"
        onClick={() => {
          // "Dismiss" applies only to the most recent — the rest stay so the
          // user can still review them. Most users will click Review first.
          void dismiss.mutate({ id: latest.id });
        }}
        className="rounded p-1 text-text-muted hover:bg-bg hover:text-text"
        title="Dismiss this notice"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function tableLabel(t: string): string {
  if (t === 'collection') return 'Collection edit';
  if (t === 'request') return 'Request edit';
  if (t === 'environment') return 'Environment edit';
  return t;
}
