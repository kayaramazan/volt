import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';

import { cn } from '@/lib/util';
import { voltVarHighlight } from '@/lib/var-highlight';
import { VarEditor } from '@/components/ui/VarEditor';

type Language = 'json' | 'xml' | 'javascript' | 'html' | 'text';

interface Props {
  value: string;
  onChange?: (value: string) => void;
  language?: Language;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  /** When true, clicking a `{{var}}` opens an inline editor popup. */
  enableVarEditor?: boolean;
}

const langExt = {
  json: () => json(),
  xml: () => xml(),
  javascript: () => javascript({ jsx: false }),
  html: () => html(),
  text: () => null,
} as const;

interface VarPopup {
  name: string;
  x: number;
  y: number;
}

/**
 * Thin wrapper around react-codemirror with dark theme + custom font.
 * Used in request body editor and response body viewer. When enableVarEditor
 * is on (default), clicking a `{{var}}` reference opens a small popup with
 * an editable input bound to the variable's underlying value.
 */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly,
  className,
  placeholder,
  enableVarEditor = true,
}: Props) {
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

  // Esc closes immediately.
  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelClose();
        setPopup(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popup, cancelClose]);

  // Cleanup pending close timer on unmount.
  useEffect(() => () => cancelClose(), [cancelClose]);

  const extensions = useMemo(() => {
    const ext = langExt[language]?.();
    // Array element type spans LanguageSupport | ViewPlugin | Extension —
    // CodeMirror accepts any of them but the TS inference picks the narrowest
    // pair. Widening to `unknown` keeps the JSX-prop typing happy.
    const base: unknown[] = ext ? [ext, voltVarHighlight] : [voltVarHighlight];
    if (enableVarEditor) {
      base.push(
        EditorView.domEventHandlers({
          mouseover(event) {
            const target = event.target as HTMLElement | null;
            const varEl = target?.closest?.('.cm-volt-var') as HTMLElement | null;
            if (!varEl) return false;
            const raw = varEl.textContent ?? '';
            const m = /\{\{\s*([\w.-]+)\s*\}\}/.exec(raw);
            const name = m?.[1] ?? '';
            if (!name) return false;
            // Cancel any pending close from a prior mouseout.
            cancelClose();
            // Only reposition if we moved to a different var.
            setPopup((prev) => {
              if (prev?.name === name) return prev;
              const rect = varEl.getBoundingClientRect();
              return { name, x: rect.left, y: rect.bottom + 2 };
            });
            return false; // don't preventDefault — let CM handle clicks normally
          },
          mouseout(event) {
            const target = event.target as HTMLElement | null;
            const related = (event as MouseEvent).relatedTarget as HTMLElement | null;
            const wasOnVar = target?.closest?.('.cm-volt-var');
            const stillOnSameVar = related?.closest?.('.cm-volt-var');
            if (wasOnVar && !stillOnSameVar) {
              scheduleClose();
            }
            return false;
          },
        }),
      );
    }
    return base;
  }, [language, enableVarEditor, cancelClose, scheduleClose]);

  return (
    <>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions as never}
        readOnly={readOnly}
        placeholder={placeholder}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          autocompletion: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          bracketMatching: true,
          closeBrackets: true,
          searchKeymap: true,
        }}
        className={cn('h-full overflow-auto text-13', className)}
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" }}
      />
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
    </>
  );
}
