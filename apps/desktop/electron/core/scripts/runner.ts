// Sandboxed pre-request / post-response script runner.
//
// Scripts run in a fresh Node `vm` context with a curated `volt` object and
// minimal globals. They can:
//   - read/mutate `volt.request` (pre-request only — used to override URL,
//     headers, body, etc. before variable substitution + dispatch)
//   - read `volt.response` (post-response only — status, headers, decoded body,
//     timing)
//   - read/write persisted globals via `volt.globals.{get,set,unset,has,all}`
//   - log via `console.log` (logs are captured and returned to the caller)
//
// Scripts execute synchronously. A 2s wall-clock timeout protects against
// runaway loops. Errors are caught and returned as a string so the renderer can
// surface them in the response panel.

import vm from 'node:vm';

import {
  deleteGlobal,
  getGlobal,
  listGlobals,
  setGlobal,
} from '../db/queries';

export interface ScriptRequestView {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>;
  bodyType: string;
  body: unknown;
  auth: unknown;
}

export interface ScriptResponseView {
  ok: boolean;
  status: number | null;
  headers: Array<[string, string]>;
  /** Decoded text body, or null if binary / empty. */
  text: string | null;
  /** Parsed JSON body, or null if the response wasn't JSON or parsing failed. */
  json: unknown;
  size: number;
  durationMs: number;
}

export interface ScriptResult<T extends 'pre' | 'post'> {
  ok: boolean;
  /** Captured console.log output, one entry per call (args coerced to strings). */
  logs: string[];
  /** Error message if the script threw. */
  error: string | null;
  /** For pre-request: the (possibly mutated) request view. */
  request: T extends 'pre' ? ScriptRequestView : undefined;
  /**
   * Pending mutations to the active environment's variables. The caller (IPC
   * handler) persists these via updateEnvironment so changes show up in
   * variable substitution and sync to the backend.
   */
  envMutations: {
    /** key → new value (or null to delete). Keys not present are unchanged. */
    changes: Record<string, string | null>;
    /** Snapshot of env vars after script ran, in declaration order. */
    finalVars: Array<{ key: string; value: string }>;
  } | null;
}

export interface EnvContext {
  /** Active environment name (read-only in scripts). */
  name: string;
  /** Initial variable list when the script started. */
  variables: Array<{ key: string; value: string }>;
}

const TIMEOUT_MS = 2000;

function buildVoltApi(
  phase: 'pre' | 'post',
  variables: Map<string, string>,
  request: ScriptRequestView | null,
  response: ScriptResponseView | null,
  envCtx: EnvContext | null,
  envChanges: Record<string, string | null>,
  envWorking: Array<{ key: string; value: string }>,
) {
  const envApi = envCtx
    ? {
        name: envCtx.name,
        get: (key: string): string | undefined => {
          const row = envWorking.find((v) => v.key === key);
          return row?.value;
        },
        has: (key: string): boolean => envWorking.some((v) => v.key === key),
        all: (): Record<string, string> => {
          const out: Record<string, string> = {};
          for (const v of envWorking) out[v.key] = v.value;
          return out;
        },
        set: (key: string, value: unknown): void => {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value ?? '');
          envChanges[key] = stringValue;
          const existing = envWorking.find((v) => v.key === key);
          if (existing) existing.value = stringValue;
          else envWorking.push({ key, value: stringValue });
        },
        unset: (key: string): void => {
          envChanges[key] = null;
          const idx = envWorking.findIndex((v) => v.key === key);
          if (idx >= 0) envWorking.splice(idx, 1);
        },
      }
    : {
        // No active env — give a useful error instead of a confusing
        // "envApi.set is not a function".
        name: null,
        get: () => undefined,
        has: () => false,
        all: () => ({}),
        set: () => {
          throw new Error(
            'volt.environment.set requires an active environment — ' +
              'pick one from the env dropdown in the top bar first.',
          );
        },
        unset: () => {
          throw new Error('volt.environment.unset requires an active environment.');
        },
      };

  const volt: Record<string, unknown> = {
    globals: {
      get: (key: string) => getGlobal(key),
      set: (key: string, value: unknown) => setGlobal(key, value),
      unset: (key: string) => deleteGlobal(key),
      has: (key: string) => getGlobal(key) !== undefined,
      all: () => listGlobals(),
    },
    environment: envApi,
    variables: {
      get: (key: string): string | undefined => variables.get(key),
    },
    request: request ?? undefined,
  };
  if (phase === 'post') {
    volt.response = response ?? undefined;
  } else {
    // Pre-request: response doesn't exist yet. Trap access so the user gets a
    // clear "wrong tab" message instead of a cryptic TypeError on
    // `volt.response.json`.
    Object.defineProperty(volt, 'response', {
      get() {
        throw new Error(
          'volt.response is only available in the Post-response script — ' +
            'the response has not been received yet in a pre-request script.',
        );
      },
      configurable: true,
      enumerable: true,
    });
  }
  return volt;
}

export function runPreRequest(
  script: string,
  request: ScriptRequestView,
  variables: Map<string, string>,
  env: EnvContext | null,
): ScriptResult<'pre'> {
  if (!script.trim()) {
    return { ok: true, logs: [], error: null, request, envMutations: null };
  }
  return runScript('pre', script, request, null, variables, env, (volt, logs) => ({
    ok: true,
    logs,
    error: null,
    request,
    envMutations: null, // filled in by runScript
  }));
}

export function runPostResponse(
  script: string,
  request: ScriptRequestView,
  response: ScriptResponseView,
  variables: Map<string, string>,
  env: EnvContext | null,
): ScriptResult<'post'> {
  if (!script.trim()) {
    return { ok: true, logs: [], error: null, request: undefined, envMutations: null };
  }
  return runScript('post', script, request, response, variables, env, (_volt, logs) => ({
    ok: true,
    logs,
    error: null,
    request: undefined as never,
    envMutations: null,
  }));
}

function runScript<T extends 'pre' | 'post'>(
  phase: T,
  script: string,
  request: ScriptRequestView,
  response: ScriptResponseView | null,
  variables: Map<string, string>,
  env: EnvContext | null,
  baseResult: (volt: Record<string, unknown>, logs: string[]) => ScriptResult<T>,
): ScriptResult<T> {
  const logs: string[] = [];
  const envChanges: Record<string, string | null> = {};
  const envWorking = env ? env.variables.map((v) => ({ ...v })) : [];
  const volt = buildVoltApi(phase, variables, request, response, env, envChanges, envWorking);
  const sandbox = {
    volt,
    console: makeConsole(logs),
    JSON,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    Buffer,
    URL,
    URLSearchParams,
  };
  let ok = true;
  let error: string | null = null;
  try {
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox, { timeout: TIMEOUT_MS, displayErrors: true });
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }
  const result = baseResult(volt, logs);
  result.ok = ok;
  result.error = error;
  result.logs = logs;
  result.envMutations = env && Object.keys(envChanges).length > 0
    ? { changes: envChanges, finalVars: envWorking }
    : null;
  return result;
}

function makeConsole(sink: string[]) {
  const append = (level: string, args: unknown[]) => {
    const formatted = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
    sink.push(`[${level}] ${formatted}`);
  };
  return {
    log: (...args: unknown[]) => append('log', args),
    info: (...args: unknown[]) => append('info', args),
    warn: (...args: unknown[]) => append('warn', args),
    error: (...args: unknown[]) => append('error', args),
  };
}
