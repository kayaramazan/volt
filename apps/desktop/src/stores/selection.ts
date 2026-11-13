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
  /** Which sidebar pane is showing (persisted so it survives workspace switches). */
  sidebarTab: 'collections' | 'history';

  setWorkspaceId: (id: string | null) => void;
  setSidebarTab: (tab: 'collections' | 'history') => void;
  /** Move the tab at `from` to index `to` (drag-and-drop reorder). */
  reorderTab: (from: number, to: number) => void;
  /**
   * Drop any open tab whose request no longer exists (deleted locally, via
   * sync, or the collection it lived in was removed). Keeps the active tab
   * valid — falls back to the last remaining tab or none.
   */
  pruneTabs: (existingIds: Set<string>) => void;
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
      sidebarTab: 'collections',

      setWorkspaceId: (id) => {
        // No-op when already selected — otherwise we'd close every tab for
        // nothing (e.g. global search picking a request in the current workspace).
        if (get().workspaceId === id) return;
        // Changing workspace closes all open tabs from the previous one
        set({ workspaceId: id, requestId: null, openTabs: [], selectedExampleId: null });
      },
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      reorderTab: (from, to) => {
        const tabs = [...get().openTabs];
        if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return;
        const [moved] = tabs.splice(from, 1);
        tabs.splice(to, 0, moved!);
        set({ openTabs: tabs });
      },
      pruneTabs: (existingIds) => {
        const { openTabs, requestId, selectedExampleId } = get();
        const tabs = openTabs.filter((t) => existingIds.has(t));
        if (tabs.length === openTabs.length) return;
        const activeGone = requestId !== null && !existingIds.has(requestId);
        set({
          openTabs: tabs,
          requestId: activeGone ? (tabs[tabs.length - 1] ?? null) : requestId,
          selectedExampleId: activeGone ? null : selectedExampleId,
        });
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
        sidebarTab: state.sidebarTab,
      }),
    },
  ),
);
