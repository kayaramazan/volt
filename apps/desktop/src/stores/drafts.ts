// Per-request "draft" state — user edits before pressing Save.
//
// We keep the saved version in TanStack Query cache (server of truth = local DB),
// and overlay user keystrokes on top in this store. The tab title shows a •
// when draft differs from saved.

import { create } from 'zustand';

interface RequestDraft {
  name: string;
  method: string;
  url: string;
  headers: unknown[];
  queryParams: unknown[];
  bodyType: string;
  body: unknown;
  auth: unknown;
  preRequestScript: string;
  postResponseScript: string;
}

interface DraftState {
  drafts: Map<string, RequestDraft>;
  /** Maps requestId → in-flight send identifier (so we can cancel) */
  inFlight: Map<string, string>;
  /** Most recent response per request, in-memory only (history persists). */
  lastResponses: Map<string, unknown>;

  setDraft: (id: string, draft: RequestDraft) => void;
  patchDraft: (id: string, patch: Partial<RequestDraft>) => void;
  clearDraft: (id: string) => void;
  setInFlight: (id: string, sendId: string | null) => void;
  setLastResponse: (id: string, response: unknown) => void;
}

export const useDrafts = create<DraftState>((set) => ({
  drafts: new Map(),
  inFlight: new Map(),
  lastResponses: new Map(),

  setDraft: (id, draft) =>
    set((s) => {
      const next = new Map(s.drafts);
      next.set(id, draft);
      return { drafts: next };
    }),
  patchDraft: (id, patch) =>
    set((s) => {
      const next = new Map(s.drafts);
      const existing = next.get(id);
      if (!existing) return s;
      next.set(id, { ...existing, ...patch });
      return { drafts: next };
    }),
  clearDraft: (id) =>
    set((s) => {
      const next = new Map(s.drafts);
      next.delete(id);
      return { drafts: next };
    }),
  setInFlight: (id, sendId) =>
    set((s) => {
      const next = new Map(s.inFlight);
      if (sendId === null) next.delete(id);
      else next.set(id, sendId);
      return { inFlight: next };
    }),
  setLastResponse: (id, response) =>
    set((s) => {
      const next = new Map(s.lastResponses);
      next.set(id, response);
      return { lastResponses: next };
    }),
}));
