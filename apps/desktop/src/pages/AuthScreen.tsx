import { useState, type FormEvent } from 'react';
import { Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { voltApi } from '@/lib/volt-api';

interface Props {
  /** Called when the user chooses "Continue offline" — sets a flag that suppresses re-prompt. */
  onSkip: () => void;
}

type Mode = 'login' | 'register';

/**
 * Pre-app gate. Shown when no session is restored AND user hasn't opted out.
 * Offering "Continue offline" is critical to the local-first promise — never
 * block the user from working just because backend is unreachable.
 */
export function AuthScreen({ onSkip }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result =
        mode === 'login'
          ? await voltApi['auth:login']({ email, password })
          : await voltApi['auth:register']({ email, name, password });

      if (!result.success) {
        setError(result.errorMessage ?? 'Something went wrong. Please try again.');
        return;
      }
      // Refresh auth status — App will re-render
      qc.invalidateQueries({ queryKey: ['auth-status'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-accent" />
          <h1 className="text-xl font-semibold text-text">Volt</h1>
          <p className="mt-1 text-13 text-text-muted">Fast, local-first API client</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="name">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete={mode === 'login' ? 'username' : 'email'}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting
              ? mode === 'login'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="block w-full text-center text-xs text-text-muted hover:text-text"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </form>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="text-xs text-text-muted">
            Just trying things out?
            <br />
            All your data stays on your machine.
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Continue offline →
          </button>
        </div>
      </div>
    </div>
  );
}
