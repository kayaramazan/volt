// Active selection state — which workspace, request, and tab are open.
// Persisted to localStorage so the app restores last context on restart.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectionState {
  workspaceId: string | null;
  requestId: string | null;
  /** Open tabs as a list of request IDs */
  openTabs: string[];
  /** Whether the right (response) panel is visible */
  responsePanelOpen: boolean;
  /** Whether the left (sidebar) panel is visible */
  sidebarOpen: boolean;

  setWorkspaceId: (id: string | null) => void;
  selectRequest: (id: string | null) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  toggleResponsePanel: () => void;
  setResponsePanelOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useSelection = create<SelectionState>()(
  persist(
    (set, get) => ({
      workspaceId: null,
      requestId: null,
      openTabs: [],
      responsePanelOpen: true,
      sidebarOpen: true,

      setWorkspaceId: (id) => {
        // Changing workspace closes all open tabs from the previous one
        set({ workspaceId: id, requestId: null, openTabs: [] });
      },
      selectRequest: (id) => {
        if (!id) {
          set({ requestId: null });
          return;
        }
        const tabs = get().openTabs;
        if (!tabs.includes(id)) {
          set({ requestId: id, openTabs: [...tabs, id] });
        } else {
          set({ requestId: id });
        }
      },
      closeTab: (id) => {
        const tabs = get().openTabs.filter((t) => t !== id);
        const newActive = get().requestId === id ? tabs[tabs.length - 1] ?? null : get().requestId;
        set({ openTabs: tabs, requestId: newActive });
      },
      closeAllTabs: () => set({ openTabs: [], requestId: null }),
      toggleResponsePanel: () => set((s) => ({ responsePanelOpen: !s.responsePanelOpen })),
      setResponsePanelOpen: (open) => set({ responsePanelOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'volt:selection',
      // Only persist a subset — derived state lives in TanStack Query
      partialize: (state) => ({
        workspaceId: state.workspaceId,
        requestId: state.requestId,
        openTabs: state.openTabs,
        responsePanelOpen: state.responsePanelOpen,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
);
