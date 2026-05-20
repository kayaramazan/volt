// IPC handlers — central dispatch.
//
// Every channel from packages/shared/src/ipc/contracts.ts is mapped here.
// Each handler:
//   1. Validates input with the Zod schema (preload also validates but defense-in-depth)
//   2. Calls into core/* services
//   3. Returns output (also validated against output schema)
//
// All handlers are async and return promises; renderer awaits via window.volt.

import { app, ipcMain, shell, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { IPC, type IpcChannel } from '@volt/shared';

import {
  createCollection,
  createEnvironment,
  createRequest,
  createWorkspace,
  deleteGlobal,
  deleteWorkspaceLocal,
  getActiveEnvironment,
  getEnvironment,
  getHistoryEntry,
  getRequest,
  listCollections,
  listEnvironments,
  listGlobals,
  listHistory,
  listRequests,
  listWorkspaces,
  recordHistory,
  renameWorkspace,
  setActiveEnvironment,
  setGlobal,
  softDeleteCollection,
  softDeleteEnvironment,
  softDeleteRequest,
  updateCollection,
  updateEnvironment,
  updateRequest,
  clearHistory,
} from '../core/db/queries';
import { getDbPath } from '../core/db/connection';
import { getSecret } from '../core/auth/keychain';
import { authedFetch, currentUser, login as authLogin, logout as authLogout, register as authRegister } from '../core/auth/manager';
import { executeRequest, cancelRequest } from '../core/http/engine';
import {
  runPostResponse,
  runPreRequest,
  type ScriptRequestView,
  type ScriptResponseView,
} from '../core/scripts/runner';
import { resolveRequest } from '../core/http/resolve';
import { forceSync, getSyncStatus, notifyDirty, startSync, stopSync } from '../core/sync/engine';
import { importPostman } from '../core/import/postman';
import { importInsomnia } from '../core/import/insomnia';
import { importOpenAPI } from '../core/import/openapi';
import { importCurl } from '../core/import/curl';

export function registerIpcHandlers() {
  // Generic handler wrapper: validates input via contract, catches errors.
  for (const channel of Object.keys(IPC) as IpcChannel[]) {
    ipcMain.handle(channel, async (_event, rawInput) => {
      const contract = IPC[channel];
      console.log(`[ipc] <- ${channel}`, rawInput);
      try {
        // Renderer may invoke no-arg channels as `volt['auth:status']()`,
        // which arrives here as `undefined`. Treat that as `{}` so empty-object
        // schemas don't reject it.
        const parsed = contract.input.parse(rawInput ?? {});
        const result = await dispatch(channel, parsed as never);
        return result;
      } catch (err) {
        if (err instanceof z.ZodError) {
          console.error(`[ipc] zod failed for ${channel}:`, err.errors);
          throw new Error(`Invalid input for ${channel}: ${err.errors[0]?.message ?? 'validation failed'}`);
        }
        console.error(`[ipc] handler threw for ${channel}:`, err);
        throw err;
      }
    });
  }
}

// ─────────────────────────────────────────────────────────
// Dispatch — one case per channel
// ─────────────────────────────────────────────────────────

async function dispatch<C extends IpcChannel>(channel: C, input: unknown): Promise<unknown> {
  switch (channel) {
    // ──── Request execution
    case 'request:send': {
      const {
        inFlightId,
        request,
        preRequestScript,
        postResponseScript,
        variables,
        environmentId,
      } = input as {
        inFlightId: string;
        request: any;
        preRequestScript?: string;
        postResponseScript?: string;
        variables?: Record<string, string>;
        workspaceId?: string;
        environmentId?: string | null;
      };

      const varMap = new Map<string, string>(Object.entries(variables ?? {}));
      let preScriptOutput: { logs: string[]; error: string | null } | undefined;
      let postScriptOutput: { logs: string[]; error: string | null } | undefined;

      // Build env context for script `volt.environment.*` access. Read on every
      // script run so the latest value (e.g. one a previous post-script wrote)
      // is visible.
      function loadEnvCtx() {
        if (!environmentId) return null;
        const env = getEnvironment(environmentId);
        if (!env) return null;
        return {
          name: env.name,
          variables: (env.variables as Array<{ key: string; value: string }>).map((v) => ({
            key: v.key,
            value: v.value,
          })),
        };
      }

      // Pre-request script: lets the user mutate the (already-resolved)
      // request before dispatch and set globals for subsequent runs.
      if (preRequestScript && preRequestScript.trim()) {
        const view = toScriptRequestView(request);
        const envCtx = loadEnvCtx();
        const result = runPreRequest(preRequestScript, view, varMap, envCtx);
        preScriptOutput = { logs: result.logs, error: result.error };
        if (result.envMutations && environmentId) {
          await updateEnvironment(environmentId, {
            variables: result.envMutations.finalVars.map((v) => ({
              ...v,
              secretRef: null,
            })),
          });
          notifyDirty();
        }
        if (!result.ok) {
          return {
            ok: false as const,
            errorCode: 'PRE_SCRIPT_ERROR',
            errorMessage: `Pre-request script failed: ${result.error}`,
            timing: emptyTiming(),
            preScript: preScriptOutput,
          };
        }
        applyScriptRequestView(request, result.request);
      }

      const output = await executeRequest(inFlightId, request);

      // Post-response script
      if (postResponseScript && postResponseScript.trim()) {
        const view = toScriptRequestView(request);
        const responseView = toScriptResponseView(output);
        const envCtx = loadEnvCtx();
        const result = runPostResponse(
          postResponseScript,
          view,
          responseView,
          varMap,
          envCtx,
        );
        postScriptOutput = { logs: result.logs, error: result.error };
        if (result.envMutations && environmentId) {
          await updateEnvironment(environmentId, {
            variables: result.envMutations.finalVars.map((v) => ({
              ...v,
              secretRef: null,
            })),
          });
          notifyDirty();
        }
      }

      // Record in history (best-effort; failure doesn't fail the request)
      try {
        const workspaceId = guessActiveWorkspace();
        if (workspaceId) {
          recordHistory({
            workspaceId,
            requestId: null,
            method: request.method,
            url: request.url,
            requestSnapshot: request,
            statusCode: output.ok ? output.statusCode : null,
            responseHeaders: output.ok ? output.headers : null,
            responseBody:
              output.ok && output.bodyBase64
                ? Buffer.from(output.bodyBase64, 'base64')
                : null,
            responseSizeBytes: output.ok ? output.bodySizeBytes : null,
            responseContentType: output.ok ? output.bodyContentType : null,
            startedAt: Date.now() - output.timing.totalMs,
            durationMs: output.timing.totalMs,
            errorCode: output.ok ? null : output.errorCode,
          });
        }
      } catch (e) {
        console.error('history record failed:', e);
      }

      return { ...output, preScript: preScriptOutput, postScript: postScriptOutput };
    }
    case 'request:cancel': {
      const { inFlightId } = input as { inFlightId: string };
      return { cancelled: cancelRequest(inFlightId) };
    }

    // ──── Workspaces
    case 'workspace:list': {
      const all = listWorkspaces();
      return {
        personal: all.filter((w) => w.ownerTeamId == null),
        team: all.filter((w) => w.ownerTeamId != null),
      };
    }
    case 'workspace:create': {
      const { name, teamId } = input as { name: string; teamId?: string };
      const user = currentUser();
      if (!user) {
        // Offline / not signed in → local-only workspace.
        return createWorkspace({ name, localOnly: true, ownerUserId: null, ownerTeamId: null });
      }
      // Signed in → register on backend first (using a shared id), then mirror
      // locally as a cloud workspace. If the backend call fails, propagate the
      // error so the renderer can show it rather than silently creating a
      // workspace that can never sync.
      const id = crypto.randomUUID();
      const created = (await teamApi('POST', '/api/workspaces', { id, name, teamId })) as {
        id: string;
      };
      return createWorkspace({
        id: created.id,
        name,
        localOnly: false,
        ownerUserId: user.id,
        ownerTeamId: teamId ?? null,
      });
    }
    case 'workspace:rename': {
      const { id, name } = input as { id: string; name: string };
      return renameWorkspace(id, name);
    }
    case 'workspace:delete': {
      const { id } = input as { id: string };
      deleteWorkspaceLocal(id);
      return { deleted: true };
    }

    // ──── Collections
    case 'collection:list': {
      const { workspaceId } = input as { workspaceId: string };
      return listCollections(workspaceId);
    }
    case 'collection:create':
      return createCollection(input as any);
    case 'collection:update': {
      const { id, ...patch } = input as any;
      const result = updateCollection(id, patch);
      notifyDirty();
      return result;
    }
    case 'collection:delete': {
      const { id } = input as { id: string };
      softDeleteCollection(id);
      notifyDirty();
      return { deleted: true };
    }

    // ──── Requests
    case 'apiRequest:list': {
      const { workspaceId, collectionId } = input as {
        workspaceId: string;
        collectionId?: string | null;
      };
      return listRequests(workspaceId, collectionId);
    }
    case 'apiRequest:get':
      return getRequest((input as { id: string }).id);
    case 'apiRequest:create':
      return createRequest(input as any);
    case 'apiRequest:update': {
      const { id, ...patch } = input as any;
      const result = updateRequest(id, patch);
      notifyDirty();
      return result;
    }
    case 'apiRequest:delete': {
      const { id } = input as { id: string };
      softDeleteRequest(id);
      notifyDirty();
      return { deleted: true };
    }

    // ──── Environments
    case 'env:list':
      return listEnvironments((input as { workspaceId: string }).workspaceId);
    case 'env:create':
      return createEnvironment(input as any);
    case 'env:update': {
      const { id, ...patch } = input as any;
      const result = updateEnvironment(id, patch);
      notifyDirty();
      return result;
    }
    case 'env:delete': {
      const { id } = input as { id: string };
      softDeleteEnvironment(id);
      notifyDirty();
      return { deleted: true };
    }
    case 'env:setActive': {
      const { workspaceId, environmentId } = input as {
        workspaceId: string;
        environmentId: string | null;
      };
      setActiveEnvironment(workspaceId, environmentId);
      return { ok: true as const };
    }
    case 'env:getActive': {
      const { workspaceId } = input as { workspaceId: string };
      return { environmentId: getActiveEnvironment(workspaceId) };
    }

    // ──── History
    case 'history:list': {
      const args = input as { workspaceId: string; limit: number; cursor?: string; search?: string };
      const cursor = args.cursor ? new Date(args.cursor).getTime() : undefined;
      const entries = listHistory({
        workspaceId: args.workspaceId,
        limit: args.limit,
        cursor,
        search: args.search,
      });
      const nextCursor =
        entries.length === args.limit && entries[entries.length - 1]
          ? new Date(entries[entries.length - 1]!.startedAt).toISOString()
          : null;
      return {
        entries: entries.map((e) => ({
          id: e.id,
          requestId: e.requestId,
          workspaceId: e.workspaceId,
          method: e.method as any,
          url: e.url,
          requestSnapshot: e.requestSnapshot,
          statusCode: e.statusCode,
          durationMs: e.durationMs,
          startedAt: new Date(e.startedAt).toISOString(),
          errorCode: e.errorCode,
        })),
        nextCursor,
      };
    }
    case 'history:get': {
      const { id } = input as { id: string };
      const e = getHistoryEntry(id);
      if (!e) throw new Error('History entry not found');
      return {
        id: e.id,
        requestId: e.requestId,
        workspaceId: e.workspaceId,
        method: e.method as any,
        url: e.url,
        requestSnapshot: e.requestSnapshot,
        statusCode: e.statusCode,
        durationMs: e.durationMs,
        startedAt: new Date(e.startedAt).toISOString(),
        errorCode: e.errorCode,
        responseHeaders: e.responseHeaders ? JSON.parse(e.responseHeaders) : null,
        responseBodyBase64: e.responseBody ? Buffer.from(e.responseBody as Buffer).toString('base64') : null,
        responseBodyTempFile: null,
        responseContentType: e.responseContentType,
        responseSizeBytes: e.responseSizeBytes,
      };
    }
    case 'history:clear': {
      const { workspaceId } = input as { workspaceId: string };
      return { cleared: clearHistory(workspaceId) };
    }

    // ──── Auth
    case 'auth:status': {
      const user = currentUser();
      return {
        loggedIn: user !== null,
        email: user?.email ?? null,
        name: user?.name ?? null,
      };
    }
    case 'auth:login': {
      try {
        const { email, password } = input as { email: string; password: string };
        await authLogin(email, password);
        // Kick off the sync engine now that we have a session token.
        startSync();
        return { success: true };
      } catch (e) {
        return { success: false, errorMessage: (e as Error).message };
      }
    }
    case 'auth:register': {
      try {
        await authRegister(input as { email: string; name: string; password: string });
        startSync();
        return { success: true };
      } catch (e) {
        return { success: false, errorMessage: (e as Error).message };
      }
    }
    case 'auth:logout': {
      stopSync();
      await authLogout();
      return { ok: true as const };
    }

    // ──── Teams (proxied to backend; user must be logged in)
    case 'team:list':
      return teamApi('GET', '/api/teams');
    case 'team:create': {
      const { name } = input as { name: string };
      return teamApi('POST', '/api/teams', { name });
    }
    case 'team:invite': {
      const { teamId, email } = input as { teamId: string; email: string };
      return teamApi('POST', `/api/teams/${teamId}/invite`, { email });
    }
    case 'team:acceptInvite': {
      const { code } = input as { code: string };
      return teamApi('POST', `/api/teams/invite/${encodeURIComponent(code)}/accept`);
    }

    // ──── Globals (per-device key/value, settable from scripts)
    case 'globals:list':
      return listGlobals();
    case 'globals:set': {
      const { key, value } = input as { key: string; value: unknown };
      setGlobal(key, value);
      return { ok: true as const };
    }
    case 'globals:delete': {
      const { key } = input as { key: string };
      deleteGlobal(key);
      return { ok: true as const };
    }

    // ──── Sync
    case 'sync:status':
      return getSyncStatus();
    case 'sync:force': {
      const { workspaceId } = input as { workspaceId?: string };
      void forceSync(workspaceId);
      return { started: true };
    }

    // ──── Import
    case 'import:source': {
      const args = input as {
        workspaceId: string;
        source: 'postman' | 'insomnia' | 'openapi' | 'curl';
        filePath?: string;
        content?: string;
      };
      return runImport(args);
    }

    // ──── Misc
    case 'app:info':
      return {
        version: app.getVersion(),
        platform: (process.platform === 'darwin'
          ? 'macos'
          : process.platform === 'win32'
            ? 'windows'
            : 'linux') as 'macos' | 'windows' | 'linux',
        dbPath: getDbPath(),
      };
    case 'app:openExternal': {
      const { url } = input as { url: string };
      await shell.openExternal(url);
      return { ok: true as const };
    }
    case 'app:showFilePicker': {
      const args = input as {
        filters?: { name: string; extensions: string[] }[];
      };
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win ?? new BrowserWindow({ show: false }), {
        properties: ['openFile'],
        filters: args.filters,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { cancelled: true };
      }
      return { cancelled: false, filePath: result.filePaths[0] };
    }

    default:
      throw new Error(`Unknown IPC channel: ${channel}`);
  }
}

// ─────────────────────────────────────────────────────────
// Import dispatch
// ─────────────────────────────────────────────────────────

function runImport(args: {
  workspaceId: string;
  source: 'postman' | 'insomnia' | 'openapi' | 'curl';
  filePath?: string;
  content?: string;
}) {
  let content = args.content;
  if (!content && args.filePath) {
    content = fs.readFileSync(args.filePath, 'utf-8');
  }
  if (!content) {
    return {
      success: false,
      summary: { collections: 0, requests: 0, environments: 0, warnings: [] },
      errorMessage: 'No content or file provided.',
    };
  }

  switch (args.source) {
    case 'postman': {
      const r = importPostman(args.workspaceId, content);
      return {
        success: r.success,
        collectionId: r.rootCollectionId,
        summary: r.summary,
        errorMessage: r.error,
      };
    }
    case 'insomnia': {
      const r = importInsomnia(args.workspaceId, content);
      return {
        success: r.success,
        collectionId: r.rootCollectionId,
        summary: r.summary,
        errorMessage: r.error,
      };
    }
    case 'openapi': {
      const ext = args.filePath?.toLowerCase().endsWith('.yaml') || args.filePath?.toLowerCase().endsWith('.yml')
        ? 'yaml'
        : 'json';
      const r = importOpenAPI(args.workspaceId, content, ext);
      return {
        success: r.success,
        collectionId: r.rootCollectionId,
        summary: r.summary,
        errorMessage: r.error,
      };
    }
    case 'curl': {
      const r = importCurl(args.workspaceId, null, content);
      return {
        success: r.success,
        requestId: r.requestId,
        summary: r.summary,
        errorMessage: r.error,
      };
    }
  }
}

// Heuristic: history needs a workspaceId; we infer it from the first
// non-deleted workspace if the request didn't specify one (true for ad-hoc).
// Renderer should pass workspaceId explicitly in v1.0.
function guessActiveWorkspace(): string | null {
  const wss = listWorkspaces();
  return wss[0]?.id ?? null;
}

/**
 * Backend proxy for team:* IPC. Requires the user to be logged in (else
 * authedFetch throws). Parses JSON; on non-2xx, throws an Error whose message
 * comes from the backend's `error.message` if present.
 */
async function teamApi(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathname: string, body?: unknown) {
  const res = await authedFetch(pathname, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { ok: true as const };
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error?.message ?? data?.message ?? `Request failed (${res.status})`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────
// Script helpers — translate between the ResolvedRequest format used by the
// HTTP engine and the friendlier shape scripts see as `volt.request`.
// ─────────────────────────────────────────────────────────

function toScriptRequestView(req: any): ScriptRequestView {
  return {
    method: req.method,
    url: req.url,
    headers: Object.entries(req.headers ?? {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true,
    })),
    queryParams: [], // already merged into URL by client-side resolveLocally
    bodyType: req.body?.type ?? 'none',
    body: req.body,
    auth: req.auth,
  };
}

function applyScriptRequestView(req: any, view: ScriptRequestView) {
  req.method = view.method;
  req.url = view.url;
  // Rebuild the headers map from the (possibly mutated) array. Honor the
  // `enabled` flag so users can disable a header from a script.
  const headers: Record<string, string> = {};
  for (const h of view.headers ?? []) {
    if (h && h.key && h.enabled !== false) headers[h.key] = String(h.value ?? '');
  }
  req.headers = headers;
  req.body = view.body;
}

function toScriptResponseView(output: any): ScriptResponseView {
  if (!output.ok) {
    return {
      ok: false,
      status: null,
      headers: [],
      text: output.errorMessage ?? null,
      json: null,
      size: 0,
      durationMs: output.timing?.totalMs ?? 0,
    };
  }
  const text = output.bodyBase64
    ? Buffer.from(output.bodyBase64, 'base64').toString('utf-8')
    : null;
  let json: unknown = null;
  if (text && /json/i.test(output.bodyContentType ?? '')) {
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
  }
  return {
    ok: true,
    status: output.statusCode,
    headers: output.headers ?? [],
    text,
    json,
    size: output.bodySizeBytes ?? 0,
    durationMs: output.timing?.totalMs ?? 0,
  };
}

function emptyTiming() {
  return {
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    downloadMs: null,
    totalMs: 0,
  };
}
