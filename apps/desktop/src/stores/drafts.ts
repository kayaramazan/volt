// Per-request "draft" state — user edits before pressing Save.
//
// We keep the saved version in TanStack Query cache (server of truth = local DB),
// and overlay user keystrokes on top in this store. The tab title shows a •
// when draft differs from saved.

import { create } from 'zustand';

export interface RequestDraft {
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

/**
 * True when the draft differs from the saved row. Mirrors the comparison in
 * RequestEditor so the tab strip's • and the Save button always agree.
 * `saved` is the row from the ['request', id] query (or undefined while
 * loading — treated as clean).
 */
export function isDraftDirty(draft: RequestDraft | undefined, saved: unknown): boolean {
  if (!draft || !saved || typeof saved !== 'object') return false;
  const s = saved as Partial<RequestDraft> & { bodyType?: string };
  return (
    s.name !== draft.name ||
    s.method !== draft.method ||
    s.url !== draft.url ||
    JSON.stringify(s.headers) !== JSON.stringify(draft.headers) ||
    JSON.stringify(s.queryParams) !== JSON.stringify(draft.queryParams) ||
    (s.bodyType ?? '') !== draft.bodyType ||
    JSON.stringify(s.body) !== JSON.stringify(draft.body) ||
    JSON.stringify(s.auth) !== JSON.stringify(draft.auth) ||
    (s.preRequestScript ?? '') !== draft.preRequestScript ||
    (s.postResponseScript ?? '') !== draft.postResponseScript
  );
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
  /** Drop the draft AND cached response for a request (tab closed / deleted). */
  forgetRequest: (id: string) => void;
  /** Drop every draft + cached response (used when switching workspace). */
  clearAll: () => void;
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
  forgetRequest: (id) =>
    set((s) => {
      const drafts = new Map(s.drafts);
      drafts.delete(id);
      const responses = new Map(s.lastResponses);
      responses.delete(id);
      return { drafts, lastResponses: responses };
    }),
  clearAll: () => set({ drafts: new Map(), lastResponses: new Map() }),
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
