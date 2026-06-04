import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { Check, Copy } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useModals } from '@/stores/modals';
import {
  LANGUAGES,
  generate,
  type GenBody,
  type GenRequest,
  type Language,
} from '@/lib/codegen';

/**
 * Renders the active request as a code snippet in the user's pick of language.
 * The "resolved" snapshot is captured by the caller (RequestEditor) at the
 * moment the user clicks Code — so the snippet reflects the current draft,
 * env, globals, and collection chain values without recomputing here.
 */
export function CodeGenModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'codegen';
  const snapshot = current.kind === 'codegen' ? current.request : null;
  const title = current.kind === 'codegen' ? current.title : '';

  const [language, setLanguage] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    if (!snapshot) return '';
    const req: GenRequest = {
      method: snapshot.method,
      url: snapshot.url,
      headers: snapshot.headers,
      body: (snapshot.body as GenBody) ?? { type: 'none' },
    };
    return generate(language, req);
  }, [snapshot, language]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* user dismissed clipboard prompt */
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title={title ? `Code · ${title}` : 'Code'}
      className="max-w-3xl"
    >
      <div className="flex h-[28rem] flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
            className="w-56"
          />
          <Button variant="ghost" onClick={copy} size="sm">
            {copied ? (
              <>
                <Check size={12} />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded border border-border">
          <CodeMirror
            value={code}
            readOnly
            extensions={cmExtensionsFor(language)}
            theme="dark"
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              autocompletion: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            className="h-full overflow-auto text-13"
            style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" }}
          />
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function cmExtensionsFor(lang: Language) {
  switch (lang) {
    case 'fetch':
    case 'node-fetch':
    case 'axios':
      return [javascript({ jsx: false })];
    // Python/Go/Java/PHP/Ruby/curl don't ship CodeMirror grammars in our
    // current deps — we render as plain text. Still readable in mono font.
    default:
      return [];
  }
}
