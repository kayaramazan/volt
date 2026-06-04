import { useEffect, useState } from 'react';
import { ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { HeaderKeyInput } from '@/components/ui/HeaderKeyInput';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { useAutoHeaders, useSetAutoHeaders, type AutoHeader } from '@/hooks/useData';
import { cn } from '@/lib/util';

/**
 * Default headers attached to every outgoing request unless the request
 * already defines the same header (case-insensitive). Rendered with the same
 * row layout as KeyValueEditor so it sits naturally above per-request headers.
 * Static values pass through verbatim; `<auto>` is computed by the engine
 * (Host from URL, Volt-Token = UUID).
 */
export function AutoHeadersEditor() {
  const { data } = useAutoHeaders();
  const setAll = useSetAutoHeaders();
  const [draft, setDraft] = useState<AutoHeader[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  function patch(i: number, p: Partial<AutoHeader>) {
    const next = draft.slice();
    const cur = next[i];
    if (!cur) return;
    next[i] = { ...cur, ...p };
    setDraft(next);
    void setAll.mutateAsync(next);
  }
  function remove(i: number) {
    const next = draft.filter((_, j) => j !== i);
    setDraft(next);
    void setAll.mutateAsync(next);
  }
  function add() {
    setDraft([...draft, { key: '', value: '', enabled: true } as AutoHeader]);
  }

  const enabledCount = draft.filter((h) => h.enabled && h.key).length;

  return (
    <div className="border-b border-border/60 bg-bg-elevated/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-text-muted hover:bg-bg-elevated/50"
      >
        <ChevronRight
          size={11}
          className={cn('transition-transform', open && 'rotate-90')}
        />
        <span className="text-text">Default headers</span>
        <span className="text-text-muted">
          ({enabledCount} sent on every request unless overridden below)
        </span>
      </button>

      {open && (
        <div className="flex flex-col">
          {draft.map((h, i) => (
            <div
              key={i}
              className="group flex items-center gap-1 border-t border-border/40 px-1 py-0.5"
            >
              <GripVertical size={11} className="text-text-muted opacity-0" />
              <input
                type="checkbox"
                checked={h.enabled}
                onChange={(e) => patch(i, { enabled: e.target.checked })}
                className="h-3 w-3 accent-accent"
                title={h.description}
              />
              <HeaderKeyInput
                flat
                value={h.key}
                onChange={(e) => patch(i, { key: e.target.value })}
                placeholder="Header"
                className="flex-1"
                disabled={h.builtin}
              />
              <HighlightedInput
                flat
                value={h.value}
                onChange={(e) => patch(i, { value: e.target.value })}
                placeholder="Value"
                className="flex-1"
              />
              {!h.builtin ? (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-text-muted opacity-0 hover:bg-bg hover:text-error group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 size={11} />
                </button>
              ) : (
                <span className="w-5" />
              )}
            </div>
          ))}
          <div className="border-t border-border/40 px-1 py-1">
            <Button size="sm" variant="ghost" onClick={add}>
              <Plus size={11} />
              Add default header
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
