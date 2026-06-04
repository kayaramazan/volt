// Plugins manager. Lists the user's installed Volt plugins (single .js
// files dropped in the plugins folder), shows any load errors, and offers
// Reload + Open folder actions. Plugin authoring docs live in the README
// the runtime auto-writes into the plugins folder.

import { AlertCircle, FolderOpen, Puzzle, RefreshCw } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { usePlugins, useReloadPlugins } from '@/hooks/useData';
import { useModals } from '@/stores/modals';
import { voltApi } from '@/lib/volt-api';
import { cn } from '@/lib/util';

export function PluginsModal() {
  const { current, close } = useModals();
  const isOpen = current.kind === 'plugins';
  const { data, isLoading } = usePlugins();
  const reload = useReloadPlugins();

  const plugins = data?.plugins ?? [];
  const totalTransformers = plugins.reduce((n, p) => n + p.transformers.length, 0);
  const erroredCount = plugins.filter((p) => p.error).length;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => !v && close()}
      title="Plugins"
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            Drop <span className="font-mono text-text">.js</span> files in the plugins folder. Each file
            becomes a Volt plugin running in its own sandboxed{' '}
            <span className="font-mono text-text">vm</span> context.
          </p>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => voltApi['plugins:openFolder']({})}
              title="Open the plugins folder in the OS file manager"
            >
              <FolderOpen size={12} /> Open folder
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => reload.mutate()}
              disabled={reload.isPending}
              title="Re-read every .js file in the plugins folder"
            >
              <RefreshCw size={12} className={reload.isPending ? 'animate-spin' : undefined} />
              Reload
            </Button>
          </div>
        </div>

        {data?.dir && (
          <p className="rounded border border-border bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
            {data.dir}
          </p>
        )}

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>{plugins.length} plugin{plugins.length === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>{totalTransformers} transformer{totalTransformers === 1 ? '' : 's'}</span>
          {erroredCount > 0 && (
            <>
              <span>·</span>
              <span className="text-error">{erroredCount} with errors</span>
            </>
          )}
        </div>

        {isLoading ? (
          <p className="px-3 py-6 text-center text-xs text-text-muted">Loading…</p>
        ) : plugins.length === 0 ? (
          <p className="rounded border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
            No plugins yet. Open the folder above — a starter <span className="font-mono text-text">example.js</span> +
            README are dropped in for you on first launch.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded border border-border">
            {plugins.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 p-2">
                <div className="flex items-center gap-2">
                  <Puzzle
                    size={12}
                    className={cn(p.error ? 'text-error' : 'text-accent', 'flex-shrink-0')}
                  />
                  <span className="font-medium text-text">{p.name}</span>
                  {p.version && (
                    <span className="font-mono text-[10px] text-text-muted">v{p.version}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-text-muted truncate" title={p.filePath}>
                    {p.id}.js
                  </span>
                </div>
                {p.error ? (
                  <div className="flex items-start gap-1 rounded border border-error/30 bg-error/10 px-2 py-1 text-[11px] text-error">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                    <span>{p.error}</span>
                  </div>
                ) : p.transformers.length === 0 ? (
                  <p className="text-[11px] text-text-muted">
                    Loaded with no transformers registered.
                  </p>
                ) : (
                  <ul className="space-y-1 pl-4">
                    {p.transformers.map((t) => (
                      <li key={t.id} className="text-[11px]">
                        <span className="text-text">{t.name}</span>
                        {t.matchContentType && (
                          <span className="ml-1 font-mono text-text-muted">
                            ({t.matchContentType})
                          </span>
                        )}
                        {t.description && (
                          <span className="ml-1 text-text-muted">— {t.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
