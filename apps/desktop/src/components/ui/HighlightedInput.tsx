import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes, type CSSProperties } from 'react';

import { cn } from '@/lib/util';
import { splitByVars } from '@/lib/var-highlight';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {
  value: string;
  invalid?: boolean;
  /** Borderless transparent variant — fits inside a KeyValueEditor row. */
  flat?: boolean;
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

export const HighlightedInput = forwardRef<HTMLInputElement, Props>(function HighlightedInput(
  { value, onChange, onScroll, className, invalid, flat, disabled, ...rest },
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

  const parts = splitByVars(value);
  const textStyle: CSSProperties = {
    ...SHARED_STYLE,
    font: flat ? FONT_FLAT : FONT_NORMAL,
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
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
      {/* Overlay — paints the visible text using identical metrics to the input. */}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre text-text"
        style={textStyle}
      >
        {value ? (
          parts.map((p, i) =>
            p.isVar ? (
              <span key={i} className="bg-accent/15 text-accent">
                {p.text}
              </span>
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
    </div>
  );
});
