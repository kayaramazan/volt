import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Globe, Plus, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { useModals } from '@/stores/modals';
import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useDeleteGlobal,
  useEnvironments,
  useGlobals,
  useSetGlobal,
  useUpdateEnvironment,
} from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { cn, rowId } from '@/lib/util';

const GLOBALS_TAB = '__globals__';

interface VarRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret: boolean;
}

/**
 * Parse a globals value the way scripts expect (numbers / booleans / objects)
 * but only when the text round-trips exactly — otherwise keep the raw string.
 * Prevents `1e5` → 100000, `007` → 7, big ids losing precision, `null`
 * vanishing from the variable map, etc.
 */
function parseGlobalValue(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null) return raw;
    if (JSON.stringify(parsed) === raw.trim()) return parsed;
  } catch {
    /* string */
  }
  return raw;
}

export function EditEnvironmentModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'edit-environment';
  const requestedId = current.kind === 'edit-environment' ? current.environmentId : null;

  const { workspaceId } = useSelection();
  const qc = useQueryClient();
  const { data: environments } = useEnvironments(workspaceId);
  const { data: globals } = useGlobals();
  const create = useCreateEnvironment();
  const update = useUpdateEnvironment();
  const del = useDeleteEnvironment();
  const setG = useSetGlobal();
  const delG = useDeleteGlobal();

  // selectedId: env uuid | GLOBALS_TAB | null (new-env form)
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [name, setName] = useState('');
  const [variables, setVariables] = useState<VarRow[]>([]);

  const isGlobals = selectedId === GLOBALS_TAB;
  const selected = useMemo(
    () => (isGlobals ? null : environments?.find((e) => e.id === selectedId) ?? null),
    [environments, selectedId, isGlobals],
  );

  // Auto-select on open: the requested env, else the first env, else Globals.
  // Only once per open — the environments list refetches after every save /
  // sync tick, and re-running this would bounce the user back to the first
  // environment mid-edit.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      autoSelectedRef.current = false;
      return;
    }
    if (autoSelectedRef.current) return;
    if (requestedId !== null) {
      autoSelectedRef.current = true;
      setSelectedId(requestedId);
      return;
    }
    if (environments === undefined) return; // still loading
    autoSelectedRef.current = true;
    setSelectedId(environments[0]?.id ?? GLOBALS_TAB);
  }, [isOpen, requestedId, environments]);

  // Sync form when the selected env / globals tab changes
  useEffect(() => {
    if (isGlobals) {
      setName('Globals');
      setVariables(
        Object.entries(globals ?? {}).map(([k, v]) => ({
          id: rowId('var'),
          key: k,
          value: typeof v === 'string' ? v : JSON.stringify(v),
          enabled: true,
          secret: false,
        })),
      );
    } else if (selected) {
      setName(selected.name);
      setVariables(
        (
          selected.variables as Array<{
            key: string;
            value: string;
            enabled?: boolean;
            secret?: boolean;
          }>
        ).map((v) => ({
          id: rowId('var'),
          key: v.key,
          value: v.value,
          enabled: v.enabled !== false,
          secret: v.secret === true,
        })),
      );
    } else {
      setName('');
      setVariables([]);
    }
  }, [selected, isGlobals, globals]);

  // Duplicate keys: the last row wins at resolve time, warn so it's not silent.
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const v of variables) {
      const k = v.key.trim();
      if (!k) continue;
      if (seen.has(k)) dups.add(k);
      seen.add(k);
    }
    return Array.from(dups);
  }, [variables]);

  async function save() {
    if (isGlobals) {
      // Diff the current rows against the live globals: upsert all + delete
      // anything no longer present. Globals have no enabled flag — an
      // unchecked row is simply not saved.
      const live = globals ?? {};
      const keptKeys = new Set<string>();
      for (const v of variables) {
        const key = v.key.trim();
        if (!key || !v.enabled) continue;
        keptKeys.add(key);
        await setG.mutateAsync({ key, value: parseGlobalValue(v.value) });
      }
      for (const k of Object.keys(live)) {
        if (!keptKeys.has(k)) await delG.mutateAsync(k);
      }
      return;
    }

    if (!workspaceId) return;
    const cleanedVars = variables
      .filter((v) => v.key.trim())
      .map((v) => ({
        key: v.key.trim(),
        value: v.value,
        secretRef: null,
        enabled: v.enabled,
        secret: v.secret,
      }));

    if (selected) {
      await update.mutateAsync({
        id: selected.id,
        name: name.trim() || selected.name,
        variables: cleanedVars,
      });
    } else {
      const trimmed = name.trim();
      if (!trimmed) return;
      const created = (await create.mutateAsync({ workspaceId, name: trimmed })) as
        | { id: string }
        | undefined;
      if (created?.id && cleanedVars.length > 0) {
        await update.mutateAsync({ id: created.id, variables: cleanedVars });
      }
      if (created?.id) setSelectedId(created.id);
    }
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete environment "${selected.name}"?`)) return;
    await del.mutateAsync(selected.id);
    // Main process clears the active pointer if this env was active; refetch
    // so the TopBar dropdown and {{var}} resolution drop it immediately.
    qc.invalidateQueries({ queryKey: ['active-env', workspaceId] });
    setSelectedId(null);
  }

  function newEnvironment() {
    setSelectedId(null);
    setName('');
    setVariables([]);
  }

  const saving = create.isPending || update.isPending || setG.isPending || delG.isPending;
  const globalsCount = Object.keys(globals ?? {}).length;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Environments"
      className="max-w-3xl"
    >
      <div className="flex h-[28rem] gap-3">
        {/* Sidebar */}
        <div className="flex w-44 flex-col border-r border-border pr-2">
          <div className="flex-1 overflow-auto">
            {/* Globals — pinned first so users find them next to envs */}
            <button
              type="button"
              onClick={() => setSelectedId(GLOBALS_TAB)}
              className={cn(
                'flex w-full items-center gap-1.5 truncate rounded px-2 py-1 text-left text-xs',
                isGlobals
                  ? 'bg-bg-elevated text-text'
                  : 'text-text-muted hover:bg-bg-elevated/60',
              )}
              title="Globals (per-device, settable from scripts)"
            >
              <Globe size={11} />
              Globals
              {globalsCount > 0 && (
                <span className="ml-auto text-[10px] text-text-muted">{globalsCount}</span>
              )}
            </button>

            <div className="my-1 border-t border-border" />

            {(environments ?? []).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={cn(
                  'block w-full truncate rounded px-2 py-1 text-left text-xs',
                  selectedId === e.id
                    ? 'bg-bg-elevated text-text'
                    : 'text-text-muted hover:bg-bg-elevated/60',
                )}
                title={e.name}
              >
                {e.name}
              </button>
            ))}
            {(environments ?? []).length === 0 && (
              <p className="px-2 py-1 text-xs text-text-muted">No environments yet.</p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={newEnvironment} className="mt-2 justify-start">
            <Plus size={12} />
            New environment
          </Button>
        </div>

        {/* Right: edit form */}
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              {isGlobals ? 'Scope' : selected ? 'Name' : 'New environment name'}
            </label>
            {isGlobals ? (
              <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-bg-elevated px-2.5 text-13 text-text">
                <Globe size={12} className="text-text-muted" />
                Globals — per-device, lowest-priority variable layer
              </div>
            ) : (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production"
                autoFocus={!selected}
              />
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <label className="mb-1 block text-xs text-text-muted">Variables</label>
            <div className="flex-1 overflow-auto rounded border border-border">
              <VariableTable
                rows={variables}
                onChange={setVariables}
                allowSecret={!isGlobals}
              />
            </div>
            {duplicateKeys.length > 0 && (
              <p className="mt-1 text-[10px] text-warning">
                Duplicate variable name{duplicateKeys.length > 1 ? 's' : ''}:{' '}
                {duplicateKeys.join(', ')} — the last row wins.
              </p>
            )}
            <p className="mt-1 text-[10px] text-text-muted">
              {isGlobals
                ? 'Globals are read by scripts via volt.globals.get(key) and resolved as the lowest-priority layer in {{name}} substitution.'
                : 'Reference variables in your requests as {{name}}. Environment values override collection and global values.'}
            </p>
          </div>

          <div className="flex justify-between border-t border-border pt-3">
            {selected ? (
              <Button variant="danger" onClick={remove}>
                <Trash2 size={12} />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={save}
                disabled={saving || (!isGlobals && !selected && !name.trim())}
              >
                {isGlobals ? 'Save globals' : selected ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Variable table — like KeyValueEditor but with a per-row "secret" toggle
// (masks the value, Postman's secret type) and a stable enabled checkbox.
// Always keeps one empty trailing row to type into.
// ─────────────────────────────────────────────────────────

function emptyRow(): VarRow {
  return { id: rowId('var'), key: '', value: '', enabled: true, secret: false };
}

function withEmptyTail(rows: VarRow[]): VarRow[] {
  const last = rows[rows.length - 1];
  if (!last || last.key || last.value) return [...rows, emptyRow()];
  return rows;
}

function stripEmptyTail(rows: VarRow[]): VarRow[] {
  const last = rows[rows.length - 1];
  if (last && !last.key && !last.value) return rows.slice(0, -1);
  return rows;
}

function VariableTable({
  rows,
  onChange,
  allowSecret,
}: {
  rows: VarRow[];
  onChange: (rows: VarRow[]) => void;
  allowSecret: boolean;
}) {
  const [internal, setInternal] = useState<VarRow[]>(() => withEmptyTail(rows));
  // Per-row "reveal" state for secrets (not persisted).
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setInternal(withEmptyTail(rows));
  }, [rows]);

  function setRows(next: VarRow[]) {
    const cleaned = withEmptyTail(next);
    setInternal(cleaned);
    onChange(stripEmptyTail(cleaned));
  }
  function patch(id: string, p: Partial<VarRow>) {
    setRows(internal.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  function remove(id: string) {
    setRows(internal.filter((r) => r.id !== id));
  }
  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col">
      {internal.map((row, i) => {
        const isLast = i === internal.length - 1;
        const isEmpty = !row.key && !row.value;
        const masked = row.secret && !revealed.has(row.id);
        return (
          <div
            key={row.id}
            className={cn(
              'group flex items-center gap-1 border-b border-border/40 px-1 py-0.5',
              !row.enabled && !isEmpty && 'opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => patch(row.id, { enabled: e.target.checked })}
              disabled={isEmpty}
              title={row.enabled ? 'Enabled — click to skip during resolution' : 'Disabled'}
              className="h-3 w-3 accent-accent disabled:opacity-30"
            />
            <HighlightedInput
              flat
              varPopup={false}
              value={row.key}
              onChange={(e) => patch(row.id, { key: e.target.value })}
              placeholder="Variable name"
              className="flex-1"
            />
            {masked ? (
              <input
                type="password"
                value={row.value}
                onChange={(e) => patch(row.id, { value: e.target.value })}
                placeholder="Value"
                autoComplete="off"
                className="h-7 flex-1 rounded-sm bg-transparent px-[10px] font-mono text-13 text-text focus:bg-bg-elevated focus:outline-none"
              />
            ) : (
              <HighlightedInput
                flat
                varPopup={false}
                value={row.value}
                onChange={(e) => patch(row.id, { value: e.target.value })}
                placeholder="Value"
                className="flex-1"
              />
            )}
            {allowSecret && (
              <>
                <button
                  type="button"
                  onClick={() => patch(row.id, { secret: !row.secret })}
                  disabled={isEmpty}
                  title={row.secret ? 'Secret — click to make default' : 'Default — click to mark secret'}
                  className={cn(
                    'rounded px-1 py-0.5 text-[10px] uppercase tracking-wide disabled:opacity-0',
                    row.secret ? 'bg-warning/15 text-warning' : 'text-text-muted hover:bg-bg hover:text-text',
                  )}
                >
                  {row.secret ? 'secret' : 'default'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleReveal(row.id)}
                  disabled={!row.secret}
                  title={masked ? 'Reveal value' : 'Hide value'}
                  aria-label={masked ? 'Reveal value' : 'Hide value'}
                  className="rounded p-1 text-text-muted hover:bg-bg hover:text-text disabled:opacity-0"
                >
                  {masked ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => remove(row.id)}
              disabled={isLast}
              title="Remove"
              className="rounded p-1 text-text-muted opacity-0 hover:bg-bg hover:text-error group-hover:opacity-100 disabled:opacity-0"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
