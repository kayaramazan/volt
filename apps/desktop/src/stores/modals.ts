// Centralized modal state so any component can open / close global modals
// without prop drilling.

import { create } from 'zustand';

type ModalKind =
  | { kind: 'none' }
  | { kind: 'command-palette' }
  | { kind: 'import' }
  | { kind: 'new-request'; collectionId: string | null }
  | { kind: 'new-collection'; parentId: string | null }
  | { kind: 'edit-environment'; environmentId: string | null }
  | { kind: 'new-workspace' }
  | { kind: 'settings' }
  | { kind: 'teams' }
  | { kind: 'globals' }
  | { kind: 'collection-docs'; collectionId: string }
  | { kind: 'request-docs'; requestId: string }
  | { kind: 'add-example'; requestId: string };

interface ModalState {
  current: ModalKind;
  open: (modal: Exclude<ModalKind, { kind: 'none' }>) => void;
  close: () => void;
}

export const useModals = create<ModalState>((set) => ({
  current: { kind: 'none' },
  open: (modal) => set({ current: modal }),
  close: () => set({ current: { kind: 'none' } }),
}));
