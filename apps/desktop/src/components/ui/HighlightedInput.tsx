import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/util';
import { splitByVars, VAR_REGEX } from '@/lib/var-highlight';
import { useIsVarResolved } from '@/lib/variables-context';
import { VarEditor } from './VarEditor';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {
  value: string;
  invalid?: boolean;
  /** Borderless transparent variant — fits inside a KeyValueEditor row. */
  flat?: boolean;
  /**
   * Show the hover VarEditor popup on `{{var}}` tokens (default true). Turn
   * off inside the environment editor itself, where a "save to Globals"
   * popup over a value you're already editing makes no sense.
   */
  varPopup?: boolean;
};

// Force-identical text metrics on both the visible overlay and the transparent
// <input>. The font shorthand sets font-style/weight/size/line-height/family in
// one go, and the other properties suppress anything that could shift glyph
// widths (ligatures, letter-spacing, etc.). Without this, Chromium gives <input>
// slightly different metrics than a sibling <div> and the caret drifts off the
// rendered text.
const SHARED_STYLE: CSSProperties = {
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  textIndent: 0,
  fontVariantLigatures: 'none',
  fontVariantNumeric: 'normal',
  fontFeatureSettings: 'normal',
  paddingLeft: 10,
  paddingRight: 10,
};

const FONT_NORMAL = "normal 13px/2rem 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const FONT_FLAT = "normal 13px/1.75rem 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

interface VarPopup {
  name: string;
  x: number;
  y: number;
}

export const HighlightedInput = forwardRef<HTMLInputElement, Props>(function HighlightedInput(
  { value, onChange, onScroll, className, invalid, flat, disabled, varPopup = true, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Keep overlay's horizontal scroll synced with the native input.
  useEffect(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (!input || !overlay) return;
    const sync = () => {
      overlay.scrollLeft = input.scrollLeft;
    };
    sync();
    input.addEventListener('scroll', sync);
    return () => input.removeEventListener('scroll', sync);
  }, [value]);

  // ── Hover-triggered VarEditor popup ────────────────────────────────────
  const [popup, setPopup] = useState<VarPopup | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const popupHasFocusRef = useRef(false);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(
    (ms = 180) => {
      cancelClose();
      closeTimerRef.current = window.setTimeout(() => {
        if (!popupHasFocusRef.current) setPopup(null);
      }, ms);
    },
    [cancelClose],
  );

  // Cleanup on unmount.
  useEffect(() => () => cancelClose(), [cancelClose]);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const overlay = overlayRef.current;
      if (!overlay || !varPopup) return;
      const spans = overlay.querySelectorAll<HTMLElement>('[data-var-span="1"]');
      for (const span of spans) {
        const rect = span.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const name = span.dataset.varName ?? '';
          if (!name) return;
          cancelClose();
          // Only update state if we moved to a different var or none was open.
          if (popup?.name !== name) {
            setPopup({ name, x: rect.left, y: rect.bottom + 4 });
          }
          return;
        }
      }
      // Not over any var span — schedule close (grace period lets user
      // travel to the popup itself without it disappearing).
      if (popup) scheduleClose();
    },
    [popup, cancelClose, scheduleClose, varPopup],
  );

  const parts = splitByVars(value);
  const textStyle: CSSProperties = {
    ...SHARED_STYLE,
    font: flat ? FONT_FLAT : FONT_NORMAL,
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => popup && scheduleClose()}
      className={cn(
        'relative isolate cursor-text',
        flat
          ? 'h-7 rounded-sm bg-transparent focus-within:bg-bg-elevated'
          : 'h-8 rounded-md border bg-bg-elevated focus-within:ring-1 focus-within:ring-accent',
        !flat && (invalid ? 'border-error focus-within:ring-error' : 'border-border'),
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {/* Overlay — paints the visible text using identical metrics to the
          input. pointer-events-none on EVERYTHING here, including VarSpans,
          so clicks pass straight through to the input below for normal caret
          positioning (incl. clicking inside a `{{var}}` token to edit it
          letter-by-letter). Hover detection is done via mousemove on the
          wrapper, hit-testing against VarSpan bounding rects. */}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden whitespace-pre text-text"
        style={textStyle}
      >
        {value ? (
          parts.map((p, i) =>
            p.isVar ? (
              <VarSpan key={i} text={p.text} />
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )
        ) : (
          <span className="text-text-muted">{rest.placeholder ?? ''}</span>
        )}
      </div>

      {/* Real input — transparent text + visible caret. Identical metrics. */}
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onScroll={onScroll}
        disabled={disabled}
        className={cn(
          'absolute inset-0 z-10 w-full appearance-none border-0 bg-transparent',
          'text-transparent caret-text placeholder-transparent',
          'focus:outline-none',
        )}
        style={textStyle}
        {...rest}
      />

      {/* Portal the hover popup so it isn't clipped by overflow-hidden
          ancestors (KeyValueEditor rows etc). */}
      {popup &&
        createPortal(
          <div
            className="fixed z-50"
            style={{ top: popup.y, left: popup.x }}
            onMouseEnter={cancelClose}
            onMouseLeave={() => scheduleClose()}
            onFocusCapture={() => {
              popupHasFocusRef.current = true;
              cancelClose();
            }}
            onBlurCapture={(e) => {
              // Use relatedTarget to detect focus actually leaving the popup,
              // not just moving between children.
              const next = e.relatedTarget as Node | null;
              if (!e.currentTarget.contains(next)) {
                popupHasFocusRef.current = false;
                scheduleClose();
              }
            }}
          >
            <VarEditor name={popup.name} onClose={() => setPopup(null)} />
          </div>,
          document.body,
        )}
    </div>
  );
});

/**
 * Visible `{{varname}}` token in the overlay. pointer-events-none so clicks
 * pass through to the input below — hover detection is performed by the
 * parent via mousemove + getBoundingClientRect hit-testing.
 */
function VarSpan({ text }: { text: string }) {
  const m = new RegExp(VAR_REGEX.source).exec(text);
  const name = m?.[1] ?? '';
  const resolved = useIsVarResolved(name);
  return (
    <span
      data-var-span="1"
      data-var-name={name}
      className={cn(
        'rounded-sm',
        resolved ? 'bg-accent/15 text-accent' : 'bg-error/15 text-error underline decoration-dotted',
      )}
    >
      {text}
    </span>
  );
}
