import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, CheckCircle, FileUp, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useModals } from '@/stores/modals';
import { useSelection } from '@/stores/selection';
import { voltApi } from '@/lib/volt-api';
import { detectImportFormat, type ImportSource } from '@/lib/import-detect';
import { cn } from '@/lib/util';

interface ImportResult {
  success: boolean;
  summary: { collections: number; requests: number; environments: number; warnings: string[] };
  errorMessage?: string;
}

interface Source {
  /** Source kind detected from content. */
  kind: ImportSource;
  /** Human label for the detection badge. */
  label: string;
  /** Detection explanation shown under the badge. */
  hint: string;
  /** Either content (paste / dragged) or a filePath the user picked. */
  content?: string;
  filePath?: string;
  fileName?: string;
}

/**
 * Auto-detecting import modal. The user drops a file, picks one via the
 * native dialog, or pastes text. Volt sniffs the content for the format
 * (Postman / Insomnia / OpenAPI / HAR / cURL) and shows a badge. The Import
 * button is only enabled once detection succeeds.
 */
export function ImportModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'import';
  const { workspaceId } = useSelection();
  const qc = useQueryClient();

  const [source, setSource] = useState<Source | null>(null);
  const [paste, setPaste] = useState('');
  const [hovering, setHovering] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // Detection from the paste textarea — runs on every change.
  const pasteDetection = useMemo(
    () => (paste.trim() ? detectImportFormat(paste) : null),
    [paste],
  );

  function reset() {
    setSource(null);
    setPaste('');
    setHovering(false);
    setRunning(false);
    setResult(null);
    setError(null);
  }

  async function loadFromPath(filePath: string, fileName?: string) {
    setError(null);
    setResult(null);
    const r = (await voltApi['app:readFileText']({ filePath })) as {
      content: string;
      truncated: boolean;
      error?: string;
    };
    if (r.error) {
      setError(`Couldn't read file: ${r.error}`);
      return;
    }
    const det = detectImportFormat(r.content, fileName ?? filePath);
    if (!det) {
      setError(
        "Couldn't recognize this file as Postman, Insomnia, OpenAPI, HAR, or cURL. Check the format and try again.",
      );
      return;
    }
    setSource({
      kind: det.source,
      label: det.label,
      hint: det.hint,
      // We keep the path so the main process reads the full file at import
      // time (the renderer preview may be truncated).
      filePath,
      fileName: fileName ?? filePath.split(/[\\/]/).pop(),
    });
  }

  function applyPaste() {
    if (!pasteDetection) return;
    setError(null);
    setResult(null);
    setSource({
      kind: pasteDetection.source,
      label: pasteDetection.label,
      hint: pasteDetection.hint,
      content: paste,
    });
  }

  // Confirm the paste detection automatically whenever it changes. Lets the
  // user see the badge appear as they paste.
  useEffect(() => {
    if (paste && pasteDetection) {
      setSource({
        kind: pasteDetection.source,
        label: pasteDetection.label,
        hint: pasteDetection.hint,
        content: paste,
      });
    }
  }, [paste, pasteDetection]);

  async function pickFile() {
    // Native dialog filters help users find the right file without scrolling
    // through every random JSON in their Downloads folder. We still accept
    // any file via "All files" since the content sniffer is the real check.
    const r = await voltApi['app:showFilePicker']({
      filters: [
        { name: 'Volt-importable', extensions: ['json', 'yaml', 'yml', 'har'] },
        { name: 'HAR (HTTP Archive)', extensions: ['har'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'YAML', extensions: ['yaml', 'yml'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (!r.cancelled && r.filePath) {
      await loadFromPath(r.filePath);
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setHovering(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // Files dragged from disk into Electron have a real path on .path
    const filePath = (file as unknown as { path?: string }).path;
    if (filePath) {
      await loadFromPath(filePath, file.name);
    } else {
      // No path (Chromium DnD without main bridge) — read inline.
      const text = await file.text();
      const det = detectImportFormat(text, file.name);
      if (!det) {
        setError(
          "Couldn't recognize this file as Postman, Insomnia, OpenAPI, HAR, or cURL.",
        );
        return;
      }
      setSource({
        kind: det.source,
        label: det.label,
        hint: det.hint,
        content: text,
        fileName: file.name,
      });
    }
  }

  async function runImport() {
    if (!workspaceId || !source) return;
    setRunning(true);
    try {
      const r = (await voltApi['import:source']({
        workspaceId,
        source: source.kind,
        filePath: source.filePath,
        content: source.content,
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
      description="Drop a file or paste — Volt detects Postman, Insomnia, OpenAPI, HAR, or cURL automatically."
      className="max-w-xl"
    >
      {result ? (
        <ResultView result={result} onClose={() => { reset(); close(); }} onAnother={reset} />
      ) : (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setHovering(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              // dragleave fires on child enter — filter to actual leave
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setHovering(false);
            }}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 text-center transition-colors',
              hovering
                ? 'border-accent bg-accent/5'
                : 'border-border bg-bg-elevated/40',
            )}
          >
            <FileUp size={20} className="text-text-muted" />
            <p className="text-xs text-text-muted">
              Drag a file here, or{' '}
              <button
                type="button"
                onClick={pickFile}
                className="text-accent hover:underline"
              >
                choose one
              </button>
            </p>
            <p className="text-[10px] text-text-muted">
              .json · .yaml · .yml · .har — or paste below
            </p>
          </div>

          {/* Paste textarea */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">Or paste content</label>
            <textarea
              ref={pasteRef}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder='curl https://api.example.com … &#10;{ "info": { "schema": "https://schema.getpostman.com/…" } }&#10;openapi: 3.0.3'
              className="h-28 w-full resize-none rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-[11px] text-text outline-none placeholder:text-text-muted focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Detection badge */}
          {source && (
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs">
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0 text-success" />
              <div className="flex-1">
                <p className="text-text">
                  Detected: <span className="font-medium">{source.label}</span>
                </p>
                <p className="text-[10px] text-text-muted">{source.hint}</p>
                {source.fileName && (
                  <p className="mt-0.5 font-mono text-[10px] text-text-muted">{source.fileName}</p>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-[10px] text-text-muted">
              Files are read locally — nothing is uploaded during detection.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={runImport}
                disabled={!source || running}
                type="button"
              >
                <Upload size={12} />
                {running ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
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
  const s = result.summary;
  return (
    <div className="space-y-3">
      {result.success ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs">
          <CheckCircle size={14} className="mt-0.5 text-success" />
          <div className="flex-1">
            <p className="text-text">
              Imported {s.requests} request{s.requests === 1 ? '' : 's'} into {s.collections}{' '}
              collection{s.collections === 1 ? '' : 's'}
              {s.environments > 0
                ? `, plus ${s.environments} environment${s.environments === 1 ? '' : 's'}`
                : ''}
              .
            </p>
            {s.warnings.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-text-muted">
                {s.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
          <AlertTriangle size={14} className="mt-0.5" />
          <p className="flex-1">{result.errorMessage ?? 'Import failed.'}</p>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onAnother}>
          Import another
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
