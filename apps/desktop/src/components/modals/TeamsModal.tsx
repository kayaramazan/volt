import { useState, type FormEvent } from 'react';
import { Plus, Mail, Check, Copy, CreditCard, ExternalLink, History, Loader2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import {
  useAcceptInvite,
  useAuthStatus,
  useCreateTeam,
  useInviteToTeam,
  useOpenBillingPortal,
  useStartBillingCheckout,
  useTeamAuditLog,
  useTeamBilling,
  useTeams,
} from '@/hooks/useData';
import { cn } from '@/lib/util';

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
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="Teams" className="max-w-3xl">
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

                  {/* Billing + audit are owner-visible details for the team. */}
                  <TeamBillingPanel teamId={t.id} />
                  <TeamAuditLogPanel teamId={t.id} />
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

interface BillingStatus {
  plan: 'FREE' | 'PRO';
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  configured: boolean;
  usage?: {
    members: number;
    pendingInvites: number;
    maxMembers: number;
    workspaces: number;
    maxWorkspaces: number;
  };
}

function TeamBillingPanel({ teamId }: { teamId: string }) {
  const { data: status, isLoading } = useTeamBilling(teamId);
  const startCheckout = useStartBillingCheckout();
  const openPortal = useOpenBillingPortal();
  const [error, setError] = useState<string | null>(null);

  // Always render the shell so the team card height doesn't jump when the
  // billing query resolves a moment after the team list itself.
  if (isLoading || !status) {
    return (
      <div className="mt-3 rounded border border-border bg-bg-elevated p-2 text-[11px] text-text-muted">
        <div className="flex items-center gap-2">
          <Loader2 size={11} className="animate-spin" />
          Loading billing…
        </div>
      </div>
    );
  }
  const b = status as BillingStatus;
  const isPro = b.plan === 'PRO';

  return (
    <div className="mt-3 rounded border border-border bg-bg-elevated p-2">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <CreditCard size={11} />
        Billing
      </div>
      {!b.configured ? (
        <p className="text-[11px] text-text-muted">
          Billing isn’t enabled on this server (Stripe keys aren’t configured).
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
                isPro ? 'bg-accent/20 text-accent' : 'bg-bg text-text-muted',
              )}
            >
              {b.plan}
            </span>
            <span className="text-text-muted">
              {b.status.toLowerCase().replace('_', ' ')}
            </span>
            {b.currentPeriodEnd && (
              <span className="text-text-muted">
                {b.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {new Date(b.currentPeriodEnd).toLocaleDateString()}
              </span>
            )}
          </div>
          {b.usage && (
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <UsageIndicator
                label="Members"
                used={b.usage.members + b.usage.pendingInvites}
                limit={b.usage.maxMembers}
                tooltip={`${b.usage.members} joined · ${b.usage.pendingInvites} pending invite${b.usage.pendingInvites === 1 ? '' : 's'}`}
              />
              <UsageIndicator
                label="Workspaces"
                used={b.usage.workspaces}
                limit={b.usage.maxWorkspaces}
              />
            </div>
          )}
          {error && (
            <p className="rounded border border-error/30 bg-error/10 px-2 py-1 text-[11px] text-error">{error}</p>
          )}
          <div className="flex items-center gap-2">
            {!isPro && (
              <Button
                size="sm"
                variant="primary"
                disabled={startCheckout.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await startCheckout.mutateAsync({ teamId });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {startCheckout.isPending ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
                Upgrade to Pro
              </Button>
            )}
            {isPro && (
              <Button
                size="sm"
                variant="ghost"
                disabled={openPortal.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await openPortal.mutateAsync({ teamId });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <ExternalLink size={11} />
                Manage billing
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  actor: { id: string; name: string; email: string } | null;
}

function TeamAuditLogPanel({ teamId }: { teamId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useTeamAuditLog(expanded ? teamId : null);

  return (
    <div className="mt-2 rounded border border-border bg-bg-elevated">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted hover:bg-bg"
      >
        <History size={11} />
        Audit log
        <span className="ml-auto text-[10px] text-text-muted">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="border-t border-border p-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <Loader2 size={11} className="animate-spin" /> Loading…
            </div>
          )}
          {error && (
            <p className="text-[11px] text-error">{(error as Error).message}</p>
          )}
          {data && (
            <AuditList entries={(data as { entries: AuditEntry[] }).entries} />
          )}
        </div>
      )}
    </div>
  );
}

function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (!entries || entries.length === 0) {
    return <p className="text-[11px] text-text-muted">No activity yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((e) => (
        <li key={e.id} className="grid grid-cols-[6rem_1fr_auto] gap-2 text-[11px]">
          <span className="font-mono text-text-muted">{new Date(e.createdAt).toLocaleString()}</span>
          <span className="text-text">
            <span className="mr-1 font-mono text-[10px] uppercase text-accent">{e.action}</span>
            {e.actor ? (
              <span className="text-text-muted">by {e.actor.name}</span>
            ) : (
              <span className="text-text-muted">by Stripe</span>
            )}
            {renderMetadata(e.metadata)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UsageIndicator({
  label,
  used,
  limit,
  tooltip,
}: {
  label: string;
  used: number;
  limit: number;
  tooltip?: string;
}) {
  const atLimit = used >= limit;
  const nearLimit = !atLimit && used >= limit - 1;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono',
        atLimit ? 'bg-error/15 text-error' : nearLimit ? 'bg-warning/15 text-warning' : 'bg-bg text-text-muted',
      )}
      title={tooltip}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-text">{used}/{limit}</span>
    </span>
  );
}

function renderMetadata(meta?: Record<string, unknown>): string {
  if (!meta) return '';
  // Skip empty objects and noisy session ids.
  const keys = Object.keys(meta).filter((k) => k !== 'sessionId' && k !== 'subscriptionId');
  if (keys.length === 0) return '';
  const parts = keys.map((k) => {
    const v = meta[k];
    return `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`;
  });
  return ` · ${parts.join(', ')}`;
}
