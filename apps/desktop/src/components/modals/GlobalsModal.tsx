import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDeleteGlobal, useGlobals, useSetGlobal } from '@/hooks/useData';
import { useModals } from '@/stores/modals';

/**
 * Inspect, set, and delete the per-device "globals" key/value store. Globals
 * are settable from pre/post-request scripts via `volt.globals.set(key, val)`
 * and are read by `{{name}}` substitution (as the lowest-priority layer).
 */
export function GlobalsModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'globals';

  const { data: globals } = useGlobals();
  const setG = useSetGlobal();
  const delG = useDeleteGlobal();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    const key = newKey.trim();
    if (!key) return;
    // Try JSON-parse first so users can enter numbers, booleans, objects. Falls
    // back to plain string. (Scripts can `.get` and use any of those.)
    let value: unknown = newValue;
    try {
      value = JSON.parse(newValue);
    } catch {
      /* leave as string */
    }
    await setG.mutateAsync({ key, value });
    setNewKey('');
    setNewValue('');
  }

  const entries = Object.entries(globals ?? {});

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()} title="Globals" className="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-text-muted">
          Per-device key/value store. Read with{' '}
          <code className="font-mono text-text">{'{{name}}'}</code> in URLs / headers / body, or
          via <code className="font-mono text-text">volt.globals.get(key)</code> in scripts.
        </p>

        {/* List */}
        <div className="rounded-md border border-border">
          {entries.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text-muted">
              No globals set. Add one below or set one from a post-response script.
            </p>
          ) : (
            <ul>
              {entries.map(([key, value]) => (
                <li
                  key={key}
                  className="group flex items-center gap-2 border-b border-border/40 px-2 py-1.5 last:border-b-0"
                >
                  <span className="w-32 truncate font-mono text-xs text-text">{key}</span>
                  <span className="flex-1 truncate font-mono text-xs text-text-muted">
                    {formatValue(value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => delG.mutate(key)}
                    className="rounded p-1 text-text-muted opacity-0 hover:bg-bg hover:text-error group-hover:opacity-100"
                    title={`Delete ${key}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* New */}
        <form onSubmit={submitNew} className="flex gap-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key (e.g. authToken)"
            className="w-40"
          />
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value (JSON or string)"
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={setG.isPending || !newKey.trim()}>
            <Plus size={12} />
            Set
          </Button>
        </form>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
