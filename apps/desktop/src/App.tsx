import { useState, useEffect } from 'react';

import { TopBar } from '@/components/layout/TopBar';
import { Toaster } from '@/components/layout/Toaster';
import { Workspace } from '@/pages/Workspace';
import { AuthScreen } from '@/pages/AuthScreen';
import { WelcomePage } from '@/pages/WelcomePage';
import { useAuthStatus, useWorkspaces } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { useDrafts } from '@/stores/drafts';
import { useHotkey } from '@/hooks/useHotkey';
import { useSyncEvents } from '@/hooks/useSyncEvents';
import { useMenuEvents } from '@/hooks/useMenuEvents';
import { useWidgetBridge } from '@/hooks/useWidgetBridge';

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
import { CodeGenModal } from '@/components/modals/CodeGenModal';
import { ExportCollectionModal } from '@/components/modals/ExportCollectionModal';
import { GlobalSearchModal } from '@/components/modals/GlobalSearchModal';
import { ResponseDiffModal } from '@/components/modals/ResponseDiffModal';
import { WebSocketModal } from '@/components/modals/WebSocketModal';
import { ChainModal } from '@/components/modals/ChainModal';
import { CollectionMocksModal } from '@/components/modals/CollectionMocksModal';
import { MockSettingsModal } from '@/components/modals/MockSettingsModal';
import { PluginsModal } from '@/components/modals/PluginsModal';
import { ConflictsModal } from '@/components/modals/ConflictsModal';

const OFFLINE_SKIP_KEY = 'volt:offline-skip';
const ONBOARDED_KEY = 'volt:onboarded';

/**
 * Top-level routing:
 *   - If not logged in AND not opted to skip → AuthScreen
 *   - Else → main app (TopBar + Workspace + modals)
 *
 * Global hotkeys live here so they fire regardless of focused component.
 */
export function App() {
  const { data: authStatus, isLoading } = useAuthStatus();
  const { workspaceId, setWorkspaceId, selectRequest, toggleSidebar } = useSelection();
  const { data: workspaces } = useWorkspaces();
  const { open: openModal } = useModals();

  const [offlineSkip, setOfflineSkip] = useState<boolean>(() => {
    return localStorage.getItem(OFFLINE_SKIP_KEY) === 'true';
  });
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  });

  // Reset the offline-skip + onboarded flag when the user signs out so a
  // fresh sign-in elsewhere brings the welcome flow back. (Onboarded is
  // device-scoped; the explicit signOut intent is the natural reset point.)
  useEffect(() => {
    const handler = () => {
      setOfflineSkip(false);
      // Onboarded stays true after a sign-out — once a user knows the app,
      // we don't show the welcome again. The auth gate handles re-entry.
    };
    window.addEventListener('volt:signed-out', handler);
    return () => window.removeEventListener('volt:signed-out', handler);
  }, []);

  function markOnboarded() {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
  }

  // Wire up sync event broadcasting → query invalidation
  useSyncEvents();
  useMenuEvents();
  useWidgetBridge();

  // Global keyboard shortcuts
  useHotkey('mod+k', () => openModal({ kind: 'command-palette' }));
  useHotkey('mod+p', () => openModal({ kind: 'global-search' }));
  useHotkey('mod+n', () => openModal({ kind: 'new-request', collectionId: null }));
  useHotkey('mod+,', () => openModal({ kind: 'settings' }), { allowInInputs: true });
  // Cmd/Ctrl+\ toggles the sidebar (same binding as Postman).
  useHotkey('mod+\\', toggleSidebar, { allowInInputs: true });

  // Drafts and cached responses are per-request; switching workspace closes
  // every tab, so drop them too (otherwise re-opening a request later shows
  // stale unsaved edits from the previous session in that workspace).
  useEffect(() => {
    useDrafts.getState().clearAll();
  }, [workspaceId]);

  // Auto-select the first workspace once data loads. Also reset the
  // persisted selection if it points to a workspace that no longer exists
  // (deleted locally, removed via sync, or local DB recreated) — otherwise
  // downstream writes (import, create request, …) fail the workspace FK.
  useEffect(() => {
    if (!workspaces) return;
    const all = [...workspaces.personal, ...workspaces.team];
    const stillExists = workspaceId ? all.some((w) => w.id === workspaceId) : false;
    if (workspaceId && !stillExists) {
      setWorkspaceId(all[0]?.id ?? null);
      return;
    }
    if (!workspaceId && all[0]) setWorkspaceId(all[0].id);
  }, [workspaceId, workspaces, setWorkspaceId]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-xs text-text-muted">Loading…</div>;
  }

  // First-launch welcome: signed-out user with no local workspaces who
  // hasn't dismissed onboarding yet. Once they pick a path (import / start
  // fresh / sign in / skip) we set ONBOARDED_KEY and never show it again.
  const hasAnyWorkspace =
    (workspaces?.personal.length ?? 0) + (workspaces?.team.length ?? 0) > 0;
  const showWelcome = !authStatus?.loggedIn && !onboarded && !hasAnyWorkspace;
  if (showWelcome) {
    return (
      <WelcomePage
        onImport={() => {
          // Mark onboarded immediately — the auth gate would otherwise jump
          // in front of the import modal as soon as state changes.
          localStorage.setItem(OFFLINE_SKIP_KEY, 'true');
          setOfflineSkip(true);
          markOnboarded();
          openModal({ kind: 'import' });
        }}
        onSignIn={() => {
          // Falls through to the auth gate below by clearing offlineSkip
          // and recording that onboarding is over.
          localStorage.removeItem(OFFLINE_SKIP_KEY);
          setOfflineSkip(false);
          markOnboarded();
        }}
        onSkip={() => {
          localStorage.setItem(OFFLINE_SKIP_KEY, 'true');
          setOfflineSkip(true);
          markOnboarded();
        }}
        onSeedDone={(_wsId, requestId) => {
          // Workspace + sample request are already created; jump straight
          // into the editor so the user lands on something runnable.
          localStorage.setItem(OFFLINE_SKIP_KEY, 'true');
          setOfflineSkip(true);
          markOnboarded();
          selectRequest(requestId);
        }}
      />
    );
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
      <CodeGenModal />
      <ExportCollectionModal />
      <GlobalSearchModal />
      <ResponseDiffModal />
      <WebSocketModal />
      <ChainModal />
      <CollectionMocksModal />
      <MockSettingsModal />
      <PluginsModal />
      <ConflictsModal />
      <Toaster />
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
