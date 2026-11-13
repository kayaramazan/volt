// Data hooks — thin wrappers over voltApi + TanStack Query.
//
// We intentionally keep queryKey conventions simple:
//   ['workspaces']
//   ['collections', workspaceId]
//   ['requests', workspaceId, collectionId?]
//   ['request', requestId]
//   ['environments', workspaceId]
//   ['history', workspaceId, search?]
//   ['active-env', workspaceId]
//
// Sync engine invalidates these by listening on 'data:changed' events
// (see useSyncEvents hook).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { voltApi } from '@/lib/volt-api';
import { toast } from '@/stores/toasts';
import { useSelection } from '@/stores/selection';
import { useDrafts } from '@/stores/drafts';

/** Shared onError for mutations: surface the failure instead of swallowing it. */
const reportError = (title: string) => (err: unknown) => {
  console.error(`${title}:`, err);
  toast.error(title, err);
};

// ─────────────────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────────────────

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => voltApi['workspace:list']({}),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; teamId?: string }) =>
      voltApi['workspace:create'](input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: reportError('Could not create workspace'),
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => voltApi['workspace:rename'](input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
    onError: reportError('Could not rename workspace'),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voltApi['workspace:delete']({ id }),
    onSuccess: (_d, id) => {
      // App's auto-select effect moves the selection once the list refetches;
      // drop the dead workspace's cached children so nothing stale flashes.
      qc.removeQueries({ queryKey: ['collections', id] });
      qc.removeQueries({ queryKey: ['requests', id] });
      qc.removeQueries({ queryKey: ['environments', id] });
      qc.removeQueries({ queryKey: ['history', id] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: reportError('Could not delete workspace'),
  });
}

// ─────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────

export function useCollections(workspaceId: string | null) {
  return useQuery({
    queryKey: ['collections', workspaceId],
    queryFn: () => voltApi['collection:list']({ workspaceId: workspaceId! }),
    enabled: !!workspaceId,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; parentId: string | null; name: string }) =>
      voltApi['collection:create'](input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['collections', vars.workspaceId] });
    },
    onError: reportError('Could not create collection'),
  });
}

/**
 * Deep-copy a collection (sub-folders + requests + examples) next to the
 * original. Main does the copy in one transaction.
 */
export function useDuplicateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voltApi['collection:duplicate']({ id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: reportError('Could not duplicate collection'),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      parentId?: string | null;
      description?: string;
      sortOrder?: number;
      variables?: unknown;
      mocks?: unknown;
    }) => voltApi['collection:update'](input as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      // Mock list may have changed — refresh the status pill too.
      qc.invalidateQueries({ queryKey: ['mock-status'] });
    },
    onError: reportError('Could not update collection'),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voltApi['collection:delete']({ id }),
    onSuccess: () => {
      // Requests inside the deleted tree are gone too; Workspace prunes any
      // open tabs for them once the list refetches.
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: reportError('Could not delete collection'),
  });
}

// ─────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────

export function useRequests(workspaceId: string | null, collectionId?: string | null) {
  return useQuery({
    queryKey: ['requests', workspaceId, collectionId ?? null],
    queryFn: () =>
      voltApi['apiRequest:list']({ workspaceId: workspaceId!, collectionId: collectionId ?? undefined }),
    enabled: !!workspaceId,
  });
}

export function useRequest(id: string | null) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => voltApi['apiRequest:get']({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workspaceId: string;
      collectionId: string | null;
      name: string;
      method: string;
      url: string;
    }) => voltApi['apiRequest:create'](input as never),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['requests', vars.workspaceId] });
    },
    onError: reportError('Could not create request'),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; [k: string]: unknown }) =>
      voltApi['apiRequest:update'](input as never),
    onSuccess: (data, vars) => {
      // Seed the detail cache with the returned row so the editor's dirty
      // check and the tab strip's • clear immediately, then refetch lists.
      if (data) qc.setQueryData(['request', vars.id], data);
      qc.invalidateQueries({ queryKey: ['request', vars.id] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: reportError('Could not save request'),
  });
}

/**
 * Duplicate a request — clones every field including scripts/description/
 * examples, appends " (copy)" to the name, drops it in the same collection.
 */
