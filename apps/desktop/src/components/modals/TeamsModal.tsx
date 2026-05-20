import { useState, type FormEvent } from 'react';
import { Plus, Mail, Check, Copy } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import {
  useAcceptInvite,
  useAuthStatus,
  useCreateTeam,
  useInviteToTeam,
  useTeams,
} from '@/hooks/useData';

type TeamRow = {
  id: string;
  name: string;
  members?: Array<{ userId: string; role: string; user: { email: string; name: string } }>;
  _count?: { members: number };
};

export function TeamsModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'teams';
  const { data: authStatus } = useAuthStatus();
  const loggedIn = authStatus?.loggedIn ?? false;

  const { data: teams } = useTeams(isOpen && loggedIn);
  const create = useCreateTeam();
  const invite = useInviteToTeam();
  const accept = useAcceptInvite();

  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteCode, setInviteCode] = useState<Record<string, string>>({});
  const [acceptCode, setAcceptCode] = useState('');
  const [acceptResult, setAcceptResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newTeamName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ name });
      setNewTeamName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitInvite(teamId: string) {
    setError(null);
    const email = (inviteEmail[teamId] ?? '').trim();
    if (!email) return;
    try {
      const result = (await invite.mutateAsync({ teamId, email })) as { code?: string };
      if (result?.code) {
        setInviteCode((prev) => ({ ...prev, [teamId]: result.code! }));
      }
      setInviteEmail((prev) => ({ ...prev, [teamId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitAccept(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAcceptResult(null);
    const code = acceptCode.trim();
    if (!code) return;
    try {
      await accept.mutateAsync({ code });
      setAcceptResult('Joined team. Refresh to see it below.');
      setAcceptCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!loggedIn) {
    return (
      <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="Teams" className="max-w-md">
        <p className="text-xs text-text-muted">
          Sign in to create or manage teams. Teams are stored on the backend and let you share
          workspaces with collaborators.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="Teams" className="max-w-2xl">
      <div className="space-y-5">
        {error && (
          <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}

        {/* Create */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Create a team
          </h3>
          <form onSubmit={submitCreate} className="flex gap-2">
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name (e.g. Acme Backend)"
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={create.isPending || !newTeamName.trim()}>
              <Plus size={12} />
              Create
            </Button>
          </form>
        </section>

        {/* Existing teams */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Your teams
          </h3>
          {!teams || (teams as TeamRow[]).length === 0 ? (
            <p className="text-xs text-text-muted">You're not part of any team yet.</p>
          ) : (
            <ul className="space-y-2">
              {(teams as TeamRow[]).map((t) => (
                <li key={t.id} className="rounded-md border border-border bg-bg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-13 font-medium text-text">{t.name}</div>
                      <div className="text-[10px] text-text-muted">
                        {(t._count?.members ?? t.members?.length ?? 0)} member
                        {((t._count?.members ?? t.members?.length ?? 0) === 1) ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={inviteEmail[t.id] ?? ''}
                      onChange={(e) =>
                        setInviteEmail((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      type="email"
                      placeholder="Invite by email"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => submitInvite(t.id)}
                      disabled={invite.isPending || !(inviteEmail[t.id] ?? '').trim()}
                    >
                      <Mail size={12} />
                      Invite
                    </Button>
                  </div>

                  {inviteCode[t.id] && (
                    <div className="mt-2 flex items-center gap-2 rounded border border-border bg-bg-elevated px-2 py-1.5 text-[11px]">
                      <span className="text-text-muted">Invite code:</span>
                      <code className="flex-1 font-mono text-text">{inviteCode[t.id]}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(inviteCode[t.id]!)}
                        className="rounded p-1 text-text-muted hover:bg-bg hover:text-text"
                        title="Copy"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Accept invite */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Join a team
          </h3>
          <form onSubmit={submitAccept} className="flex gap-2">
            <Input
              value={acceptCode}
              onChange={(e) => setAcceptCode(e.target.value)}
              placeholder="Paste invite code"
              className="flex-1"
            />
            <Button type="submit" variant="ghost" disabled={accept.isPending || !acceptCode.trim()}>
              <Check size={12} />
              Join
            </Button>
          </form>
          {acceptResult && (
            <p className="mt-2 text-[11px] text-success">{acceptResult}</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}
