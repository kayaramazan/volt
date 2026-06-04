import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/util';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Disable close on overlay click + escape. Useful for forms that need explicit close. */
  modal?: boolean;
}

/**
 * Centered dialog with backdrop, title, description, body. Wraps Radix
 * for a11y + focus trap.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  modal = false,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            // Bound to the viewport so tall content never overflows off-screen.
            // Internal layout is a flex column so the title stays pinned and
            // the children area becomes the scrollable region.
            'flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-bg-elevated shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            className,
          )}
          onPointerDownOutside={modal ? (e) => e.preventDefault() : undefined}
          onEscapeKeyDown={modal ? (e) => e.preventDefault() : undefined}
        >
          {title && (
            <div className="flex flex-shrink-0 items-start justify-between border-b border-border px-5 py-3">
              <div>
                <DialogPrimitive.Title className="text-sm font-semibold text-text">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-xs text-text-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                className="-mr-1 -mt-1 rounded p-1 text-text-muted hover:bg-bg hover:text-text"
                aria-label="Close"
              >
                <X size={14} />
              </DialogPrimitive.Close>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
