import {
  Zap,
  Search,
  RefreshCw,
  AlertCircle,
  WifiOff,
  Cloud,
  CloudOff,
  Globe,
  Plus,
  Server,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuthStatus, useEnvironments, useMockStatus, useSetActiveEnv, useActiveEnv, useSyncStatus, useWorkspaces } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { voltApi } from '@/lib/volt-api';

/**
 * Top navigation bar.
 *
 * Sections, left → right:
 *   ⚡ Volt logo
 *   Workspace dropdown
 *   Environment dropdown
 *   Sync status indicator (animated when syncing)
 *   ⌘K command palette opener
 *   User menu (account, settings, sign out)
 */
export function TopBar() {
  const { data: workspaces } = useWorkspaces();
  const { workspaceId, setWorkspaceId } = useSelection();
  const { data: environments } = useEnvironments(workspaceId);
  const { data: activeEnv } = useActiveEnv(workspaceId);
  const setActiveEnvM = useSetActiveEnv();
  const { data: syncStatus } = useSyncStatus();
  const { data: authStatus } = useAuthStatus();
  const { open: openModal } = useModals();

  // Build workspace options — flat list of personal + team
  const workspaceOptions = [
    ...(workspaces?.personal ?? []).map((w) => ({
      value: w.id,
      label: w.name,
    })),
    ...(workspaces?.team ?? []).map((w) => ({
      value: w.id,
      // The list response from the local DB only carries `ownerTeamId`, not
      // the team name (Postgres-side joined query lands in v1.1).
      label: `${w.name} · Team`,
    })),
  ];

  const envOptions = [
    { value: '', label: 'No environment' },
    ...(environments ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <header className="titlebar flex h-10 items-center justify-between gap-2 border-b border-border bg-bg-elevated px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-accent" />
          <span className="text-13 font-semibold tracking-tight text-text">Volt</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {workspaceOptions.length > 0 ? (
          <Select
            value={workspaceId ?? ''}
            onChange={(e) => setWorkspaceId(e.target.value)}
            options={workspaceOptions}
            className="w-44"
          />
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openModal({ kind: 'new-workspace' })}
          >
            New workspace
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'new-workspace' })}
          title="New workspace"
        >
          <Plus size={13} />
        </Button>

        <Select
          value={activeEnv?.environmentId ?? ''}
          onChange={(e) =>
            setActiveEnvM.mutate({
              workspaceId: workspaceId!,
              environmentId: e.target.value || null,
            })
          }
          options={envOptions}
          disabled={!workspaceId}
          className="w-40"
        />

        <Button
          size="sm"
          variant="ghost"
          disabled={!workspaceId}
          onClick={() =>
            openModal({ kind: 'edit-environment', environmentId: activeEnv?.environmentId ?? null })
          }
          title="Manage environments"
        >
          <Settings2 size={13} />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'globals' })}
          title="Globals (set by scripts)"
        >
          <Globe size={13} />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <SyncIndicator status={syncStatus} loggedIn={authStatus?.loggedIn ?? false} />
        <MockIndicator />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'command-palette' })}
          title="Open command palette (⌘K)"
        >
          <Search size={13} />
          <span className="text-xs text-text-muted">⌘K</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => openModal({ kind: 'settings' })}
          title="Settings"
        >
          {authStatus?.name ? authStatus.name.slice(0, 1).toUpperCase() : '?'}
        </Button>
      </div>
    </header>
  );
}

function SyncIndicator({
  status,
  loggedIn,
}: {
  status: { state?: string; pendingChanges?: number } | undefined;
  loggedIn: boolean;
}) {
  const { workspaceId } = useSelection();
  const { open: openModal } = useModals();

  if (!loggedIn) {
    return (
      <div
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-text-muted"
        title="Working offline. Data stays on this machine."
      >
        <WifiOff size={12} />
        <span>Offline</span>
      </div>
    );
  }
  const state = status?.state ?? 'offline';
  const pending = status?.pendingChanges ?? 0;

  const config = {
    syncing: { icon: <RefreshCw size={12} className="animate-spin" />, label: 'Syncing…', cls: 'text-sky-400' },
    synced: { icon: <Cloud size={12} />, label: 'Synced', cls: 'text-success' },
    conflict: { icon: <AlertCircle size={12} />, label: 'Conflict', cls: 'text-warning' },
    error: { icon: <CloudOff size={12} />, label: 'Sync error', cls: 'text-error' },
    offline: { icon: <WifiOff size={12} />, label: 'Offline', cls: 'text-text-muted' },
  } as const;

  const c = config[state as keyof typeof config] ?? config.offline;

  // In the conflict state, clicking the pill opens the resolution modal
  // instead of triggering another sync (which won't clear the conflict
  // until the user picks restore-or-dismiss for each row).
  const isConflict = state === 'conflict';
  const onClick = () => {
    if (isConflict && workspaceId) {
      openModal({ kind: 'conflicts', workspaceId });
    } else {
      void voltApi['sync:force']({});
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-bg ${c.cls}`}
      title={
        isConflict
          ? 'Click to review and resolve conflicts.'
          : `${c.label}${pending ? ` · ${pending} pending` : ''}. Click to force sync.`
      }
    >
      {c.icon}
      <span>{c.label}</span>
      {pending > 0 && (
        <span className="rounded bg-warning/20 px-1 text-warning">{pending}</span>
      )}
    </button>
  );
}

function MockIndicator() {
  const { data: status } = useMockStatus();
  const { open: openModal } = useModals();
  const running = !!status?.running;
  return (
    <button
      type="button"
      onClick={() => openModal({ kind: 'mock-settings' })}
      className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-bg ${
        running ? 'text-success' : 'text-text-muted'
      }`}
      title={
        running
          ? `Mock server running on :${status?.port} · ${status?.activeMockCount ?? 0} active`
          : 'Mock server stopped — click to start'
      }
    >
      <Server size={12} />
      <span>{running ? `Mocks :${status?.port}` : 'Mocks off'}</span>
      {running && (status?.activeMockCount ?? 0) > 0 && (
        <span className="rounded bg-success/20 px-1 text-success">
          {status?.activeMockCount}
        </span>
      )}
    </button>
  );
}
