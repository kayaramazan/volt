import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { useToasts, type ToastKind } from '@/stores/toasts';
import { cn } from '@/lib/util';

const ICON: Record<ToastKind, React.ReactNode> = {
  error: <AlertCircle size={14} className="text-error" />,
  info: <Info size={14} className="text-accent" />,
  success: <CheckCircle2 size={14} className="text-success" />,
};

/** Bottom-right stack of transient notifications. Mounted once in App. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-md border bg-bg-elevated px-3 py-2 text-xs shadow-lg',
            t.kind === 'error' ? 'border-error/40' : 'border-border',
          )}
        >
          <span className="mt-0.5 shrink-0">{ICON[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-text">{t.title}</p>
            {t.detail && <p className="mt-0.5 break-words text-[11px] text-text-muted">{t.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="rounded p-0.5 text-text-muted hover:bg-bg hover:text-text"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
