import { useEffect, useState, type FormEvent } from 'react';
import { LogOut, Monitor, Trash2, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import {
  useAppInfo,
  useAuthStatus,
  useDeleteWorkspace,
  useRenameWorkspace,
  useSignOut,
  useWorkspaces,
} from '@/hooks/useData';
import { useTheme, type ThemePref } from '@/stores/theme';
import { Select } from '@/components/ui/Select';
import { formatRelativeTime } from '@/lib/util';

interface MeResponse {
  id: string;
  email: string;
  name: string;
  teams: Array<{ id: string; name: string; role: string }>;
  devices: Array<{
    id: string;
    label: string;
    platform: 'macos' | 'windows' | 'linux';
    appVersion: string;
    lastSeenAt: string;
    current: boolean;
  }>;
}

export function SettingsModal() {
  const { current, close, open } = useModals();
  const isOpen = current.kind === 'settings';
  const { data: authStatus } = useAuthStatus();
  const { data: appInfo } = useAppInfo();
  const signOutFn = useSignOut();

  // Only fetch /me when logged in
  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    enabled: isOpen && (authStatus?.loggedIn ?? false),
    queryFn: async () => {
      // Backend /auth/me, called via main process — easier to expose later
      // For now we omit and just show what we have from authStatus
      return {
        id: '',
        email: authStatus?.email ?? '',
        name: authStatus?.name ?? '',
        teams: [],
        devices: [],
      } as MeResponse;
    },
  });

  async function signOut() {
    await signOutFn();
    close();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="Settings" className="max-w-md">
      <div className="space-y-4">
        {authStatus?.loggedIn ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Account
            </h3>
            <div className="rounded-md border border-border bg-bg p-3 text-xs">
              <p className="text-text">{authStatus.name}</p>
              <p className="text-text-muted">{authStatus.email}</p>
            </div>
          </section>
        ) : (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Account
            </h3>
            <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
              Not signed in. Your data is stored only on this computer.
            </div>
          </section>
        )}

        {(me?.devices?.length ?? 0) > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Devices
            </h3>
            <div className="space-y-1">
              {me!.devices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-bg p-2 text-xs"
                >
                  <Monitor size={13} className="text-text-muted" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-text">{d.label}</span>
                      {d.current && (
                        <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">
                          this device
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {d.appVersion} · last seen {formatRelativeTime(d.lastSeenAt)}
                    </p>
                  </div>
                  {!d.current && (
                    <Button size="icon" variant="ghost" title="Revoke">
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Workspace
          </h3>
          <WorkspaceSection open={isOpen} onClose={close} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Appearance
          </h3>
          <ThemePicker />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            About
          </h3>
          <div className="space-y-1 rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
            <p>
              Volt version <span className="text-text">{appInfo?.version ?? '—'}</span>
            </p>
            <p>
              Platform <span className="text-text">{appInfo?.platform ?? '—'}</span>
            </p>
            <p className="break-all">
              Database <span className="font-mono text-[10px] text-text">{appInfo?.dbPath ?? '—'}</span>
            </p>
          </div>
        </section>

        {authStatus?.loggedIn && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                close();
                open({ kind: 'teams' });
              }}
            >
              <Users size={13} />
              Manage teams
            </Button>
            <Button variant="danger" size="md" onClick={signOut}>
              <LogOut size={13} />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Rename / delete the currently selected workspace. Postman exposes this via
 * "Workspace settings"; we keep it inside Settings so the top bar stays lean.
 */
function WorkspaceSection({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspaceId = useSelection((s) => s.workspaceId);
  const { data: workspaces } = useWorkspaces();
  const rename = useRenameWorkspace();
  const remove = useDeleteWorkspace();
  const all = [...(workspaces?.personal ?? []), ...(workspaces?.team ?? [])];
  const current = all.find((w) => w.id === workspaceId) ?? null;
  const [name, setName] = useState('');

  // Re-seed the input whenever the modal opens or the selection changes.
  useEffect(() => {
    if (open) setName(current?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id]);

  if (!current) {
    return (
      <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
        No workspace selected.
      </div>
    );
  }

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== current.name;

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!current || !dirty) return;
    try {
      await rename.mutateAsync({ id: current.id, name: trimmed });
    } catch {
      /* toast raised by the hook */
    }
  }

  async function confirmDelete() {
    if (!current) return;
    const ok = confirm(
      `Delete workspace "${current.name}"?\n\nAll of its collections, requests, environments and history on this device will be removed. This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(current.id);
      onClose();
    } catch {
      /* toast raised by the hook */
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-bg p-3">
      <form onSubmit={submitRename} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-muted">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <Button variant="primary" size="md" type="submit" disabled={!dirty || rename.isPending}>
          Rename
        </Button>
      </form>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-text-muted">
          {current.ownerTeamId ? 'Team workspace' : 'Personal workspace'}
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={confirmDelete}
          disabled={remove.isPending}
          title="Delete this workspace and everything in it"
        >
          <Trash2 size={12} />
          Delete workspace
        </Button>
      </div>
    </div>
  );
}

function ThemePicker() {
  const { pref, setPref } = useTheme();
  return (
    <div className="rounded-md border border-border bg-bg p-3">
      <label className="mb-1 block text-xs text-text-muted">Theme</label>
      <Select
        value={pref}
        onChange={(e) => setPref(e.target.value as ThemePref)}
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        className="w-40"
      />
    </div>
  );
}
