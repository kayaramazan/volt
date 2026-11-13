import { Trash2, GripVertical } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { HeaderKeyInput } from '@/components/ui/HeaderKeyInput';
import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { cn, rowId } from '@/lib/util';

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled?: boolean;
  description?: string;
  /** form-data only: file rows carry an absolute path in `value`. */
  kind?: 'text' | 'file';
}

type RowPatch = (patch: Partial<KeyValueRow>) => void;

interface Props {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** Disable adding/removing rows. */
  readOnly?: boolean;
  /** When set, the key column autocompletes from common HTTP headers. */
  suggest?: 'headers';
  /** Replace the value cell for a row (return null to keep the default input). */
  renderValue?: (row: KeyValueRow, patch: RowPatch) => ReactNode | null;
  /** Extra per-row controls rendered between the value cell and the delete button. */
  renderRowExtra?: (row: KeyValueRow, patch: RowPatch) => ReactNode;
}

/**
 * Two-column editable table for headers / query params / urlencoded body.
 * Always has one empty row at the bottom for adding new entries — typing
 * into it appends a new empty row automatically.
 */
export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  readOnly = false,
  suggest,
  renderValue,
  renderRowExtra,
}: Props) {
  const KeyComponent = suggest === 'headers' ? HeaderKeyInput : HighlightedInput;
  // Ensure there's always a trailing empty row to type into.
  const [internalRows, setInternalRows] = useState<KeyValueRow[]>(() => withEmptyTail(rows));

  // Sync prop changes (e.g. from external load)
  useEffect(() => {
    setInternalRows(withEmptyTail(rows));
  }, [rows]);

  function setRows(next: KeyValueRow[]) {
    const cleaned = withEmptyTail(next);
    setInternalRows(cleaned);
    // Strip the trailing empty row from the value emitted
    onChange(stripEmptyTail(cleaned));
  }

  function patch(id: string, patch: Partial<KeyValueRow>) {
    setRows(internalRows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function remove(id: string) {
    setRows(internalRows.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col">
      {internalRows.map((row, i) => {
        const isLast = i === internalRows.length - 1;
        const isEmpty = !row.key && !row.value;
        const rowPatch: RowPatch = (p) => patch(row.id, p);
        const customValue = renderValue ? renderValue(row, rowPatch) : null;
        return (
          <div
            key={row.id}
            className={cn(
              'flex items-center gap-1 border-b border-border/40 px-1 py-0.5',
            )}
          >
            <GripVertical size={11} className="text-text-muted opacity-0" />
            <input
              type="checkbox"
              checked={row.enabled !== false}
              onChange={(e) => patch(row.id, { enabled: e.target.checked })}
              disabled={readOnly || isEmpty}
              className="h-3 w-3 accent-accent disabled:opacity-30"
            />
            <KeyComponent
              flat
              value={row.key}
              onChange={(e) => patch(row.id, { key: e.target.value })}
              placeholder={keyPlaceholder}
              className="flex-1"
              disabled={readOnly}
            />
            {customValue ?? (
              <HighlightedInput
                flat
                value={row.value}
                onChange={(e) => patch(row.id, { value: e.target.value })}
                placeholder={valuePlaceholder}
                className="flex-1"
                disabled={readOnly}
              />
            )}
            {renderRowExtra?.(row, rowPatch)}
            <button
              type="button"
              onClick={() => remove(row.id)}
              disabled={isLast || readOnly}
              className="rounded p-1 text-text-muted opacity-0 hover:bg-bg hover:text-error disabled:opacity-0"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function withEmptyTail(rows: KeyValueRow[]): KeyValueRow[] {
  const last = rows[rows.length - 1];
  if (!last || last.key || last.value) {
    return [...rows, { id: rowId('kv'), key: '', value: '', enabled: true }];
  }
  return rows;
}

function stripEmptyTail(rows: KeyValueRow[]): KeyValueRow[] {
  if (rows.length === 0) return rows;
  const last = rows[rows.length - 1];
  if (last && !last.key && !last.value) {
    return rows.slice(0, -1);
  }
  return rows;
}
