import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import { HighlightedInput } from '@/components/ui/HighlightedInput';
import { suggestHeaders } from '@/lib/http-headers';
import { cn } from '@/lib/util';

interface Props {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Convenience: called with the picked value (no event). */
  onPick?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Forwarded to HighlightedInput; KeyValueEditor uses `flat`. */
  flat?: boolean;
}

/**
 * Header-name input with a fuzzy-match dropdown of common HTTP headers.
 * Built on top of HighlightedInput so it keeps the `{{var}}` rendering
 * behaviour for headers that template their own name.
 *
 * Keyboard:
 *   ↓/↑   — move highlight
 *   Enter — pick highlighted suggestion
 *   Esc   — close suggestions (focus stays in the input)
 */
export function HeaderKeyInput({
  value,
  onChange,
  onPick,
  placeholder,
  disabled,
  className,
  flat,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // True once the user moved the highlight with the arrow keys. Enter on an
  // untouched, empty input must not silently insert the first common header.
  const navigatedRef = useRef(false);

  const suggestions = useMemo(() => (open ? suggestHeaders(value, 8) : []), [open, value]);

  useEffect(() => {
    setActive(0);
    navigatedRef.current = false;
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(name: string) {
    if (onPick) onPick(name);
    else {
      // Fall back to firing a synthetic change so the caller stays in control
      // via onChange — matches the HighlightedInput contract.
      const evt = {
        target: { value: name },
        currentTarget: { value: name },
      } as unknown as ChangeEvent<HTMLInputElement>;
      onChange(evt);
    }
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigatedRef.current = true;
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigatedRef.current = true;
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (!value.trim() && !navigatedRef.current) return;
      e.preventDefault();
      const choice = suggestions[active];
      if (choice) pick(choice);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <HighlightedInput
        ref={inputRef}
        flat={flat}
        value={value}
        onChange={(e) => {
          onChange(e);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {open && suggestions.length > 0 && (
        <ul
          // Dropdown is absolutely positioned just below the input. We use a
          // higher z than the row hover-bg so it doesn't get clipped.
          className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-56 overflow-auto rounded-md border border-border bg-bg-elevated text-xs shadow-lg"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                // mousedown not click — `click` would happen after the input
                // blur dismisses the dropdown.
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'cursor-pointer px-2 py-1 font-mono text-text',
                i === active && 'bg-accent/15 text-accent',
              )}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
