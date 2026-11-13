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
  duplicateCollection,
  getActiveEnvironment,
  getAutoHeaders,
  getEnvironment,
  getHistoryEntry,
  getRequest,
  getWorkspace,
  listCollections,
  listEnvironments,
  listGlobals,
  listHistory,
  listRequests,
  listWorkspaces,
  recordHistory,
  renameWorkspace,
  setActiveEnvironment,
  setAutoHeaders,
  setGlobal,
  softDeleteCollection,
  softDeleteEnvironment,
  softDeleteRequest,
  updateCollection,
  updateEnvironment,
  updateRequest,
  clearHistory,
  listActiveConflicts,
  dismissConflict,
  getConflictById,
} from '../core/db/queries';
import { getDbPath } from '../core/db/connection';
import { getSecret } from '../core/auth/keychain';
import { authedFetch, currentUser, login as authLogin, logout as authLogout, register as authRegister } from '../core/auth/manager';
import { executeRequest, cancelRequest } from '../core/http/engine';
import {
  completeWidgetRun,
  getWidgetFavorites,
  isWidgetSupported,
  markRendererReady,
  recordWidgetResult,
  scheduleSnapshot,
  setWidgetFavorite,
} from '../core/widget/bridge';
import { wsClose, wsOpen, wsSend } from '../core/http/ws';
import {
  invokeUnary,
  loadProto,
  openStream as grpcOpenStream,
  streamClose as grpcStreamClose,
  streamHalfClose as grpcStreamHalfClose,
  streamSend as grpcStreamSend,
} from '../core/grpc/engine';
import { getMockStatus, startMockServer, stopMockServer } from '../core/mock/server';
import {
  applyTransformer,
  ensurePluginsFolder,
  listPlugins,
  loadAllPlugins,
  pluginsDir,
} from '../core/plugins/runtime';
import {
  buildAuthCodeUrl,
  ensureToken,
  exchangeAuthCode,
} from '../core/auth/oauth';
import {
  runPostResponse,
  runPreRequest,
  type ScriptRequestView,
  type ScriptResponseView,
  type ScriptTestResult,
} from '../core/scripts/runner';
import { resolveRequest } from '../core/http/resolve';
import { forceSync, getSyncStatus, notifyDirty, startSync, stopSync, refreshRemoteWorkspaces } from '../core/sync/engine';
import { importPostman } from '../core/import/postman';
import { importInsomnia } from '../core/import/insomnia';
import { importOpenAPI } from '../core/import/openapi';
import { importCurl } from '../core/import/curl';
import { importHar } from '../core/import/har';
import { exportPostman } from '../core/export/postman';
import { exportInsomnia } from '../core/export/insomnia';
import { exportOpenAPI } from '../core/export/openapi';
import { exportDocs } from '../core/export/docs';

const WIDGET_SNAPSHOT_CHANNELS =
  /^(apiRequest:(update|delete)|collection:(update|delete)|workspace:(rename|delete)|env:(setActive|update|delete))$/;

