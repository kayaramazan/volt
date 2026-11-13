// Small inline editor for `{{var}}` references — replaces the read-only
// hover tooltip with a one-field popup so users can update a variable's value
// from where it's used (URL, headers, query params, body). Saves to the scope
// the variable was resolved from (globals / env / collection), or to the
// active environment when the variable is unresolved (creates a new entry).

import { useRef, useState } from 'react';
import { Save, X, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

import { Button } from './Button';
import { Input } from './Input';
import {
  useCollections,
  useEnvironments,
  useSetGlobal,
  useUpdateCollection,
  useUpdateEnvironment,
} from '@/hooks/useData';
import {
  useVariables,
  type VarInfo,
  type VarScope,
} from '@/lib/variables-context';
import { isDynamicVariable, resolveDynamicVariable } from '@/lib/variables';
import { cn } from '@/lib/util';

interface Props {
  name: string;
  /** Called when the editor finishes (saved or cancelled). */
  onClose: () => void;
  /** Optional className for the outer card. */
  className?: string;
}

/**
 * Stand-alone editor body. Render this inside any positioning wrapper
 * (Radix Popover content, an absolutely-positioned div over CodeMirror, …).
 * The component handles its own focus, save state, and persistence.
 */
export function VarEditor({ name, onClose, className }: Props) {
  const ctx = useVariables();
  const info = ctx?.vars.get(name);

  // Postman-style dynamic variables ({{$guid}}, {{$timestamp}}, …) are
  // generated per send and can't be edited — show a sample value instead.
  if (!info && isDynamicVariable(name)) {
    return (
      <DynamicVarPreview name={name} onClose={onClose} className={className} />
    );
  }
  return <VarEditorBody name={name} info={info} onClose={onClose} className={className} />;
}

function DynamicVarPreview({ name, onClose, className }: Props) {
  const [sample] = useState(() => resolveDynamicVariable(name) ?? '');
  return (
    <div
      className={cn(
        'flex w-72 flex-col gap-2 rounded-md border border-border bg-bg-elevated p-2 shadow-xl',
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-13 font-semibold text-accent" title={name}>
          {name}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-text-muted hover:bg-bg hover:text-text"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-muted">
        <span>In</span>
        <span className="rounded-sm bg-bg px-1.5 py-0.5 font-semibold text-text">Dynamic</span>
      </div>
      <div className="truncate font-mono text-13 text-text" title={sample}>
        {sample}
      </div>
      <span className="text-[10px] text-text-muted">
        Generated fresh on every send — example value shown.
      </span>
    </div>
  );
}

function VarEditorBody({
  name,
  info,
  onClose,
  className,
}: Props & { info: VarInfo | undefined }) {
  const ctx = useVariables();

  // Decide where to save. If the variable was resolved, write to that scope;
  // otherwise default to the active environment (or globals if no env active).
  const target: { scope: VarScope; scopeId: string | null; scopeName: string } =
    info
      ? { scope: info.scope, scopeId: info.scopeId, scopeName: info.scopeName }
      : ctx?.activeEnvId
        ? { scope: 'env', scopeId: ctx.activeEnvId, scopeName: ctx.activeEnvName ?? 'Environment' }
        : { scope: 'globals', scopeId: null, scopeName: 'Globals' };

  const [value, setValue] = useState(info?.value ?? '');
  // Secret variables start masked (Postman parity); the eye toggles.
  const [reveal, setReveal] = useState(!info?.secret);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSelectedRef = useRef(false);

  const { data: environments } = useEnvironments(ctx?.workspaceId ?? null);
  const { data: collections } = useCollections(ctx?.workspaceId ?? null);
  const setGlobal = useSetGlobal();
  const updateEnv = useUpdateEnvironment();
  const updateCol = useUpdateCollection();

  async function persist() {
    setError(null);
    setIsSaving(true);
    try {
      if (target.scope === 'globals') {
        await setGlobal.mutateAsync({ key: name, value });
      } else if (target.scope === 'env' && target.scopeId) {
        const env = environments?.find((e) => e.id === target.scopeId);
        const current = (env?.variables ?? []) as Array<{ key: string; value: string; secret?: boolean }>;
        const next = upsertVar(current, name, value);
        await updateEnv.mutateAsync({ id: target.scopeId, variables: next });
      } else if (target.scope === 'collection' && target.scopeId) {
        const col = collections?.find((c) => c.id === target.scopeId);
        const current = ((col as { variables?: Array<{ key: string; value: string; secret?: boolean }> })
          ?.variables ?? []) as Array<{ key: string; value: string; secret?: boolean }>;
        const next = upsertVar(current, name, value);
        await updateCol.mutateAsync({ id: target.scopeId, variables: next });
      }
      setSavedFlash(true);
      // Brief checkmark, then close.
      setTimeout(() => onClose(), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSaving(false);
    }
  }

  return (
    <div
      className={cn(
        'flex w-72 flex-col gap-2 rounded-md border border-border bg-bg-elevated p-2 shadow-xl',
        className,
      )}
      // Stop synthetic events from bubbling through the React tree to a
      // portaled-popup's ancestor (the URL input wrapper would otherwise
      // refocus on click and yank focus out of this editor).
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      {/* Header — variable name + scope chip. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-mono text-13 font-semibold text-accent" title={name}>
            {name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-text-muted hover:bg-bg hover:text-text"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-muted">
        <span>{info ? 'In' : 'Save to'}</span>
        <span className="rounded-sm bg-bg px-1.5 py-0.5 font-semibold text-text">
          {target.scopeName}
        </span>
        {!info && <span className="text-text-muted">(new)</span>}
      </div>

      {/* Value input. Select-all on first focus so click-to-replace feels
          snappy; subsequent focuses behave normally. */}
      <Input
        ref={inputRef}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          if (!hasSelectedRef.current) {
            hasSelectedRef.current = true;
            inputRef.current?.select();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            persist();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
          // Don't let the parent input/editor see the keystrokes.
          e.stopPropagation();
        }}
        placeholder="value"
        className="text-13"
      />

      {error && (
        <div className="flex items-start gap-1 text-[11px] text-error">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-text-muted">
          {info?.secret && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="rounded p-0.5 hover:bg-bg hover:text-text"
              title={reveal ? 'Hide value' : 'Reveal secret'}
              aria-label={reveal ? 'Hide value' : 'Reveal secret'}
            >
              {reveal ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
          ⏎ to save · Esc to cancel
        </span>
        <Button
          size="sm"
          onClick={persist}
          disabled={isSaving || savedFlash}
          className="h-6 gap-1 px-2 text-[11px]"
        >
          {savedFlash ? (
            <>
              <CheckCircle2 size={11} /> Saved
            </>
          ) : (
            <>
              <Save size={11} /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function upsertVar(
  list: Array<{ key: string; value: string; secret?: boolean; enabled?: boolean }>,
  key: string,
  value: string,
) {
  // Update the LAST matching row: with duplicate keys the last one wins at
  // resolve time, so that's the one the user sees in {{key}}.
  let idx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.key === key) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return [...list, { key, value }];
  const next = list.slice();
  // Saving from the popup re-enables a row the user had unchecked; otherwise
  // the edit would be invisible in {{key}} substitution.
  next[idx] = { ...next[idx]!, value, enabled: true };
  return next;
}

// Re-export for convenience so callers don't need to import the type from
// the context file separately.
export type { VarInfo };
