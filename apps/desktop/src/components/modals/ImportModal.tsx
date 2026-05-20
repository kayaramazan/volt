import { useState, type FormEvent } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { voltApi } from '@/lib/volt-api';
import { useQueryClient } from '@tanstack/react-query';

type Source = 'postman' | 'insomnia' | 'openapi' | 'curl';

interface ImportResult {
  success: boolean;
  summary: { collections: number; requests: number; environments: number; warnings: string[] };
  errorMessage?: string;
}

export function ImportModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'import';
  const { workspaceId } = useSelection();
  const qc = useQueryClient();

  const [source, setSource] = useState<Source>('postman');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [pastedContent, setPastedContent] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [running, setRunning] = useState(false);

  async function pickFile() {
    const filters =
      source === 'openapi'
        ? [
            { name: 'OpenAPI', extensions: ['json', 'yaml', 'yml'] },
            { name: 'JSON', extensions: ['json'] },
          ]
        : [{ name: 'JSON', extensions: ['json'] }];
    const res = await voltApi['app:showFilePicker']({ filters });
    if (!res.cancelled && res.filePath) setFilePath(res.filePath);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    if (source !== 'curl' && !filePath) return;
    if (source === 'curl' && !pastedContent.trim()) return;
    setRunning(true);
    try {
      const r = (await voltApi['import:source']({
        workspaceId,
        source,
        filePath: source === 'curl' ? undefined : filePath ?? undefined,
        content: source === 'curl' ? pastedContent : undefined,
      })) as ImportResult;
      setResult(r);
      if (r.success) {
        qc.invalidateQueries({ queryKey: ['collections', workspaceId] });
        qc.invalidateQueries({ queryKey: ['requests', workspaceId] });
        qc.invalidateQueries({ queryKey: ['environments', workspaceId] });
      }
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setFilePath(null);
    setPastedContent('');
    setResult(null);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          close();
        }
      }}
      title="Import"
      description="Bring requests in from Postman, Insomnia, OpenAPI, or cURL"
      className="max-w-xl"
    >
      {result ? (
        <ResultView result={result} onClose={() => { reset(); close(); }} onAnother={reset} />
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Source</label>
            <Select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as Source);
                setFilePath(null);
              }}
              options={[
                { value: 'postman', label: 'Postman Collection v2.1' },
                { value: 'insomnia', label: 'Insomnia v4' },
                { value: 'openapi', label: 'OpenAPI 3.0 (JSON or YAML)' },
                { value: 'curl', label: 'cURL command (paste)' },
              ]}
            />
          </div>

          {source !== 'curl' ? (
            <div>
              <label className="mb-1 block text-xs text-text-muted">File</label>
              {filePath ? (
                <div className="flex items-center justify-between rounded border border-border bg-bg p-2 text-xs">
                  <span className="flex items-center gap-1.5 text-text">
                    <FileText size={12} />
                    <span className="truncate">{filePath}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilePath(null)}
                    className="text-text-muted hover:text-text"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={pickFile} className="w-full">
                  <Upload size={13} />
                  Choose file
                </Button>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-text-muted">Paste cURL command</label>
              <textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                rows={8}
                placeholder={"curl 'https://api.example.com/v1/users' -H 'Authorization: Bearer ...'"}
                className="w-full rounded-md border border-border bg-bg p-2 font-mono text-xs text-text outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { reset(); close(); }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                running ||
                (source !== 'curl' && !filePath) ||
                (source === 'curl' && !pastedContent.trim())
              }
            >
              {running ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ResultView({
  result,
  onClose,
  onAnother,
}: {
  result: ImportResult;
  onClose: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="space-y-3">
      {result.success ? (
        <>
          <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs">
            <CheckCircle size={14} className="text-success" />
            <span className="text-text">Import successful</span>
          </div>
          <div className="rounded border border-border p-3 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Collections" value={result.summary.collections} />
              <Stat label="Requests" value={result.summary.requests} />
              <Stat label="Envs" value={result.summary.environments} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-error/10 px-3 py-2 text-xs">
          <AlertTriangle size={14} className="text-error" />
          <span className="text-text">{result.errorMessage ?? 'Import failed'}</span>
        </div>
      )}

      {result.summary.warnings.length > 0 && (
        <div className="rounded border border-warning/30 bg-warning/10 p-3 text-xs">
          <p className="mb-1 font-medium text-warning">Warnings</p>
          <ul className="space-y-0.5 text-text">
            {result.summary.warnings.slice(0, 10).map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
            {result.summary.warnings.length > 10 && (
              <li className="text-text-muted">… and {result.summary.warnings.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAnother}>
          Import another
        </Button>
        <Button type="button" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-accent">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