export function registerIpcHandlers() {
  // Generic handler wrapper: validates input via contract, catches errors.
  for (const channel of Object.keys(IPC) as IpcChannel[]) {
    ipcMain.handle(channel, async (event, rawInput) => {
      const contract = IPC[channel];
      // Log the channel only: inputs carry passwords, tokens, client
      // secrets and request bodies, which must never reach the console/logs.
      console.log(`[ipc] <- ${channel}`);
      try {
        // Renderer may invoke no-arg channels as `volt['auth:status']()`,
        // which arrives here as `undefined`. Treat that as `{}` so empty-object
        // schemas don't reject it.
        const parsed = contract.input.parse(rawInput ?? {});
        // The widget bridge needs to know which renderer to send runs to.
        if (channel === 'widget:ready') markRendererReady(event.sender);
        const result = await dispatch(channel, parsed as never);
        // Names, methods, collections or the active env may have changed —
        // refresh the desktop widget (debounced, no-op when unchanged).
        if (WIDGET_SNAPSHOT_CHANNELS.test(channel)) scheduleSnapshot();
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
        requestName,
        requestId,
      } = input as {
        inFlightId: string;
        request: any;
        preRequestScript?: string;
        postResponseScript?: string;
        variables?: Record<string, string>;
        workspaceId?: string;
        environmentId?: string | null;
        requestName?: string;
        requestId?: string | null;
      };
      const scriptOptions = { requestName, requestId };

      const varMap = new Map<string, string>(Object.entries(variables ?? {}));
      let preScriptOutput: ScriptOutputView | undefined;
      let postScriptOutput: ScriptOutputView | undefined;

      // Build env context for script `volt.environment.*` access. Read on every
      // script run so the latest value (e.g. one a previous post-script wrote)
      // is visible.
      function loadEnvCtx() {
        if (!environmentId) return null;
        const env = getEnvironment(environmentId);
        if (!env) return null;
        return {
          name: env.name,
          // Full rows: the runner skips `enabled: false` vars in pm.environment.get
          // and carries the other flags through to write-back.
          variables: (env.variables as Array<{ key: string; value: string }>).map((v) => ({
            ...v,
          })),
        };
      }

      // Pre-request script: lets the user mutate the (already-resolved)
      // request before dispatch and set globals for subsequent runs.
      if (preRequestScript && preRequestScript.trim()) {
        const view = toScriptRequestView(request);
        const envCtx = loadEnvCtx();
        const result = await runPreRequest(preRequestScript, view, varMap, envCtx, scriptOptions);
        preScriptOutput = { logs: result.logs, error: result.error, tests: result.tests };
        if (result.envMutations && environmentId) {
          await updateEnvironment(environmentId, {
            variables: mergeScriptEnvVars(environmentId, result.envMutations.finalVars),
          });
          notifyDirty();
        }
        if (!result.ok) {
          recordWidgetResult(requestId, { ok: false, errorMessage: `Pre-request script failed` });
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
        const result = await runPostResponse(
          postResponseScript,
          view,
          responseView,
          varMap,
          envCtx,
          scriptOptions,
        );
        postScriptOutput = { logs: result.logs, error: result.error, tests: result.tests };
        if (result.envMutations && environmentId) {
          await updateEnvironment(environmentId, {
            variables: mergeScriptEnvVars(environmentId, result.envMutations.finalVars),
          });
          notifyDirty();
        }
      }

      // Record in history (best-effort; failure doesn't fail the request)
      try {
        // Prefer the workspace the renderer sent; guessActiveWorkspace() is
        // only a fallback for old callers (it picks the first workspace in
        // the DB, which is wrong as soon as there's more than one).
        const sent = input as { workspaceId?: string; requestId?: string | null };
        const workspaceId = sent.workspaceId ?? guessActiveWorkspace();
        if (workspaceId) {
          recordHistory({
            workspaceId,
            requestId: sent.requestId ?? null,
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
            startedAt: Date.now() - (output.timing?.totalMs ?? 0),
            durationMs: output.timing?.totalMs ?? 0,
            errorCode: output.ok ? null : output.errorCode,
          });
        }
      } catch (e) {
        console.error('history record failed:', e);
      }

      recordWidgetResult(requestId, output);
      return { ...output, preScript: preScriptOutput, postScript: postScriptOutput };
    }
    case 'ws:open': {
      // headers/protocols are forwarded when the contract carries them.
      const { url, headers, protocols } = input as {
        url: string;
        headers?: Record<string, string>;
        protocols?: string[];
      };
      return wsOpen(url, { headers, protocols });
    }
    case 'ws:send': {
      const { connectionId, text } = input as { connectionId: string; text: string };
      return wsSend(connectionId, text);
    }
    case 'ws:close': {
      const { connectionId, code, reason } = input as { connectionId: string; code?: number; reason?: string };
      return wsClose(connectionId, code, reason);
    }
    case 'grpc:loadProto': {
      const { protoPath } = input as { protoPath: string };
      return loadProto(protoPath);
    }
    case 'grpc:invoke': {
      return invokeUnary(
        input as {
          address: string;
          protoPath: string;
          service: string;
          method: string;
          message: string;
          metadata?: Record<string, string>;
          timeoutMs?: number;
        },
      );
    }
    case 'grpc:openStream': {
      return grpcOpenStream(
        input as {
          address: string;
          protoPath: string;
          service: string;
          method: string;
          message?: string;
          metadata?: Record<string, string>;
        },
      );
    }
    case 'grpc:streamSend': {
      const { connectionId, message } = input as { connectionId: string; message: string };
      return grpcStreamSend(connectionId, message);
    }
    case 'grpc:streamHalfClose': {
      const { connectionId } = input as { connectionId: string };
      return grpcStreamHalfClose(connectionId);
    }
    case 'grpc:streamClose': {
      const { connectionId } = input as { connectionId: string };
      return grpcStreamClose(connectionId);
    }
    case 'mock:status': {
      return getMockStatus();
    }
    case 'mock:start': {
      const { port } = input as { port?: number };
      return startMockServer(port);
    }
    case 'mock:stop': {
      return stopMockServer();
    }
    case 'plugins:list': {
      return { plugins: listPlugins(), dir: pluginsDir() };
    }
    case 'plugins:reload': {
      const result = loadAllPlugins();
      return { ...result, plugins: listPlugins() };
    }
    case 'plugins:openFolder': {
      const dir = ensurePluginsFolder();
      void shell.openPath(dir);
      return { ok: true, dir };
    }
    case 'plugins:applyTransformer': {
      return applyTransformer(
        input as {
          transformerId: string;
          body: string;
          contentType: string | null;
          headers?: Record<string, string>;
        },
      );
    }
    case 'request:cancel': {
      const { inFlightId } = input as { inFlightId: string };
      return { cancelled: cancelRequest(inFlightId) };
    }
    case 'response:saveBody': {
      const { defaultName, contentBase64, tempPath } = input as {
        defaultName: string;
        contentBase64?: string | null;
        tempPath?: string | null;
      };
      try {
        const window = BrowserWindow.getFocusedWindow();
        const save = await dialog.showSaveDialog(window ?? undefined!, {
          title: 'Save response',
          defaultPath: defaultName,
        });
        if (save.canceled || !save.filePath) {
          return { success: false, cancelled: true };
        }
        if (contentBase64) {
          fs.writeFileSync(save.filePath, Buffer.from(contentBase64, 'base64'));
        } else if (tempPath) {
          fs.copyFileSync(tempPath, save.filePath);
        } else {
          return { success: false, errorMessage: 'No response body to save.' };
        }
        return { success: true, path: save.filePath };
      } catch (e) {
        return { success: false, errorMessage: (e as Error).message };
      }
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
      const ws = createWorkspace({
        id: created.id,
        name,
        localOnly: false,
        ownerUserId: user.id,
        ownerTeamId: teamId ?? null,
      });
      // Open its live stream and record it as known for this account.
      void refreshRemoteWorkspaces().catch(() => undefined);
      return ws;
    }
    case 'workspace:rename': {
      const { id, name } = input as { id: string; name: string };
      const ws = getWorkspace(id);
      // Cloud workspace: rename on the server first so teammates get it; a
      // failure surfaces to the renderer instead of diverging silently.
      if (ws && !ws.localOnly && currentUser()) {
        await teamApi('PATCH', `/api/workspaces/${id}`, { name });
      }
      return renameWorkspace(id, name);
    }
    case 'workspace:delete': {
      const { id } = input as { id: string };
      const ws = getWorkspace(id);
      if (ws && !ws.localOnly && currentUser()) {
        // Server-side soft delete (30-day recovery); teammates drop it on
        // their next workspace refresh.
        await teamApi('DELETE', `/api/workspaces/${id}`);
      }
      deleteWorkspaceLocal(id);
      return { deleted: true };
    }

    // ──── Collections
    case 'collection:list': {
      const { workspaceId } = input as { workspaceId: string };
      return listCollections(workspaceId);
    }
    case 'collection:create': {
      const result = createCollection(input as any);
      notifyDirty();
      return result;
    }
    case 'collection:duplicate': {
      const { id } = input as { id: string };
      const result = duplicateCollection(id);
      if (!result) throw new Error('Collection not found');
      notifyDirty();
      return result;
    }
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
    case 'collection:export': {
      const { workspaceId, collectionId, format } = input as {
        workspaceId: string;
        collectionId?: string;
        format: 'postman' | 'insomnia' | 'openapi' | 'markdown';
      };
      try {
        const { content, filename } =
          format === 'postman'
            ? exportPostman(workspaceId, collectionId ?? null)
            : format === 'insomnia'
              ? exportInsomnia(workspaceId, collectionId ?? null)
              : format === 'openapi'
                ? exportOpenAPI(workspaceId, collectionId ?? null)
                : exportDocs(workspaceId, collectionId ?? null);
        const window = BrowserWindow.getFocusedWindow();
        const isMd = format === 'markdown';
        const save = await dialog.showSaveDialog(window ?? undefined!, {
          title: `Export as ${format}`,
          defaultPath: filename,
          filters: isMd
            ? [{ name: 'Markdown', extensions: ['md'] }]
            : [{ name: 'JSON', extensions: ['json'] }],
        });
        if (save.canceled || !save.filePath) {
          return { success: false, cancelled: true };
        }
        fs.writeFileSync(save.filePath, content, 'utf-8');
        return { success: true, path: save.filePath };
      } catch (e) {
        return { success: false, errorMessage: (e as Error).message };
      }
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
    case 'apiRequest:create': {
      const result = createRequest(input as any);
      notifyDirty();
      return result;
    }
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
    case 'env:create': {
      const created = createEnvironment(input as any);
      notifyDirty();
      return created;
    }
    case 'env:update': {
      const { id, ...patch } = input as any;
      const result = updateEnvironment(id, patch);
      notifyDirty();
      return result;
    }
    case 'env:delete': {
      const { id } = input as { id: string };
      // Don't leave a dangling active-environment pointer behind.
      const doomed = getEnvironment(id);
      if (doomed && getActiveEnvironment(doomed.workspaceId) === id) {
        setActiveEnvironment(doomed.workspaceId, null);
      }
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
      const accepted = await teamApi('POST', `/api/teams/invite/${encodeURIComponent(code)}/accept`);
      // Pull in the team's workspaces right away instead of on the next tick.
      await refreshRemoteWorkspaces().catch((e) => console.warn('[sync] refresh after invite failed:', (e as Error).message));
      return accepted;
    }
    case 'team:billing': {
      const { teamId } = input as { teamId: string };
      return teamApi('GET', `/api/teams/${teamId}/billing`);
    }
    case 'team:billingCheckout': {
      const { teamId } = input as { teamId: string };
      const result = await teamApi('POST', `/api/teams/${teamId}/billing/checkout`);
      // Convenience: open the Stripe checkout page directly so the user
      // doesn't have to manually copy-paste a URL out of the modal.
      const url = (result as { url?: string })?.url;
      if (url) void shell.openExternal(url);
      return result;
    }
    case 'team:billingPortal': {
      const { teamId } = input as { teamId: string };
      const result = await teamApi('POST', `/api/teams/${teamId}/billing/portal`);
      const url = (result as { url?: string })?.url;
      if (url) void shell.openExternal(url);
      return result;
    }
    case 'team:auditLog': {
      const { teamId, limit } = input as { teamId: string; limit?: number };
      const q = limit ? `?limit=${limit}` : '';
      return teamApi('GET', `/api/teams/${teamId}/audit-log${q}`);
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

    case 'oauth:ensureToken': {
      const cfg = input as Parameters<typeof ensureToken>[0];
      try {
        const t = await ensureToken(cfg);
        if (!t) {
          return {
            ok: false,
            error:
              cfg.grant === 'authorization_code'
                ? 'No OAuth token cached (or it expired and could not be refreshed). Open the Auth tab and complete the authorization code flow.'
                : 'OAuth token request returned no token.',
          };
        }
        return {
          ok: true,
          accessToken: t.accessToken,
          tokenType: t.tokenType,
          expiresAt: t.expiresAt,
        };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
    case 'oauth:getAuthUrl': {
      const cfg = input as Parameters<typeof buildAuthCodeUrl>[0];
      return buildAuthCodeUrl(cfg);
    }
    case 'oauth:exchangeCode': {
      const cfg = input as Parameters<typeof exchangeAuthCode>[0] & { code: string; verifier: string };
      try {
        const t = await exchangeAuthCode(cfg, cfg.code, cfg.verifier);
        if (!t) return { ok: false, error: 'Exchange failed' };
        return { ok: true, accessToken: t.accessToken };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case 'autoHeaders:get':
      return getAutoHeaders();
    case 'autoHeaders:set': {
      const { items } = input as { items: Parameters<typeof setAutoHeaders>[0] };
      setAutoHeaders(items);
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
    case 'conflict:list': {
      const { workspaceId } = input as { workspaceId: string };
      const rows = listActiveConflicts(workspaceId);
      return rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        table: r.table as 'collection' | 'request' | 'environment',
        rowId: r.rowId,
        previousState: parseConflictPrevState(r.previousState),
        overwrittenByName: r.overwrittenByName,
        overwrittenByUserId: r.overwrittenByUserId,
        overwrittenAt: r.overwrittenAt,
        dismissedAt: r.dismissedAt,
      }));
    }
    case 'conflict:dismiss': {
      const { id } = input as { id: string };
      dismissConflict(id);
      return { ok: true as const };
    }
    case 'conflict:restore': {
      // "Restore mine" — re-apply the captured previousState to the local
      // row, dismiss the conflict, mark the row dirty so the next push
      // sends it back to the server. We do NOT call the backend conflict
      // log endpoint: that one's for backend-side concurrent pushes; ours
      // is a local-history of pull-overwrites.
      const { id } = input as { id: string };
      const row = getConflictById(id);
      if (!row) return { ok: false, error: 'Conflict not found.' };
      const prev = parseConflictPrevState(row.previousState) as Record<string, unknown> | null;
      if (!prev || typeof prev !== 'object') {
        return { ok: false, error: 'Conflict has no previous state.' };
      }
      try {
        if (row.table === 'collection') {
          updateCollection(row.rowId, prev as never);
        } else if (row.table === 'request') {
          updateRequest(row.rowId, prev as never);
        } else if (row.table === 'environment') {
          updateEnvironment(row.rowId, prev as never);
        }
        dismissConflict(id);
        notifyDirty();
        // Force a push so the user sees their change re-applied on the
        // server within a second instead of the periodic 5s window.
        void forceSync(row.workspaceId);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    // ──── Import
    case 'import:source': {
      const args = input as {
        workspaceId: string;
        source: 'postman' | 'insomnia' | 'openapi' | 'curl' | 'har';
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
    case 'app:readFileText': {
      const { filePath, maxBytes } = input as { filePath: string; maxBytes?: number };
      const cap = maxBytes ?? 4 * 1024 * 1024;
      try {
        const fd = fs.openSync(filePath, 'r');
        try {
          const stat = fs.fstatSync(fd);
          const toRead = Math.min(cap, stat.size);
          const buf = Buffer.alloc(toRead);
          fs.readSync(fd, buf, 0, toRead, 0);
          return {
            content: buf.toString('utf-8'),
            truncated: stat.size > toRead,
          };
        } finally {
          fs.closeSync(fd);
        }
      } catch (e) {
        return { content: '', truncated: false, error: (e as Error).message };
      }
    }

    // ──── Desktop widget
    case 'widget:favorites':
      return { requestIds: getWidgetFavorites(), supported: isWidgetSupported() };
    case 'widget:setFavorite': {
      const { requestId, favorite } = input as { requestId: string; favorite: boolean };
      return { requestIds: setWidgetFavorite(requestId, favorite) };
    }
    case 'widget:ready':
      return { ok: true };
    case 'widget:runResult': {
      const { runId, ok, error } = input as { runId: string; ok: boolean; error?: string };
      completeWidgetRun(runId, { ok, error });
      return { ok: true };
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
  source: 'postman' | 'insomnia' | 'openapi' | 'curl' | 'har';
  filePath?: string;
  content?: string;
}) {
  const emptySummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  // Guard against stale workspaceIds (workspace deleted locally or via sync
  // while the renderer still holds the id). Without this the SQLite insert
  // bubbles up as a raw "FOREIGN KEY constraint failed" through the IPC.
  if (!getWorkspace(args.workspaceId)) {
    return {
      success: false,
      summary: emptySummary,
      errorMessage:
        'Selected workspace no longer exists. Pick a workspace from the sidebar and try again.',
    };
  }

  let content = args.content;
  if (!content && args.filePath) {
    try {
      content = fs.readFileSync(args.filePath, 'utf-8');
    } catch (e) {
      return {
        success: false,
        summary: emptySummary,
        errorMessage: `Couldn't read file: ${(e as Error).message}`,
      };
    }
  }
  if (!content) {
    return {
      success: false,
      summary: emptySummary,
      errorMessage: 'No content or file provided.',
    };
  }

  try {
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
      case 'har': {
        const r = importHar(args.workspaceId, content);
        return {
          success: r.success,
          collectionId: r.rootCollectionId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    // FK failures are almost always a workspace race (deleted between the
    // up-front check and the inserts). Surface a friendly message instead of
    // the raw SqliteError that the renderer would otherwise show.
    const isFkFail =
      err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
      /FOREIGN KEY constraint failed/i.test(err.message);
    return {
      success: false,
      summary: emptySummary,
      errorMessage: isFkFail
        ? 'Import target is missing. The selected workspace may have been removed — pick a workspace and try again.'
        : `Import failed: ${err.message}`,
    };
  }
}

// Heuristic: history needs a workspaceId; we infer it from the first
// non-deleted workspace if the request didn't specify one (true for ad-hoc).
// Renderer should pass workspaceId explicitly in v1.0.
function parseConflictPrevState(s: unknown): unknown {
  if (typeof s !== 'string') return s ?? null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

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

/**
 * Scripts only see `{key, value}` pairs. When writing their result back, keep
 * the per-variable flags (`enabled`, `secret`) the user set in the env editor
 * for keys that already existed; brand-new keys are enabled and not secret.
 */
function mergeScriptEnvVars(
  environmentId: string,
  finalVars: Array<{ key: string; value: string }>,
) {
  const existing = new Map<string, Record<string, unknown>>();
  const env = getEnvironment(environmentId);
  for (const v of (env?.variables ?? []) as Array<Record<string, unknown>>) {
    if (typeof v.key === 'string') existing.set(v.key, v);
  }
  return finalVars.map((v) => {
    const prev = existing.get(v.key);
    // Only a key the script actually wrote loses its keychain ref (its value
    // now lives in plain text); untouched keys keep enabled/secret/secretRef.
    const changed = !prev || prev.value !== v.value;
    return {
      ...(prev ?? { enabled: true }),
      key: v.key,
      value: v.value,
      ...(changed ? { enabled: true, secretRef: null } : {}),
    };
  });
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

/** Shape of `preScript` / `postScript` on the send result (ScriptOutput + test results). */
interface ScriptOutputView {
  logs: string[];
  error: string | null;
  tests: ScriptTestResult[];
}

function toScriptResponseView(output: any): ScriptResponseView {
  if (!output.ok) {
    return {
      ok: false,
      status: null,
      statusText: '',
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
    statusText: output.statusText ?? '',
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
