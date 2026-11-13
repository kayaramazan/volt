import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { marked } from 'marked';
import { Eye, FileText, SplitSquareHorizontal } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useCollections, useUpdateCollection } from '@/hooks/useData';
import { useSelection } from '@/stores/selection';
import { useModals } from '@/stores/modals';
import { cn } from '@/lib/util';
import { useEffectiveTheme } from '@/stores/theme';

type ViewMode = 'edit' | 'split' | 'preview';

/**
 * Per-collection documentation editor. Markdown body, live preview, saves
 * through useUpdateCollection (so it syncs to the backend on cloud workspaces).
 */
export function CollectionDocsModal() {
  const editorTheme = useEffectiveTheme();
  const { current, close } = useModals();
  const isOpen = current.kind === 'collection-docs';
  const collectionId = current.kind === 'collection-docs' ? current.collectionId : null;
  const { workspaceId } = useSelection();
  const { data: collections } = useCollections(workspaceId);
  const update = useUpdateCollection();

  const collection = useMemo(
    () => (collections ?? []).find((c) => c.id === collectionId),
    [collections, collectionId],
  );

  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');

  // Seed the editor when the modal opens or targets a different collection.
  // Not keyed on the `collection` object: the collections list refetches on
  // every reorder / mock change / sync pull, and re-seeding would discard
  // the user's unsaved edits.
  const loaded = !!collection;
  useEffect(() => {
    if (!isOpen || !collection) return;
    setDraft((collection as { description?: string }).description ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, collectionId, loaded]);

  const dirty =
    (collection &&
      ((collection as { description?: string }).description ?? '') !== draft) ||
    false;

  async function save() {
    if (!collection) return;
    await update.mutateAsync({ id: collection.id, description: draft } as never);
    close();
  }

  const previewHtml = useMemo(() => {
    // marked's async overload is opt-in; default is sync. Wrap in a try just in
    // case the input is malformed for some reason.
    try {
      return marked.parse(draft || '*No documentation yet.*', {
        breaks: true,
        gfm: true,
      }) as string;
    } catch {
      return '<p>Failed to render markdown.</p>';
    }
  }, [draft]);

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title={collection ? `Docs · ${collection.name}` : 'Documentation'}
      className="max-w-5xl"
    >
      {!collection ? (
        <p className="text-xs text-text-muted">Collection not found.</p>
      ) : (
        <div className="flex h-[32rem] flex-col">
          {/* Mode toggle */}
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

          {/* Body */}
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
                  placeholder="# Collection name&#10;&#10;Document your endpoints, conventions, request examples, etc."
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

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-[10px] text-text-muted">
              Markdown · supports GFM (tables, fenced code, task lists).
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={save}
                disabled={!dirty || update.isPending}
              >
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
