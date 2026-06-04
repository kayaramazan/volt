// Active selection state — which workspace, request, and tab are open.
// Persisted to localStorage so the app restores last context on restart.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectionState {
  workspaceId: string | null;
  requestId: string | null;
  /** Open tabs as a list of request IDs */
  openTabs: string[];
  /**
   * Example to focus inside the active request. Set when the user clicks an
   * example row in the sidebar (or clicks one in the Examples panel). Cleared
   * when switching to a different request or closing the owning tab.
   */
  selectedExampleId: string | null;
  /** Whether the right (response) panel is visible */
  responsePanelOpen: boolean;
  /** Whether the left (sidebar) panel is visible */
  sidebarOpen: boolean;

  setWorkspaceId: (id: string | null) => void;
  selectRequest: (id: string | null) => void;
  /** Select a request and focus a specific example inside it. */
  selectExample: (requestId: string, exampleId: string) => void;
  /** Just update the focused example for the current request. */
  setSelectedExampleId: (id: string | null) => void;
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
      selectedExampleId: null,
      responsePanelOpen: true,
      sidebarOpen: true,

      setWorkspaceId: (id) => {
        // Changing workspace closes all open tabs from the previous one
        set({ workspaceId: id, requestId: null, openTabs: [], selectedExampleId: null });
      },
      selectRequest: (id) => {
        if (!id) {
          set({ requestId: null, selectedExampleId: null });
          return;
        }
        const current = get().requestId;
        const tabs = get().openTabs;
        const next: Partial<SelectionState> = { requestId: id };
        if (!tabs.includes(id)) next.openTabs = [...tabs, id];
        // Switching to a different request resets the focused example.
        if (current !== id) next.selectedExampleId = null;
        set(next as SelectionState);
      },
      selectExample: (requestId, exampleId) => {
        const tabs = get().openTabs;
        const next: Partial<SelectionState> = {
          requestId,
          selectedExampleId: exampleId,
        };
        if (!tabs.includes(requestId)) next.openTabs = [...tabs, requestId];
        set(next as SelectionState);
      },
      setSelectedExampleId: (id) => set({ selectedExampleId: id }),
      closeTab: (id) => {
        const tabs = get().openTabs.filter((t) => t !== id);
        const wasActive = get().requestId === id;
        const newActive = wasActive ? tabs[tabs.length - 1] ?? null : get().requestId;
        set({
          openTabs: tabs,
          requestId: newActive,
          // Clear the focused example whenever the owning tab disappears.
          selectedExampleId: wasActive ? null : get().selectedExampleId,
        });
      },
      closeAllTabs: () => set({ openTabs: [], requestId: null, selectedExampleId: null }),
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
        selectedExampleId: state.selectedExampleId,
        responsePanelOpen: state.responsePanelOpen,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
);
