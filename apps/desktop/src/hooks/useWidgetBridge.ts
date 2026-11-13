// Renderer half of the macOS desktop widget (electron/core/widget/bridge.ts).
//
//   widget:run  {runId, requestId} → resolve + send the SAVED request the same
//               way the Send button does (env, collection vars, globals, auth
//               incl. OAuth, send settings, scripts), then report back.
//   widget:open {requestId}        → reveal the request (switching workspace).

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  applySendSettings,
  buildUrlFromParams,
  collectColChain,
  loadSendSettings,
  mergeUrlQueryIntoRows,
  resolveLocally,
  setHeaderCI,
} from '@/components/request/RequestEditor';
import { buildVariableMap, substituteVariables, type ScopeCollection } from '@/lib/variables';
import { onVoltEvent, voltApi } from '@/lib/volt-api';
import { rowId } from '@/lib/util';
import { useSelection } from '@/stores/selection';

type Saved = Record<string, unknown> & {
  id: string;
  workspaceId: string;
  collectionId?: string | null;
  name: string;
  method: string;
  url: string;
};

export function useWidgetBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    const off = onVoltEvent((event: unknown) => {
      const e = event as { kind?: string; runId?: string; requestId?: string };
      if (e?.kind === 'widget:run' && e.runId && e.requestId) {
        const runId = e.runId;
        void runSavedRequest(e.requestId, qc).then(
          (r) => voltApi['widget:runResult']({ runId, ...r }),
          (err: unknown) =>
            voltApi['widget:runResult']({ runId, ok: false, error: String((err as Error)?.message ?? err).slice(0, 400) }),
        );
      } else if (e?.kind === 'widget:open' && e.requestId) {
        void revealRequest(e.requestId);
      }
    });
    // Announce after subscribing so main never sends into the void.
    void voltApi['widget:ready']({});
    return off;
  }, [qc]);
}

async function revealRequest(requestId: string) {
  const saved = (await voltApi['apiRequest:get']({ id: requestId })) as Saved | null;
  if (!saved) return;
  const sel = useSelection.getState();
  sel.setWorkspaceId(saved.workspaceId);
  useSelection.getState().selectRequest(requestId);
}

async function runSavedRequest(
  requestId: string,
  qc: QueryClient,
): Promise<{ ok: boolean; error?: string }> {
  const saved = (await voltApi['apiRequest:get']({ id: requestId })) as Saved | null;
  if (!saved) return { ok: false, error: 'Request not found' };
  const workspaceId = saved.workspaceId;

  const [environments, activeEnv, collections, globals] = await Promise.all([
    voltApi['env:list']({ workspaceId }) as Promise<Array<{ id: string; name: string; variables?: Array<{ key: string; value: string }> }>>,
    voltApi['env:getActive']({ workspaceId }) as Promise<{ environmentId: string | null } | null>,
    voltApi['collection:list']({ workspaceId }) as Promise<Array<{ id: string; parentId: string | null; variables?: unknown }>>,
    voltApi['globals:list']({}) as Promise<Record<string, unknown>>,
  ]);
  const environmentId = activeEnv?.environmentId ?? null;
  const env = environments?.find((x) => x.id === environmentId) ?? null;
  const collectionChain = saved.collectionId ? collectColChain(saved.collectionId, collections ?? []) : [];

  // Same shape RequestEditor builds from a saved row.
  const qp = mergeUrlQueryIntoRows(saved.url, (saved.queryParams as never) ?? []);
  const draft = {
    method: saved.method,
    url: buildUrlFromParams(saved.url, qp),
    headers: saved.headers,
    queryParams: qp,
    pathVariables: (saved.pathVariables as unknown) ?? [],
    bodyType: (saved.bodyType as string | undefined) ?? (saved.body as { type?: string } | undefined)?.type ?? 'none',
    body: saved.body,
    auth: saved.auth,
  };

  let oauthHeader: string | null = null;
  const auth = (saved.auth ?? {}) as Record<string, unknown> & { type?: string; headerPrefix?: string };
  if (auth.type === 'oauth2') {
    const vars = buildVariableMap(globals ?? {}, env, collectionChain as ScopeCollection[]);
    const cfg = Object.fromEntries(
      Object.entries(auth).map(([k, v]) => [k, typeof v === 'string' ? substituteVariables(v, vars) : v]),
    );
    const r = (await voltApi['oauth:ensureToken'](cfg as never)) as { ok: boolean; accessToken?: string; error?: string };
    if (!r.ok) return { ok: false, error: r.error ?? 'OAuth token unavailable' };
    oauthHeader = `${auth.headerPrefix ?? 'Bearer'} ${r.accessToken}`;
  }

  const { resolved, variables, unresolvedUrlVar } = resolveLocally(draft as never, env, collectionChain, globals ?? {});
  const preRequestScript = (saved.preRequestScript as string | undefined) ?? '';
  if (unresolvedUrlVar && !preRequestScript.trim()) {
    return { ok: false, error: `Unresolved variable {{${unresolvedUrlVar}}}` };
  }
  if (oauthHeader) setHeaderCI(resolved.headers, 'Authorization', oauthHeader);
  applySendSettings(resolved, loadSendSettings());

  try {
    // request:send records history and the widget result in main.
    await voltApi['request:send']({
      inFlightId: rowId('widget-send'),
      requestId,
      requestName: saved.name ?? '',
      request: resolved as never,
      preRequestScript,
      postResponseScript: (saved.postResponseScript as string | undefined) ?? '',
      variables,
      workspaceId,
      environmentId,
    });
    return { ok: true };
  } finally {
    // Scripts may have changed env/globals; history has a new row.
    qc.invalidateQueries({ queryKey: ['environments', workspaceId] });
    qc.invalidateQueries({ queryKey: ['globals'] });
    qc.invalidateQueries({ queryKey: ['history'] });
  }
}