export function useDuplicateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      // We pull the latest row via the get IPC so unsaved drafts don't matter
      // and we get all fields (incl. scripts/description/examples).
      const src = (await voltApi['apiRequest:get']({ id: sourceId })) as Record<
        string,
        unknown
      > | null;
      if (!src) throw new Error('Request not found');
      const copyName = `${(src.name as string) ?? 'Request'} (copy)`;
      return voltApi['apiRequest:create']({
        workspaceId: src.workspaceId as string,
        collectionId: (src.collectionId as string | null) ?? null,
        name: copyName,
        method: src.method as string,
        url: src.url as string,
        headers: src.headers as never,
        queryParams: src.queryParams as never,
        bodyType: src.bodyType as never,
        body: src.body as never,
        auth: src.auth as never,
        preRequestScript: (src.preRequestScript as string | undefined) ?? '',
        postResponseScript: (src.postResponseScript as string | undefined) ?? '',
        description: (src.description as string | undefined) ?? '',
        examples: src.examples as never,
        sortOrder: (src.sortOrder as number | undefined) ?? 0,
      } as never);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
    onError: reportError('Could not duplicate request'),
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voltApi['apiRequest:delete']({ id }),
    onSuccess: (_d, id) => {
      // Close its tab right away (no unsaved-changes prompt — the row is gone)
      // and drop draft/response state so the id can't resurface.
      useDrafts.getState().forgetRequest(id);
      useSelection.getState().closeTab(id);
      qc.removeQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: reportError('Could not delete request'),
  });
}

// ─────────────────────────────────────────────────────────
// Environments
// ─────────────────────────────────────────────────────────

export function useEnvironments(workspaceId: string | null) {
  return useQuery({
    queryKey: ['environments', workspaceId],
    queryFn: () => voltApi['env:list']({ workspaceId: workspaceId! }),
    enabled: !!workspaceId,
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; name: string }) =>
      voltApi['env:create'](input),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['environments', vars.workspaceId] }),
    onError: reportError('Could not create environment'),
  });
}

export function useUpdateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name?: string; variables?: unknown }) =>
      voltApi['env:update'](input as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
    onError: reportError('Could not save environment'),
  });
}

export function useDeleteEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voltApi['env:delete']({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
    onError: reportError('Could not delete environment'),
  });
}

export function useActiveEnv(workspaceId: string | null) {
  return useQuery({
    queryKey: ['active-env', workspaceId],
    queryFn: () => voltApi['env:getActive']({ workspaceId: workspaceId! }),
    enabled: !!workspaceId,
  });
}

export function useSetActiveEnv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; environmentId: string | null }) =>
      voltApi['env:setActive'](input),
    // Update the cached value immediately so the dropdown reflects the choice
    // without waiting for a refetch. Otherwise the controlled <select> snaps
    // back to its previous value between click and refetch.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['active-env', vars.workspaceId] });
      const previous = qc.getQueryData(['active-env', vars.workspaceId]);
      qc.setQueryData(['active-env', vars.workspaceId], { environmentId: vars.environmentId });
      return { previous };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(['active-env', vars.workspaceId], ctx.previous);
      }
      console.error('env:setActive failed:', err);
    },
    onSettled: (_d, _e, vars) =>
      qc.invalidateQueries({ queryKey: ['active-env', vars.workspaceId] }),
  });
}

// ─────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────

export function useHistory(workspaceId: string | null, search?: string) {
  return useQuery({
    queryKey: ['history', workspaceId, search ?? ''],
    queryFn: () =>
      voltApi['history:list']({
        workspaceId: workspaceId!,
        limit: 50,
        search: search || undefined,
      }),
    enabled: !!workspaceId,
  });
}

export function useHistoryEntry(id: string | null) {
  return useQuery({
    queryKey: ['history-entry', id],
    queryFn: () => voltApi['history:get']({ id: id! }),
    enabled: !!id,
  });
}

export function useClearHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => voltApi['history:clear']({ workspaceId }),
    onSuccess: (_d, workspaceId) => {
      qc.invalidateQueries({ queryKey: ['history', workspaceId] });
    },
    onError: reportError('Could not clear history'),
  });
}

// ─────────────────────────────────────────────────────────
// Auth + sync
// ─────────────────────────────────────────────────────────

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: () => voltApi['auth:status']({}),
    refetchInterval: 60_000,  // refresh every minute in case session got revoked
  });
}

/**
 * Centralized sign-out: clears the backend session, drops the local
 * "offline mode" preference so the auth gate kicks back in, and resets the
 * cached auth/workspace state. Dispatches a `volt:signed-out` window event
 * so App can reset its in-memory `offlineSkip` state without a reload.
 */
export function useSignOut() {
  const qc = useQueryClient();
  return async function signOut() {
    try {
      await voltApi['auth:logout']({});
    } catch (e) {
      // Even if the IPC fails (e.g. backend unreachable), clear local state
      // so the user isn't stuck in a half-signed-in screen.
      console.error('auth:logout failed:', e);
    }
    localStorage.removeItem('volt:offline-skip');
    window.dispatchEvent(new Event('volt:signed-out'));
    await qc.invalidateQueries({ queryKey: ['auth-status'] });
    qc.invalidateQueries({ queryKey: ['workspaces'] });
  };
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: () => voltApi['sync:status']({}),
    refetchInterval: 3_000,
  });
}

