// First-launch welcome screen. Shown when the user isn't signed in, has no
// local workspaces yet, and hasn't already dismissed onboarding. Offers
// three paths:
//
//   • Import — opens the existing ImportModal (Postman / Insomnia /
//     OpenAPI / HAR / cURL auto-detected).
//   • Start fresh — creates a default "My Workspace" + a sample request
//     so the user lands in a working editor immediately.
//   • Sign in / Create account — routes to the existing AuthScreen.
//
// Plus a "Skip and explore" link for users who already know the app and
// just want to poke around. Once any path completes, the `volt:onboarded`
// flag is persisted so the welcome never reappears on this device.

import { useState } from 'react';
import { Zap, FileUp, Sparkles, LogIn, ArrowRight, Loader2 } from 'lucide-react';

import {
  useCreateCollection,
  useCreateRequest,
  useCreateWorkspace,
} from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { cn } from '@/lib/util';

interface Props {
  onImport: () => void;
  onSignIn: () => void;
  onSkip: () => void;
  /** Called after a successful Start Fresh, so the parent can persist the
   *  onboarded flag, switch into the main app, and select the seeded
   *  request automatically. */
  onSeedDone: (createdWorkspaceId: string, createdRequestId: string) => void;
}

export function WelcomePage({ onImport, onSignIn, onSkip, onSeedDone }: Props) {
  const createWorkspace = useCreateWorkspace();
  const createCollection = useCreateCollection();
  const createRequest = useCreateRequest();
  const { setWorkspaceId } = useSelection();

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  async function startFresh() {
    setSeeding(true);
    setSeedError(null);
    try {
      // 1. Local workspace (no team) so the user can start working without
      //    an account.
      const ws = await createWorkspace.mutateAsync({ name: 'My Workspace' });
      // 2. A starter collection. The "Sample requests" name signals it's
      //    safe to delete once the user finds their feet.
      const col = await createCollection.mutateAsync({
        workspaceId: ws.id,
        parentId: null,
        name: 'Sample requests',
      });
      // 3. A self-contained GitHub example. /zen returns a random pithy
      //    quote in plain text — works without auth, no rate-limit pain,
      //    and shows off the body/headers/timing panes immediately.
      const req = await createRequest.mutateAsync({
        workspaceId: ws.id,
        collectionId: col.id,
        name: "GitHub's Zen",
        method: 'GET',
        url: 'https://api.github.com/zen',
      });
      setWorkspaceId(ws.id);
      onSeedDone(ws.id, req.id);
    } catch (e) {
      setSeedError((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg p-8">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <Zap size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-text">Welcome to Volt</h1>
          <p className="mt-1 text-sm text-text-muted">
            A fast, local-first API client. Pick how you'd like to start — it takes seconds either
            way.
          </p>
        </div>

        {/* Three big cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card
            icon={<FileUp size={18} />}
            title="Import"
            description="Bring in Postman, Insomnia, OpenAPI, HAR, or cURL — autodetected."
            cta="Choose a file"
            onClick={onImport}
            disabled={seeding}
          />
          <Card
            icon={seeding ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            title="Start fresh"
            description="Create My Workspace with a sample request you can send right away."
            cta={seeding ? 'Setting up…' : 'Get started'}
            onClick={startFresh}
            disabled={seeding}
            primary
          />
          <Card
            icon={<LogIn size={18} />}
            title="Sign in"
            description="Use your Volt account to sync workspaces across devices and your team."
            cta="Sign in / Create account"
            onClick={onSignIn}
            disabled={seeding}
          />
        </div>

        {seedError && (
          <p className="rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {seedError}
          </p>
        )}

        {/* Skip link */}
        <div className="text-center">
          <button
            type="button"
            onClick={onSkip}
            disabled={seeding}
            className="text-xs text-text-muted hover:text-text disabled:opacity-50"
          >
            Skip and explore on my own →
          </button>
        </div>

        {/* Tiny privacy note — sets expectations for offline-first */}
        <p className="text-center text-[10px] text-text-muted">
          Everything you do here stays on this device until you sign in.
        </p>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  cta,
  onClick,
  disabled,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex flex-col items-start gap-2 rounded-lg border bg-bg-elevated p-4 text-left transition-colors',
        'hover:border-accent/60 hover:bg-bg-elevated/80',
        primary ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md',
          primary ? 'bg-accent/15 text-accent' : 'bg-bg text-text',
        )}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="flex-1 text-xs text-text-muted">{description}</p>
      <div
        className={cn(
          'mt-1 flex items-center gap-1 text-xs font-medium',
          primary ? 'text-accent' : 'text-text group-hover:text-accent',
        )}
      >
        {cta}
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
