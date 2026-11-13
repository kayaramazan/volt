// Tab-closing helpers shared by the tab strip, the Cmd/Ctrl+W menu event and
// the sidebar delete actions. Centralised so every path applies the same
// "unsaved changes?" prompt and drops the request's draft/response state.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSelection } from '@/stores/selection';
import { useDrafts, isDraftDirty } from '@/stores/drafts';

export function useTabActions() {
  const qc = useQueryClient();

  /** Is the tab's draft different from what's saved in the DB? */
  const isTabDirty = useCallback(
    (id: string) => {
      const draft = useDrafts.getState().drafts.get(id);
      const saved = qc.getQueryData(['request', id]);
      return isDraftDirty(draft, saved);
    },
    [qc],
  );

  /**
   * Close a tab. If the request has unsaved edits the user is asked first;
   * returns false when they chose to keep the tab open.
   */
  const closeTab = useCallback(
    (id: string, opts: { force?: boolean } = {}): boolean => {
      if (!opts.force && isTabDirty(id)) {
        const ok = confirm('This request has unsaved changes. Close the tab and discard them?');
        if (!ok) return false;
      }
      useDrafts.getState().forgetRequest(id);
      useSelection.getState().closeTab(id);
      return true;
    },
    [isTabDirty],
  );

  /** Close every tab except `keepId` (or all when omitted). Prompts once if any is dirty. */
  const closeOtherTabs = useCallback(
    (keepId: string | null) => {
      const { openTabs } = useSelection.getState();
      const targets = openTabs.filter((t) => t !== keepId);
      if (targets.some(isTabDirty)) {
        const ok = confirm('Some tabs have unsaved changes. Close them and discard those edits?');
        if (!ok) return;
      }
      for (const id of targets) {
        useDrafts.getState().forgetRequest(id);
        useSelection.getState().closeTab(id);
      }
    },
    [isTabDirty],
  );

  return { isTabDirty, closeTab, closeOtherTabs };
}
