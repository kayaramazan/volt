import { useEffect, useMemo, useState } from 'react';
import { Globe, Plus, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { KeyValueEditor, type KeyValueRow } from '@/components/request/KeyValueEditor';
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

export function EditEnvironmentModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'edit-environment';
  const requestedId = current.kind === 'edit-environment' ? current.environmentId : null;

  const { workspaceId } = useSelection();
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
  const [variables, setVariables] = useState<KeyValueRow[]>([]);

  const isGlobals = selectedId === GLOBALS_TAB;
  const selected = useMemo(
    () => (isGlobals ? null : environments?.find((e) => e.id === selectedId) ?? null),
    [environments, selectedId, isGlobals],
  );

  // Auto-select first env on open when nothing was requested
  useEffect(() => {
    if (!isOpen) return;
    if (requestedId !== null) {
      setSelectedId(requestedId);
      return;
    }
    const first = environments?.[0];
    if (first) {
      setSelectedId(first.id);
    } else {
      setSelectedId(GLOBALS_TAB);
    }
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
        })),
      );
    } else if (selected) {
      setName(selected.name);
      setVariables(
        (selected.variables as Array<{ key: string; value: string }>).map((v) => ({
          id: rowId('var'),
          key: v.key,
          value: v.value,
          enabled: true,
        })),
      );
    } else {
      setName('');
      setVariables([]);
    }
  }, [selected, isGlobals, globals]);

  async function save() {
    if (isGlobals) {
      // Diff the current rows against the live globals: upsert all + delete
      // anything no longer present.
      const live = globals ?? {};
      const keptKeys = new Set<string>();
      for (const v of variables) {
        if (!v.key) continue;
        keptKeys.add(v.key);
        // Re-parse JSON if it looks like JSON, otherwise store as string —
        // mirrors the GlobalsModal behaviour.
        let value: unknown = v.value;
        try {
          value = JSON.parse(v.value);
        } catch {
          /* string */
        }
        await setG.mutateAsync({ key: v.key, value });
      }
      for (const k of Object.keys(live)) {
        if (!keptKeys.has(k)) await delG.mutateAsync(k);
      }
      return;
    }

    if (!workspaceId) return;
    const cleanedVars = variables
      .filter((v) => v.key)
      .map((v) => ({ key: v.key, value: v.value, secretRef: null }));

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
              <KeyValueEditor
                rows={variables}
                onChange={setVariables}
                keyPlaceholder="Variable name"
                valuePlaceholder="Value"
              />
            </div>
            <p className="mt-1 text-[10px] text-text-muted">
              {isGlobals
                ? 'Globals are read by scripts via volt.globals.get(key) and resolved as the lowest-priority layer in {{name}} substitution.'
                : 'Reference variables in your requests as {{name}}.'}
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
