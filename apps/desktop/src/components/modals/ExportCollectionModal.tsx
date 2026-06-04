import { useState } from 'react';
import { CheckCircle, Download } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { voltApi } from '@/lib/volt-api';
import { cn } from '@/lib/util';

type Format = 'postman' | 'insomnia' | 'openapi' | 'markdown';

const OPTIONS: Array<{ id: Format; label: string; sub: string }> = [
  {
    id: 'postman',
    label: 'Postman Collection v2.1',
    sub: 'Re-importable into Postman or Volt. Carries auth, headers, body, query params.',
  },
  {
    id: 'insomnia',
    label: 'Insomnia v4',
    sub: 'Insomnia’s flat resources export. Also re-importable into Volt.',
  },
  {
    id: 'openapi',
    label: 'OpenAPI 3.0',
    sub: 'API surface specification. Paths grouped by tag, bodies attached as examples.',
  },
  {
    id: 'markdown',
    label: 'Markdown documentation',
    sub: 'Generated docs: collection description + every request URL/headers/body/examples in a single .md.',
  },
];

export function ExportCollectionModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'export-collection';
  const collectionId = current.kind === 'export-collection' ? current.collectionId : null;
  const collectionName = current.kind === 'export-collection' ? current.collectionName : '';
  const { workspaceId } = useSelection();

  const [format, setFormat] = useState<Format>('postman');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ path?: string; cancelled?: boolean; error?: string } | null>(
    null,
  );

  async function run() {
    if (!workspaceId || !collectionId) return;
    setRunning(true);
    try {
      const r = (await voltApi['collection:export']({
        workspaceId,
        collectionId,
        format,
      })) as { success: boolean; path?: string; cancelled?: boolean; errorMessage?: string };
      if (r.cancelled) setResult({ cancelled: true });
      else if (!r.success) setResult({ error: r.errorMessage ?? 'Export failed' });
      else setResult({ path: r.path });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setResult(null);
          close();
        }
      }}
      title={collectionName ? `Export · ${collectionName}` : 'Export collection'}
      className="max-w-md"
    >
      {result?.path ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle size={14} />
            <span className="text-sm">Saved</span>
          </div>
          <p className="break-all rounded-md border border-border bg-bg p-2 font-mono text-[10px] text-text">
            {result.path}
          </p>
          <div className="flex justify-end border-t border-border pt-3">
            <Button variant="primary" onClick={close}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Format</label>
            <div className="space-y-1">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    'block w-full rounded-md border px-3 py-2 text-left',
                    format === opt.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:bg-bg-elevated',
                  )}
                >
                  <p className="text-13 font-medium text-text">{opt.label}</p>
                  <p className="text-[11px] text-text-muted">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {result?.error && (
            <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
              {result.error}
            </div>
          )}
          {result?.cancelled && (
            <div className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs text-text-muted">
              Save cancelled.
            </div>
          )}

          <div className="flex justify-between border-t border-border pt-3">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run} disabled={running}>
              <Download size={12} />
              {running ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
