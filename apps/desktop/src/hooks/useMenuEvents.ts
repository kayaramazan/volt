// Listen for main-process menu events (currently just "close current tab"
// dispatched when the user hits Cmd/Ctrl+W). Wired once at the App level.

import { useEffect } from 'react';

import { onVoltEvent } from '@/lib/volt-api';
import { useSelection } from '@/stores/selection';
import { useTabActions } from '@/hooks/useTabActions';

export function useMenuEvents() {
  const { closeTab } = useTabActions();
  useEffect(() => {
    return onVoltEvent((event: unknown) => {
      const e = event as { kind?: string };
      if (e?.kind !== 'menu:close-current-tab') return;
      const { requestId } = useSelection.getState();
      // Same path as the tab's × button: prompts when there are unsaved edits.
      if (requestId) closeTab(requestId);
    });
  }, [closeTab]);
}
