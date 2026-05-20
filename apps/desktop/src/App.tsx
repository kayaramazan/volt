import { useState, useEffect } from 'react';

import { TopBar } from '@/components/layout/TopBar';
import { Workspace } from '@/pages/Workspace';
import { AuthScreen } from '@/pages/AuthScreen';
import { useAuthStatus, useWorkspaces } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { useHotkey } from '@/hooks/useHotkey';
import { useSyncEvents } from '@/hooks/useSyncEvents';

// Modals
import { NewWorkspaceModal } from '@/components/modals/NewWorkspaceModal';
import { NewRequestModal } from '@/components/modals/NewRequestModal';
import { NewCollectionModal } from '@/components/modals/NewCollectionModal';
import { ImportModal } from '@/components/modals/ImportModal';
import { CommandPalette } from '@/components/modals/CommandPalette';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { EditEnvironmentModal } from '@/components/modals/EditEnvironmentModal';
import { GlobalsModal } from '@/components/modals/GlobalsModal';
import { TeamsModal } from '@/components/modals/TeamsModal';
import { CollectionDocsModal } from '@/components/modals/CollectionDocsModal';
import { RequestDocsModal } from '@/components/modals/RequestDocsModal';
import { AddExampleModal } from '@/components/modals/AddExampleModal';

const OFFLINE_SKIP_KEY = 'volt:offline-skip';

/**
 * Top-level routing:
 *   - If not logged in AND not opted to skip → AuthScreen
 *   - Else → main app (TopBar + Workspace + modals)
 *
 * Global hotkeys live here so they fire regardless of focused component.
 */
export function App() {
  const { data: authStatus, isLoading } = useAuthStatus();
  const { workspaceId, setWorkspaceId } = useSelection();
  const { data: workspaces } = useWorkspaces();
  const { open: openModal } = useModals();

  const [offlineSkip, setOfflineSkip] = useState<boolean>(() => {
    return localStorage.getItem(OFFLINE_SKIP_KEY) === 'true';
  });

  // Reset the offline-skip when the user signs out (dispatched by useSignOut)
  // so the auth gate reappears.
  useEffect(() => {
    const handler = () => setOfflineSkip(false);
    window.addEventListener('volt:signed-out', handler);
    return () => window.removeEventListener('volt:signed-out', handler);
  }, []);

  // Wire up sync event broadcasting → query invalidation
  useSyncEvents();

  // Global keyboard shortcuts
  useHotkey('mod+k', () => openModal({ kind: 'command-palette' }));
  useHotkey('mod+n', () => openModal({ kind: 'new-request', collectionId: null }));
  useHotkey('mod+,', () => openModal({ kind: 'settings' }), { allowInInputs: true });

  // Auto-select the first workspace once data loads
  useEffect(() => {
    if (workspaceId || !workspaces) return;
    const first = workspaces.personal[0] ?? workspaces.team[0];
    if (first) setWorkspaceId(first.id);
  }, [workspaceId, workspaces, setWorkspaceId]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading…</div>;
  }

  // First-run gate: prompt for sign in or offline mode
  const showAuthGate = !authStatus?.loggedIn && !offlineSkip;
  if (showAuthGate) {
    return (
      <AuthScreen
        onSkip={() => {
          localStorage.setItem(OFFLINE_SKIP_KEY, 'true');
          setOfflineSkip(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        {workspaceId ? (
          <Workspace workspaceId={workspaceId} />
        ) : (
          <div className="flex h-full items-center justify-center bg-bg">
            <NoWorkspacesYet />
          </div>
        )}
      </main>

      {/* Modal stack — only one renders at a time but kept declared for animation */}
      <NewWorkspaceModal />
      <NewRequestModal />
      <NewCollectionModal />
      <ImportModal />
      <CommandPalette />
      <SettingsModal />
      <EditEnvironmentModal />
      <GlobalsModal />
      <TeamsModal />
      <CollectionDocsModal />
      <RequestDocsModal />
      <AddExampleModal />
    </div>
  );
}

function NoWorkspacesYet() {
  const { open } = useModals();
  return (
    <div className="text-center">
      <p className="text-sm text-text">No workspaces yet</p>
      <button
        type="button"
        onClick={() => open({ kind: 'new-workspace' })}
        className="mt-2 text-xs text-accent hover:underline"
      >
        Create your first workspace →
      </button>
    </div>
  );
}
