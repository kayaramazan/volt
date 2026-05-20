import { Plus, Upload, Zap } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';

export function EmptyState() {
  const { open } = useModals();
  const { workspaceId } = useSelection();

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center bg-bg p-8">
        <div className="text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h2 className="text-sm font-medium text-text">Welcome to Volt</h2>
          <p className="mt-1 text-xs text-text-muted">Create your first workspace to get started.</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => open({ kind: 'new-workspace' })}
          >
            <Plus size={13} />
            New workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg p-8">
      <div className="max-w-sm text-center">
        <Zap className="mx-auto mb-3 h-7 w-7 text-accent" />
        <h2 className="text-sm font-medium text-text">No request open</h2>
        <p className="mt-1 text-xs text-text-muted">
          Pick one from the sidebar, or start fresh.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => open({ kind: 'new-request', collectionId: null })}
          >
            <Plus size={13} />
            New request
          </Button>
          <Button
            variant="outline"
            onClick={() => open({ kind: 'import' })}
          >
            <Upload size={13} />
            Import
          </Button>
        </div>
        <p className="mt-6 text-[10px] text-text-muted">
          Try <kbd className="rounded border border-border bg-bg-elevated px-1.5 py-0.5 font-mono">⌘K</kbd>{' '}
          to search anything.
        </p>
      </div>
    </div>
  );
}
