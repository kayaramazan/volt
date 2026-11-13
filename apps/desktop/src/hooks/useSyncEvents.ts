// Bridge from main process events to TanStack Query cache invalidation.
//
// The sync engine in main process emits:
//   - sync:stateChanged    (UI status indicator updates)
//   - data:changed         (a workspace's data was updated by pull)
//   - sync:conflictDetected (a local dirty row was overwritten)
//
// We invalidate the relevant query keys so the UI re-fetches.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { onVoltEvent } from '@/lib/volt-api';

export function useSyncEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    return onVoltEvent((event) => {
      const e = event as { type: string; workspaceId?: string; table?: string };

      switch (e.type) {
        case 'sync:stateChanged':
          qc.invalidateQueries({ queryKey: ['sync-status'] });
          break;
        case 'data:changed':
          // Specific table → specific query key
          if (e.table === 'collection') {
            qc.invalidateQueries({ queryKey: ['collections', e.workspaceId] });
          } else if (e.table === 'request') {
            qc.invalidateQueries({ queryKey: ['requests', e.workspaceId] });
            qc.invalidateQueries({ queryKey: ['request'] });
          } else if (e.table === 'environment') {
            qc.invalidateQueries({ queryKey: ['environments', e.workspaceId] });
          } else if (e.table === 'workspace') {
            // A team workspace was added, renamed or removed remotely.
            qc.invalidateQueries({ queryKey: ['workspaces'] });
          }
          break;
        case 'sync:conflictDetected':
          // Conflict banner reads conflict log directly via a query (added below)
          qc.invalidateQueries({ queryKey: ['conflicts', e.workspaceId] });
          break;
      }
    });
  }, [qc]);
}
