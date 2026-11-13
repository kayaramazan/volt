// Tiny toast queue so failures surface to the user instead of dying in
// console.error. Rendered by <Toaster /> (components/layout/Toaster.tsx).
//
// Usage from anywhere (hooks, stores, event handlers):
//   toast.error('Could not delete request', err)
//   toast.info('History cleared')

import { create } from 'zustand';

export type ToastKind = 'error' | 'info' | 'success';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const AUTO_DISMISS_MS: Record<ToastKind, number> = { error: 8000, info: 4000, success: 3000 };

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, AUTO_DISMISS_MS[t.kind]);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

function errorDetail(err: unknown): string | undefined {
  if (!err) return undefined;
  const msg = err instanceof Error ? err.message : String(err);
  // IPC errors arrive as "Error invoking remote method 'x:y': Error: real message".
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export const toast = {
  error: (title: string, err?: unknown) =>
    useToasts.getState().push({ kind: 'error', title, detail: errorDetail(err) }),
  info: (title: string, detail?: string) => useToasts.getState().push({ kind: 'info', title, detail }),
  success: (title: string, detail?: string) =>
    useToasts.getState().push({ kind: 'success', title, detail }),
};
