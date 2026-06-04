// Listen for main-process menu events (currently just "close current tab"
// dispatched when the user hits Cmd/Ctrl+W). Wired once at the App level.

import { useEffect } from 'react';

import { onVoltEvent } from '@/lib/volt-api';
import { useSelection } from '@/stores/selection';

export function useMenuEvents() {
  useEffect(() => {
    return onVoltEvent((event: unknown) => {
      const e = event as { kind?: string };
      if (e?.kind !== 'menu:close-current-tab') return;
      const { requestId, closeTab } = useSelection.getState();
      if (requestId) closeTab(requestId);
    });
  }, []);
}
