import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { marked } from 'marked';
import { Eye, FileText, SplitSquareHorizontal } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useRequest, useUpdateRequest } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { cn } from '@/lib/util';
import { useEffectiveTheme } from '@/stores/theme';

type ViewMode = 'edit' | 'split' | 'preview';

/** Per-request markdown documentation editor. Mirrors CollectionDocsModal. */
export function RequestDocsModal() {
  const editorTheme = useEffectiveTheme();
  const { current, close } = useModals();
  const isOpen = current.kind === 'request-docs';
  const requestId = current.kind === 'request-docs' ? current.requestId : null;

  const { data: request } = useRequest(requestId);
  const update = useUpdateRequest();

  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');

  // Seed the editor when the modal opens or targets a different request.
  // Deliberately NOT keyed on the `request` object: a background refetch of
  // ['request', id] (sync pull, Save elsewhere) would otherwise wipe the
  // user's in-progress edits.
  const loaded = !!request;
  useEffect(() => {
    if (!isOpen || !request) return;
    setDraft((request as { description?: string }).description ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, requestId, loaded]);

  const dirty =
    (request && ((request as { description?: string }).description ?? '') !== draft) || false;

  async function save() {
    if (!request) return;
    await update.mutateAsync({ id: request.id, description: draft });
    close();
  }

  const previewHtml = useMemo(() => {
    try {
      return marked.parse(draft || '*No documentation yet.*', { breaks: true, gfm: true }) as string;
    } catch {
      return '<p>Failed to render markdown.</p>';
    }
  }, [draft]);

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title={request ? `Docs · ${request.name}` : 'Documentation'}
      className="max-w-5xl"
    >
      {!request ? (
        <p className="text-xs text-text-muted">Request not found.</p>
      ) : (
        <div className="flex h-[32rem] flex-col">
          <div className="mb-2 flex items-center gap-1 self-end rounded-md border border-border bg-bg-elevated p-0.5 text-xs">
            <ModeButton current={mode} value="edit" onClick={setMode}>
              <FileText size={12} />
              Edit
            </ModeButton>
            <ModeButton current={mode} value="split" onClick={setMode}>
              <SplitSquareHorizontal size={12} />
              Split
            </ModeButton>
            <ModeButton current={mode} value="preview" onClick={setMode}>
              <Eye size={12} />
              Preview
            </ModeButton>
          </div>

          <div className="flex min-h-0 flex-1 gap-2">
            {(mode === 'edit' || mode === 'split') && (
              <div className="flex min-h-0 flex-1 flex-col rounded border border-border">
                <CodeMirror
                  value={draft}
                  onChange={(v) => setDraft(v)}
                  extensions={[markdown()]}
                  theme={editorTheme}
                  basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    autocompletion: false,
                    highlightActiveLine: false,
                    highlightActiveLineGutter: false,
                  }}
                  className="h-full overflow-auto text-13"
                  style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace" }}
                  placeholder="# Endpoint name&#10;&#10;What it does, when to use it, example inputs/outputs."
                />
              </div>
            )}
            {(mode === 'preview' || mode === 'split') && (
              <div
                className="prose-volt min-h-0 flex-1 overflow-auto rounded border border-border bg-bg p-3 text-13 text-text"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[10px] text-text-muted">
              Markdown · supports GFM (tables, fenced code, task lists).
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={!dirty || update.isPending}>
                {dirty ? 'Save' : 'Saved'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ModeButton({
  current,
  value,
  onClick,
  children,
}: {
  current: ViewMode;
  value: ViewMode;
  onClick: (m: ViewMode) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        'flex items-center gap-1 rounded px-2 py-0.5 text-text-muted',
        current === value && 'bg-bg text-text shadow',
      )}
    >
      {children}
    </button>
  );
}
