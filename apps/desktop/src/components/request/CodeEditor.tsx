import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';

import { cn } from '@/lib/util';
import { voltVarHighlight } from '@/lib/var-highlight';

type Language = 'json' | 'xml' | 'javascript' | 'html' | 'text';

interface Props {
  value: string;
  onChange?: (value: string) => void;
  language?: Language;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

const langExt = {
  json: () => json(),
  xml: () => xml(),
  javascript: () => javascript({ jsx: false }),
  html: () => html(),
  text: () => null,
} as const;

/**
 * Thin wrapper around react-codemirror with dark theme + custom font.
 * Used in request body editor and response body viewer.
 */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly,
  className,
  placeholder,
}: Props) {
  const ext = langExt[language]?.();
  const extensions = ext ? [ext, voltVarHighlight] : [voltVarHighlight];

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
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
  );
}