// ─────────────────────────────────────────────────────────
// Conflicts (local pull-overwrite log)
// ─────────────────────────────────────────────────────────

export function useConflicts(workspaceId: string | null) {
  return useQuery({
    queryKey: ['conflicts', workspaceId],
    queryFn: () => voltApi['conflict:list']({ workspaceId: workspaceId! }),
    enabled: !!workspaceId,
  });
}

export function useDismissConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => voltApi['conflict:dismiss'](input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conflicts'] }),
  });
}

export function useRestoreConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => voltApi['conflict:restore'](input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conflicts'] });
      // The restore re-applies previousState to the local row, which means
      // the affected resource just changed. Refresh the trees so the new
      // values show up immediately.
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['environments'] });
    },
  });
}

export function useMockStatus() {
  return useQuery({
    queryKey: ['mock-status'],
    queryFn: () => voltApi['mock:status']({}),
    refetchInterval: 5_000,
  });
}

export function useStartMockServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { port?: number }) => voltApi['mock:start'](input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mock-status'] }),
  });
}

export function useStopMockServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => voltApi['mock:stop']({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mock-status'] }),
  });
}

// ─────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────

export function usePlugins() {
  return useQuery({
    queryKey: ['plugins'],
    queryFn: () => voltApi['plugins:list']({}),
  });
}

export function useReloadPlugins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => voltApi['plugins:reload']({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plugins'] }),
  });
}

// ─────────────────────────────────────────────────────────
// Team billing + audit log (proxied through main → backend)
// ─────────────────────────────────────────────────────────

export function useTeamBilling(teamId: string | null) {
  return useQuery({
    queryKey: ['team-billing', teamId],
    queryFn: () => voltApi['team:billing']({ teamId: teamId! }),
    enabled: !!teamId,
  });
}

export function useStartBillingCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { teamId: string }) => voltApi['team:billingCheckout'](input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['team-billing', vars.teamId] });
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: (input: { teamId: string }) => voltApi['team:billingPortal'](input),
  });
}

export function useTeamAuditLog(teamId: string | null) {
  return useQuery({
    queryKey: ['team-audit-log', teamId],
    queryFn: () => voltApi['team:auditLog']({ teamId: teamId! }),
    enabled: !!teamId,
  });
}

export function useAppInfo() {
  return useQuery({
    queryKey: ['app-info'],
    queryFn: () => voltApi['app:info']({}),
    staleTime: Infinity,
  });
}

// ─────────────────────────────────────────────────────────
// Globals (pre/post-request script scratch space)
// ─────────────────────────────────────────────────────────

export function useGlobals() {
  return useQuery({
    queryKey: ['globals'],
    // Refetch fairly often so pre/post scripts that write globals show up
    // promptly in subsequent variable substitution.
    queryFn: () => voltApi['globals:list']({}),
    refetchInterval: 5_000,
  });
}

export function useSetGlobal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: unknown }) => voltApi['globals:set'](input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['globals'] }),
  });
}

export function useDeleteGlobal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => voltApi['globals:delete']({ key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['globals'] }),
  });
}

// ─────────────────────────────────────────────────────────
// Auto headers (per-device default headers attached to every request)
// ─────────────────────────────────────────────────────────

export interface AutoHeader {
  key: string;
  value: string;
  enabled: boolean;
  builtin?: boolean;
  description?: string;
}

export function useAutoHeaders() {
  return useQuery({
    queryKey: ['auto-headers'],
    queryFn: () => voltApi['autoHeaders:get']({}) as Promise<AutoHeader[]>,
  });
}

export function useSetAutoHeaders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AutoHeader[]) => voltApi['autoHeaders:set']({ items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-headers'] }),
  });
}

// ─────────────────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────────────────

export function useTeams(enabled = true) {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => voltApi['team:list']({}),
    enabled,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => voltApi['team:create'](input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useInviteToTeam() {
  return useMutation({
    mutationFn: (input: { teamId: string; email: string }) => voltApi['team:invite'](input),
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => voltApi['team:acceptInvite'](input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

// ─── Desktop widget favourites (macOS "Volt Quick Run") ───

export function useWidgetFavorites() {
  return useQuery({
    queryKey: ['widget-favorites'],
    queryFn: () => voltApi['widget:favorites']({}) as Promise<{ requestIds: string[]; supported: boolean }>,
    staleTime: Infinity,
  });
}

export function useSetWidgetFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; favorite: boolean }) => voltApi['widget:setFavorite'](input),
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ['widget-favorites'] });
      toast.success(input.favorite ? 'Added to widget' : 'Removed from widget');
    },
    onError: (err) => toast.error('Could not update widget', err),
  });
}
