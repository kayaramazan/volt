// Sandboxed pre-request / post-response script runner.
//
// Scripts run in a fresh Node `vm` context that exposes a Postman-compatible
// `pm` object (pm.environment / pm.globals / pm.variables / pm.request /
// pm.response / pm.test / pm.expect / pm.sendRequest) plus the legacy `volt`
// alias and a captured `console`.
//
// Sandbox model: NOTHING host-realm is reachable from user code. The whole
// `pm` layer is compiled *inside* the context (see SANDBOX_BOOTSTRAP) and talks
// to the host through a bridge object hidden in a closure. Every value that
// crosses the boundary is a primitive (strings / numbers) — never a host object
// or function — so tricks like `x.constructor.constructor('return process')()`
// cannot reach Node or Electron internals.
//
// Synchronous execution is bounded by TIMEOUT_MS (covers `while(true){}`).
// Async work (pm.sendRequest, setTimeout) is delivered back into the context
// via a trampoline script that is itself time-boxed, and the whole run is
// bounded by ASYNC_BUDGET_MS. Errors are caught and returned as a string so the
// renderer can surface them in the response panel.

import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

import type { ResolvedRequest, SendRequestOutput } from '@volt/shared';

import {
  deleteGlobal,
  getGlobal,
  listGlobals,
  setGlobal,
} from '../db/queries';
import { cancelRequest, executeRequest } from '../http/engine';

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
  statusText?: string;
  headers: Array<[string, string]>;
  /** Decoded text body, or null if binary / empty. */
  text: string | null;
  /** Parsed JSON body, or null if the response wasn't JSON or parsing failed. */
  json: unknown;
  size: number;
  durationMs: number;
}

export interface ScriptTestResult {
  name: string;
  passed: boolean;
  /** Assertion / exception message for failed tests. */
  error: string | null;
  skipped?: boolean;
}

export interface ScriptResult<T extends 'pre' | 'post'> {
  ok: boolean;
  /** Captured console.log output, one entry per call (args coerced to strings). */
  logs: string[];
  /** Error message if the script threw. */
  error: string | null;
  /** pm.test() results in declaration order (also mirrored into `logs`). */
  tests: ScriptTestResult[];
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
    finalVars: EnvVariable[];
  } | null;
}

/**
 * Environment variable row as stored on the Environment. Extra fields
 * (`enabled`, `secret`, `secretRef`, …) are carried through untouched when a
 * script mutates the value, so write-back doesn't drop them.
 */
export interface EnvVariable {
  key: string;
  value: string;
  [extra: string]: unknown;
}

export interface ScriptRunOptions {
  /** Surfaced as pm.info.requestName / pm.request.name. */
  requestName?: string;
  /** Surfaced as pm.info.requestId / pm.request.id. */
  requestId?: string | null;
}

export interface EnvContext {
  /** Active environment name (read-only in scripts). */
  name: string;
  /** Initial variable list when the script started. */
  variables: EnvVariable[];
}

/** Wall-clock budget for the synchronous part of a script (and each callback). */
const TIMEOUT_MS = 5000;
/** Total budget for async work (pm.sendRequest / setTimeout) after the script body. */
const ASYNC_BUDGET_MS = 30_000;
/** Per-request timeout for pm.sendRequest. */
const SEND_REQUEST_TIMEOUT_MS = 30_000;
const MAX_TIMER_MS = 10_000;

const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

// ─────────────────────────────────────────────────────────
// In-context sandbox library. Runs inside the vm context, so every object
// and function it creates belongs to the sandbox realm. `B` is the host
// bridge — all its methods take and return primitives only.
// ─────────────────────────────────────────────────────────

const SANDBOX_BOOTSTRAP = String.raw`
'use strict';
(function install(B, initJson) {
  const init = JSON.parse(initJson);
  const phase = init.phase;
  const reqView = init.request;
  const resData = init.response;
  const hasEnv = init.env != null;
  const envName = hasEnv ? init.env.name : null;
  const envVars = hasEnv ? init.env.variables.slice() : [];
  const envChanges = {};
  const baseVars = init.variables || {};
  const localVars = {};
  const tests = [];
  const callbacks = {};
  let nextCallbackId = 1;
  let warnedCollection = false;

  // ── helpers ──────────────────────────────────────────
  function errMsg(e) {
    if (e && typeof e === 'object' && 'message' in e) return String(e.message);
    return String(e);
  }
  function toStr(v) {
    if (typeof v === 'string') return v;
    if (v === undefined || v === null) return '';
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  }
  function bridge(name, ...args) {
    const r = JSON.parse(B[name](...args));
    if (r && typeof r === 'object' && 'e' in r) throw new Error(r.e);
    return r ? r.v : undefined;
  }
  function inspect(v) {
    try {
      if (typeof v === 'string') return JSON.stringify(v);
      if (typeof v === 'function') return '[Function' + (v.name ? ' ' + v.name : '') + ']';
      if (v === undefined) return 'undefined';
      if (typeof v === 'bigint') return v + 'n';
      if (typeof v === 'symbol') return v.toString();
      if (v instanceof Error) return v.toString();
      if (v instanceof RegExp) return v.toString();
      if (v instanceof Date) return v.toISOString();
      const s = JSON.stringify(v);
      if (s === undefined) return String(v);
      return s.length > 200 ? s.slice(0, 200) + '…' : s;
    } catch (e) {
      return String(v);
    }
  }
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (v instanceof Date) return 'date';
    if (v instanceof RegExp) return 'regexp';
    if (v instanceof Error) return 'error';
    if (v instanceof Map) return 'map';
    if (v instanceof Set) return 'set';
    if (v instanceof Promise) return 'promise';
    return typeof v;
  }
  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
      return true;
    }
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  function getPath(obj, path) {
    const parts = String(path).replace(/\[(\d+)\]/g, '.$1').replace(/^\$?\.?/, '').split('.').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur === null || cur === undefined) return { found: false, value: undefined };
      if (typeof cur !== 'object' || !(p in cur)) return { found: false, value: undefined };
      cur = cur[p];
    }
    return { found: true, value: cur };
  }

  // ── console ──────────────────────────────────────────
  function fmtArg(a) {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.toString();
    if (a === undefined) return 'undefined';
    if (typeof a === 'function' || typeof a === 'symbol' || typeof a === 'bigint') return String(a);
    try {
      const s = JSON.stringify(a);
      return s === undefined ? String(a) : s;
    } catch (e) {
      return String(a);
    }
  }
  function makeLogger(level) {
    return (...args) => { B.log(level, args.map(fmtArg).join(' ')); };
  }
  const console = {
    log: makeLogger('log'),
    info: makeLogger('info'),
    warn: makeLogger('warn'),
    error: makeLogger('error'),
    debug: makeLogger('log'),
  };

  // ── variables ────────────────────────────────────────
  function envGet(key) {
    // Disabled rows are skipped, matching {{var}} resolution.
    const row = envVars.find((v) => v.key === key && v.enabled !== false);
    return row ? row.value : undefined;
  }
  function requireEnv(what) {
    if (!hasEnv) {
      throw new Error(what + ' requires an active environment — pick one from the env dropdown in the top bar first.');
    }
  }
  const environment = {
    get name() { return envName; },
    get: envGet,
    has: (key) => envVars.some((v) => v.key === key && v.enabled !== false),
    set(key, value) {
      requireEnv('pm.environment.set');
      key = String(key);
      const stringValue = toStr(value);
      envChanges[key] = stringValue;
      const existing = envVars.find((v) => v.key === key);
      // Mutate in place so enabled/secret/secretRef flags survive write-back.
      // A script writing a value means it wants the variable live.
      if (existing) { existing.value = stringValue; existing.enabled = true; }
      else envVars.push({ key, value: stringValue, enabled: true });
    },
    unset(key) {
      requireEnv('pm.environment.unset');
      key = String(key);
      envChanges[key] = null;
      const idx = envVars.findIndex((v) => v.key === key);
      if (idx >= 0) envVars.splice(idx, 1);
    },
    clear() {
      requireEnv('pm.environment.clear');
      for (const v of envVars.slice()) environment.unset(v.key);
    },
    toObject() {
      const out = {};
      for (const v of envVars) if (v.enabled !== false) out[v.key] = v.value;
      return out;
    },
    replaceIn: (s) => replaceIn(s),
  };
  environment.all = environment.toObject;

  const globals = {
    get: (key) => bridge('globalGet', String(key)),
    set: (key, value) => { bridge('globalSet', String(key), JSON.stringify(value === undefined ? null : value)); },
    unset: (key) => { bridge('globalUnset', String(key)); },
    has: (key) => bridge('globalGet', String(key)) !== undefined,
    clear() { for (const k of Object.keys(globals.toObject())) globals.unset(k); },
    toObject: () => bridge('globalAll') || {},
    replaceIn: (s) => replaceIn(s),
  };
  globals.all = globals.toObject;

  function varGet(key) {
    key = String(key);
    if (Object.prototype.hasOwnProperty.call(localVars, key)) return localVars[key];
    if (hasEnv && Object.prototype.hasOwnProperty.call(envChanges, key)) {
      return envChanges[key] === null ? undefined : envChanges[key];
    }
    if (Object.prototype.hasOwnProperty.call(baseVars, key)) return baseVars[key];
    const g = globals.get(key);
    if (g === undefined || g === null) return undefined;
    return typeof g === 'string' ? g : JSON.stringify(g);
  }
  function replaceIn(s) {
    return String(s == null ? '' : s).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, name) => {
      const v = varGet(name);
      return v === undefined ? m : String(v);
    });
  }
  const variables = {
    get: varGet,
    has: (key) => varGet(key) !== undefined,
    set(key, value) { localVars[String(key)] = toStr(value); },
    unset(key) { delete localVars[String(key)]; },
    toObject() {
      const out = Object.assign({}, baseVars);
      if (hasEnv) for (const k of Object.keys(envChanges)) {
        if (envChanges[k] === null) delete out[k]; else out[k] = envChanges[k];
      }
      return Object.assign(out, localVars);
    },
    replaceIn,
  };
  variables.all = variables.toObject;

  const collectionVariables = {
    get: varGet,
    has: (key) => varGet(key) !== undefined,
    set(key, value) {
      if (!warnedCollection) {
        warnedCollection = true;
        console.warn('pm.collectionVariables.set: collection variables cannot be persisted from scripts yet — the value applies to this run only. Use pm.environment.set or pm.globals.set to persist.');
      }
      localVars[String(key)] = toStr(value);
    },
    unset(key) { delete localVars[String(key)]; },
    toObject: () => variables.toObject(),
    replaceIn,
  };

  const iterationData = {
    get: () => undefined,
    has: () => false,
    toObject: () => ({}),
    toJSON: () => ({}),
  };

  // ── header lists (shared by request + response) ──────
  function normalizeHeader(h) {
    if (typeof h === 'string') {
      const i = h.indexOf(':');
      if (i < 0) return { key: h.trim(), value: '' };
      return { key: h.slice(0, i).trim(), value: h.slice(i + 1).trim() };
    }
    if (!h || typeof h !== 'object') throw new Error('header must be an object like { key, value }');
    const key = h.key !== undefined ? h.key : h.name;
    if (!key) throw new Error('header needs a key');
    return { key: String(key), value: toStr(h.value) };
  }
  function makeHeaderList(getArr, readonly) {
    const find = (k) => {
      const lk = String(k).toLowerCase();
      return getArr().find((h) => h && h.key && String(h.key).toLowerCase() === lk);
    };
    const list = {
      get(k) { const h = find(k); return h ? h.value : undefined; },
      has(k, v) { const h = find(k); return !!h && (v === undefined || h.value === String(v)); },
      each(fn) { getArr().forEach((h) => fn({ key: h.key, value: h.value })); },
      map(fn) { return getArr().map((h) => fn({ key: h.key, value: h.value })); },
      all() { return getArr().map((h) => ({ key: h.key, value: h.value })); },
      toObject() {
        const o = {};
        for (const h of getArr()) if (h && h.key) o[h.key] = h.value;
        return o;
      },
      count() { return getArr().length; },
      idx(i) { const h = getArr()[i]; return h ? { key: h.key, value: h.value } : undefined; },
      toJSON() { return list.all(); },
      toString() { return getArr().map((h) => h.key + ': ' + h.value).join('\n'); },
    };
    if (!readonly) {
      list.add = (h) => { const n = normalizeHeader(h); getArr().push({ key: n.key, value: n.value, enabled: true }); };
      list.upsert = (h) => {
        const n = normalizeHeader(h);
        const existing = find(n.key);
        if (existing) { existing.value = n.value; existing.enabled = true; }
        else getArr().push({ key: n.key, value: n.value, enabled: true });
      };
      list.remove = (k) => {
        const lk = String(k).toLowerCase();
        const arr = getArr();
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i] && String(arr[i].key).toLowerCase() === lk) arr.splice(i, 1);
        }
      };
      list.clear = () => { getArr().splice(0, getArr().length); };
    }
    return list;
  }

  // ── pm.request ───────────────────────────────────────
  function encodeParam(s) {
    // Keep {{var}} placeholders intact so later substitution still works.
    return encodeURIComponent(String(s)).replace(/%7B/gi, '{').replace(/%7D/gi, '}');
  }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function splitUrl() {
    const url = String(reqView.url || '');
    const hashIdx = url.indexOf('#');
    const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
    const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const q = noHash.indexOf('?');
    const base = q >= 0 ? noHash.slice(0, q) : noHash;
    const qs = q >= 0 ? noHash.slice(q + 1) : '';
    const pairs = qs.split('&').filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      return i < 0
        ? { key: safeDecode(p), value: '' }
        : { key: safeDecode(p.slice(0, i)), value: safeDecode(p.slice(i + 1)) };
    });
    return { base, pairs, hash };
  }
  function joinUrl(base, pairs, hash) {
    const qs = pairs.map((p) => encodeParam(p.key) + (p.value === '' ? '' : '=' + encodeParam(p.value))).join('&');
    reqView.url = base + (qs ? '?' + qs : '') + hash;
  }
  function paramsToList(params) {
    if (params == null) return [];
    if (typeof params === 'string') {
      return params.replace(/^\?/, '').split('&').filter(Boolean).map((p) => {
        const i = p.indexOf('=');
        return i < 0 ? { key: safeDecode(p), value: '' } : { key: safeDecode(p.slice(0, i)), value: safeDecode(p.slice(i + 1)) };
      });
    }
    if (Array.isArray(params)) return params.map((p) => (typeof p === 'string' ? paramsToList(p)[0] : { key: String(p.key), value: toStr(p.value) }));
    if (typeof params === 'object' && 'key' in params) return [{ key: String(params.key), value: toStr(params.value) }];
    return Object.keys(params).map((k) => ({ key: k, value: toStr(params[k]) }));
  }
  const query = {
    add(params) { const u = splitUrl(); joinUrl(u.base, u.pairs.concat(paramsToList(params)), u.hash); },
    upsert(params) {
      const u = splitUrl();
      for (const np of paramsToList(params)) {
        const e = u.pairs.find((p) => p.key === np.key);
        if (e) e.value = np.value; else u.pairs.push(np);
      }
      joinUrl(u.base, u.pairs, u.hash);
    },
    remove(keys) {
      const list = (Array.isArray(keys) ? keys : [keys]).map(String);
      const u = splitUrl();
      joinUrl(u.base, u.pairs.filter((p) => !list.includes(p.key)), u.hash);
    },
    get(k) { const p = splitUrl().pairs.find((x) => x.key === String(k)); return p ? p.value : undefined; },
    has(k) { return splitUrl().pairs.some((x) => x.key === String(k)); },
    each(fn) { splitUrl().pairs.forEach(fn); },
    all() { return splitUrl().pairs; },
    count() { return splitUrl().pairs.length; },
    toObject() { const o = {}; for (const p of splitUrl().pairs) o[p.key] = p.value; return o; },
    toString() { return splitUrl().pairs.map((p) => encodeParam(p.key) + '=' + encodeParam(p.value)).join('&'); },
  };
  const urlApi = {
    toString() { return String(reqView.url || ''); },
    toJSON() { return String(reqView.url || ''); },
    get query() { return query; },
    getHost() { const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(String(reqView.url || '')); return m ? m[1].replace(/^[^@]*@/, '').replace(/:\d+$/, '') : ''; },
    getPath() { const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(String(reqView.url || '')); return m ? m[1] || '/' : String(reqView.url || '').replace(/[?#].*$/, ''); },
    getQueryString() { return query.toString(); },
    getRemote() { const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(String(reqView.url || '')); return m ? m[1].replace(/^[^@]*@/, '') : ''; },
    addQueryParams: (p) => query.add(p),
    removeQueryParams: (k) => query.remove(k),
    update(u) { reqView.url = String(u); },
    get host() { return urlApi.getHost().split('.'); },
    get path() { return urlApi.getPath().split('/').filter(Boolean); },
    get protocol() { const m = /^([a-z][a-z0-9+.-]*):/i.exec(String(reqView.url || '')); return m ? m[1].toLowerCase() : undefined; },
    get port() { const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*?:(\d+)(?=[/?#]|$)/i.exec(String(reqView.url || '')); return m ? m[1] : undefined; },
  };

  const modeOf = { raw: 'raw', urlencoded: 'urlencoded', form: 'formdata', binary: 'file', graphql: 'graphql' };
  const bodyApi = {
    get mode() { return reqView.body && modeOf[reqView.body.type] ? modeOf[reqView.body.type] : undefined; },
    get raw() { return reqView.body && reqView.body.type === 'raw' ? reqView.body.content : undefined; },
    set raw(v) { reqView.body = { type: 'raw', content: toStr(v) }; },
    get urlencoded() { return reqView.body && reqView.body.type === 'urlencoded' ? reqView.body.content : undefined; },
    get formdata() { return reqView.body && reqView.body.type === 'form' ? reqView.body.fields : undefined; },
    get graphql() { return reqView.body && reqView.body.type === 'graphql' ? { query: reqView.body.query, variables: reqView.body.variables, operationName: reqView.body.operationName } : undefined; },
    get file() { return reqView.body && reqView.body.type === 'binary' ? { src: reqView.body.filePath } : undefined; },
    isEmpty() { return !reqView.body || reqView.body.type === 'none' || (reqView.body.type === 'raw' && !reqView.body.content); },
    toString() { return reqView.body && reqView.body.type === 'raw' ? String(reqView.body.content || '') : ''; },
    toJSON() { return reqView.body; },
    update(spec) {
      if (spec == null) { reqView.body = { type: 'none' }; return; }
      if (typeof spec === 'string') { reqView.body = { type: 'raw', content: spec }; return; }
      if (typeof spec !== 'object') throw new Error('pm.request.body.update expects a string or an object');
      // Already in Volt's resolved shape?
      if (typeof spec.type === 'string' && !('mode' in spec)) { reqView.body = spec; return; }
      const mode = spec.mode || 'raw';
      if (mode === 'raw') { reqView.body = { type: 'raw', content: toStr(spec.raw) }; return; }
      if (mode === 'urlencoded') {
        const content = typeof spec.urlencoded === 'string'
          ? spec.urlencoded
          : paramsToList(spec.urlencoded).map((p) => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value)).join('&');
        reqView.body = { type: 'urlencoded', content };
        return;
      }
      if (mode === 'formdata') {
        reqView.body = {
          type: 'form',
          fields: paramsToList(spec.formdata).map((p) => ({ key: p.key, kind: 'text', value: p.value })),
        };
        return;
      }
      if (mode === 'graphql') {
        const g = spec.graphql || {};
        reqView.body = { type: 'graphql', query: toStr(g.query), variables: typeof g.variables === 'string' ? g.variables : (g.variables == null ? '' : JSON.stringify(g.variables)), operationName: g.operationName };
        return;
      }
      if (mode === 'file') { reqView.body = { type: 'binary', filePath: toStr(spec.file && spec.file.src) }; return; }
      if (mode === 'none') { reqView.body = { type: 'none' }; return; }
      throw new Error('Unsupported body mode: ' + mode);
    },
  };

  const requestHeaders = makeHeaderList(() => {
    if (!Array.isArray(reqView.headers)) reqView.headers = [];
    return reqView.headers;
  }, false);
  const request = {
    get method() { return reqView.method; },
    set method(m) { reqView.method = String(m).toUpperCase(); },
    get url() { return urlApi; },
    set url(u) { reqView.url = typeof u === 'string' ? u : String(u); },
    get headers() { return requestHeaders; },
    set headers(h) {
      reqView.headers = Array.isArray(h) ? h.map((x) => { const n = normalizeHeader(x); return { key: n.key, value: n.value, enabled: true }; }) : paramsToList(h).map((p) => ({ key: p.key, value: p.value, enabled: true }));
    },
    get body() { return bodyApi; },
    set body(b) { bodyApi.update(b); },
    get auth() { return reqView.auth; },
    get name() { return init.requestName || ''; },
    get id() { return init.requestId || ''; },
    addHeader: (h) => requestHeaders.add(h),
    upsertHeader: (h) => requestHeaders.upsert(h),
    removeHeader: (k) => requestHeaders.remove(k),
    addQueryParams: (p) => query.add(p),
    removeQueryParams: (k) => query.remove(k),
    toJSON() { return { method: reqView.method, url: reqView.url, header: requestHeaders.all(), body: reqView.body }; },
  };

  // ── responses (pm.response + pm.sendRequest results) ──
  function responseAssertions(res, negate) {
    const check = (cond, posMsg, negMsg) => {
      if (cond === negate) throw assertionError(negate ? negMsg : posMsg);
    };
    const statusIs = (pred, label) => check(pred(res.code), 'expected response to be ' + label + ' but got status ' + res.code, 'expected response not to be ' + label);
    const be = {
      get ok() { return statusIs((c) => c >= 200 && c < 300, 'ok (2xx)'); },
      get success() { return statusIs((c) => c >= 200 && c < 300, 'successful (2xx)'); },
      get info() { return statusIs((c) => c >= 100 && c < 200, 'informational (1xx)'); },
      get redirection() { return statusIs((c) => c >= 300 && c < 400, 'a redirection (3xx)'); },
      get clientError() { return statusIs((c) => c >= 400 && c < 500, 'a client error (4xx)'); },
      get serverError() { return statusIs((c) => c >= 500 && c < 600, 'a server error (5xx)'); },
      get error() { return statusIs((c) => c >= 400, 'an error (4xx or 5xx)'); },
      get accepted() { return statusIs((c) => c === 202, 'accepted (202)'); },
      get badRequest() { return statusIs((c) => c === 400, 'bad request (400)'); },
      get unauthorized() { return statusIs((c) => c === 401, 'unauthorized (401)'); },
      get forbidden() { return statusIs((c) => c === 403, 'forbidden (403)'); },
      get notFound() { return statusIs((c) => c === 404, 'not found (404)'); },
      get rateLimited() { return statusIs((c) => c === 429, 'rate limited (429)'); },
      get json() {
        let ok = true;
        try { res.json(); } catch (e) { ok = false; }
        return check(ok, 'expected response body to be valid JSON', 'expected response body not to be JSON');
      },
    };
    const have = {
      status(expected) {
        if (typeof expected === 'number') {
          check(res.code === expected, 'expected response to have status code ' + expected + ' but got ' + res.code, 'expected response not to have status code ' + expected);
        } else {
          const want = String(expected).toLowerCase();
          check(String(res.status).toLowerCase() === want, 'expected response to have status reason ' + inspect(expected) + ' but got ' + inspect(res.status), 'expected response not to have status reason ' + inspect(expected));
        }
      },
      header(key, value) {
        if (value === undefined) {
          check(res.headers.has(key), 'expected response to have header ' + inspect(key), 'expected response not to have header ' + inspect(key));
        } else {
          const got = res.headers.get(key);
          check(got !== undefined && String(got) === String(value), 'expected response header ' + inspect(key) + ' to equal ' + inspect(value) + ' but got ' + inspect(got), 'expected response header ' + inspect(key) + ' not to equal ' + inspect(value));
        }
      },
      body(expected) {
        const text = res.text();
        if (expected === undefined) { check(text.length > 0, 'expected response to have a body', 'expected response not to have a body'); return; }
        if (expected instanceof RegExp) { check(expected.test(text), 'expected response body to match ' + String(expected), 'expected response body not to match ' + String(expected)); return; }
        check(text === String(expected), 'expected response body to equal ' + inspect(expected), 'expected response body not to equal ' + inspect(expected));
      },
      jsonBody(path, value) {
        let json;
        try { json = res.json(); } catch (e) { check(false, 'expected response body to be valid JSON', ''); return; }
        if (path === undefined) { check(true, '', 'expected response body not to be JSON'); return; }
        if (typeof path === 'object' && path !== null) { check(deepEqual(json, path), 'expected response JSON to deep equal ' + inspect(path), 'expected response JSON not to deep equal ' + inspect(path)); return; }
        const r = getPath(json, path);
        if (value === undefined) { check(r.found, 'expected response JSON to have property ' + inspect(path), 'expected response JSON not to have property ' + inspect(path)); return; }
        check(r.found && deepEqual(r.value, value), 'expected response JSON property ' + inspect(path) + ' to equal ' + inspect(value) + ' but got ' + inspect(r.value), 'expected response JSON property ' + inspect(path) + ' not to equal ' + inspect(value));
      },
      jsonSchema() { throw new Error('pm.response.to.have.jsonSchema is not supported yet'); },
    };
    const to = { be, have, with: null, not: null };
    to.with = to;
    if (!negate) Object.defineProperty(to, 'not', { get: () => responseAssertions(res, true) });
    else to.not = to;
    return to;
  }
  function makeResponse(d) {
    const headerArr = (d.headers || []).map((h) => ({ key: h[0], value: h[1] }));
    const headers = makeHeaderList(() => headerArr, true);
    const res = {
      code: d.code,
      status: d.status,
      responseTime: d.responseTime,
      responseSize: d.responseSize,
      headers,
      text() { return d.text == null ? '' : d.text; },
      json() {
        if (d.text == null || d.text === '') throw new Error('response body is empty — cannot parse as JSON');
        try { return JSON.parse(d.text); } catch (e) { throw new Error('response body is not valid JSON: ' + errMsg(e)); }
      },
      reason() { return d.status; },
      toJSON() { return { code: d.code, status: d.status, header: headers.all(), body: d.text, responseTime: d.responseTime }; },
    };
    Object.defineProperty(res, 'to', { get: () => responseAssertions(res, false), enumerable: false });
    Object.defineProperty(res, 'stream', { get() { throw new Error('pm.response.stream is not supported'); }, enumerable: false });
    return res;
  }
  let legacyResponse;
  let response;
  if (phase === 'post' && resData) {
    response = makeResponse({
      code: resData.status,
      status: resData.statusText || '',
      headers: resData.headers,
      text: resData.text,
      responseTime: resData.durationMs,
      responseSize: resData.size,
    });
    let parsed = null;
    try { parsed = resData.text ? JSON.parse(resData.text) : null; } catch (e) { parsed = null; }
    legacyResponse = {
      ok: resData.ok,
      status: resData.status,
      statusText: resData.statusText || '',
      headers: resData.headers,
      text: resData.text,
      json: parsed,
      size: resData.size,
      durationMs: resData.durationMs,
    };
  }

  // ── pm.test ──────────────────────────────────────────
  function test(name, fn) {
    name = String(name);
    if (typeof fn !== 'function') {
      tests.push({ name, passed: false, error: 'pm.test(name, fn) requires a function as the second argument' });
      return;
    }
    const entry = { name, passed: true, error: null };
    tests.push(entry);
    const fail = (e) => { entry.passed = false; entry.error = errMsg(e); };
    try {
      let r;
      if (fn.length >= 1) {
        r = new Promise((resolve, reject) => {
          try { fn((err) => (err ? reject(err) : resolve())); } catch (e) { reject(e); }
        });
      } else {
        r = fn();
      }
      if (r && typeof r.then === 'function') r.then(() => {}, fail);
    } catch (e) {
      fail(e);
    }
  }
  test.skip = (name) => { tests.push({ name: String(name), passed: true, skipped: true, error: null }); };
  test.only = test;

  // ── pm.expect (chai subset) ──────────────────────────
  function assertionError(msg) {
    const e = new Error(msg);
    e.name = 'AssertionError';
    return e;
  }
  function Assertion(obj, msg) {
    this._obj = obj;
    this._msg = msg;
    this._not = false;
    this._deep = false;
    this._any = false;
    this._all = false;
    this._contains = false;
    this._doLength = false;
    this._nested = false;
    this._own = false;
  }
  const P = Assertion.prototype;
  P._assert = function (cond, pos, neg) {
    if (!!cond === this._not) {
      throw assertionError((this._msg ? this._msg + ': ' : '') + (this._not ? neg : pos));
    }
  };
  P._eq = function (a, b) { return this._deep ? deepEqual(a, b) : Object.is(a, b) || a === b; };
  function chainWord(name) { Object.defineProperty(P, name, { get() { return this; }, configurable: true }); }
  ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'but', 'does', 'still', 'also', 'ordered'].forEach(chainWord);
  function flag(name, prop) { Object.defineProperty(P, name, { get() { this[prop] = true; return this; }, configurable: true }); }
  flag('deep', '_deep'); flag('any', '_any'); flag('all', '_all'); flag('nested', '_nested'); flag('own', '_own');
  Object.defineProperty(P, 'not', { get() { this._not = !this._not; return this; }, configurable: true });
  function chainable(names, onAccess, fn) {
    for (const name of names) {
      Object.defineProperty(P, name, {
        get() {
          if (onAccess) onAccess.call(this);
          const self = this;
          const g = function (...args) { return fn.apply(self, args); };
          Object.setPrototypeOf(g, self);
          return g;
        },
        configurable: true,
      });
    }
  }
  function method(names, fn) { for (const n of names) P[n] = fn; }
  function prop(names, fn) { for (const n of names) Object.defineProperty(P, n, { get() { return fn.call(this); }, configurable: true }); }

  method(['equal', 'equals', 'eq'], function (v) {
    this._assert(this._eq(this._obj, v), 'expected ' + inspect(this._obj) + ' to ' + (this._deep ? 'deeply ' : '') + 'equal ' + inspect(v), 'expected ' + inspect(this._obj) + ' to not equal ' + inspect(v));
    return this;
  });
  method(['eql', 'eqls'], function (v) {
    this._assert(deepEqual(this._obj, v), 'expected ' + inspect(this._obj) + ' to deeply equal ' + inspect(v), 'expected ' + inspect(this._obj) + ' to not deeply equal ' + inspect(v));
    return this;
  });
  chainable(['a', 'an'], null, function (type) {
    const t = String(type).toLowerCase();
    this._assert(typeOf(this._obj) === t, 'expected ' + inspect(this._obj) + ' to be a ' + t, 'expected ' + inspect(this._obj) + ' not to be a ' + t);
    return this;
  });
  chainable(['include', 'includes', 'contain', 'contains'], function () { this._contains = true; }, function (v) {
    const o = this._obj;
    let ok;
    if (typeof o === 'string') ok = o.includes(String(v));
    else if (Array.isArray(o)) ok = this._deep ? o.some((x) => deepEqual(x, v)) : o.includes(v);
    else if (o instanceof Set) ok = o.has(v);
    else if (o instanceof Map) ok = Array.from(o.values()).some((x) => (this._deep ? deepEqual(x, v) : x === v));
    else if (o && typeof o === 'object' && v && typeof v === 'object') ok = Object.keys(v).every((k) => k in o && (this._deep ? deepEqual(o[k], v[k]) : o[k] === v[k]));
    else ok = false;
    this._assert(ok, 'expected ' + inspect(o) + ' to include ' + inspect(v), 'expected ' + inspect(o) + ' to not include ' + inspect(v));
    return this;
  });
  prop(['ok'], function () { this._assert(!!this._obj, 'expected ' + inspect(this._obj) + ' to be truthy', 'expected ' + inspect(this._obj) + ' to be falsy'); return this; });
  prop(['true'], function () { this._assert(this._obj === true, 'expected ' + inspect(this._obj) + ' to be true', 'expected ' + inspect(this._obj) + ' to not be true'); return this; });
  prop(['false'], function () { this._assert(this._obj === false, 'expected ' + inspect(this._obj) + ' to be false', 'expected ' + inspect(this._obj) + ' to not be false'); return this; });
  prop(['null'], function () { this._assert(this._obj === null, 'expected ' + inspect(this._obj) + ' to be null', 'expected ' + inspect(this._obj) + ' to not be null'); return this; });
  prop(['undefined'], function () { this._assert(this._obj === undefined, 'expected ' + inspect(this._obj) + ' to be undefined', 'expected ' + inspect(this._obj) + ' to not be undefined'); return this; });
  prop(['NaN'], function () { this._assert(Number.isNaN(this._obj), 'expected ' + inspect(this._obj) + ' to be NaN', 'expected ' + inspect(this._obj) + ' to not be NaN'); return this; });
  prop(['exist', 'exists'], function () { this._assert(this._obj !== null && this._obj !== undefined, 'expected ' + inspect(this._obj) + ' to exist', 'expected ' + inspect(this._obj) + ' to not exist'); return this; });
  prop(['finite'], function () { this._assert(Number.isFinite(this._obj), 'expected ' + inspect(this._obj) + ' to be a finite number', 'expected ' + inspect(this._obj) + ' to not be a finite number'); return this; });
  prop(['empty'], function () {
    const o = this._obj;
    let empty;
    if (typeof o === 'string' || Array.isArray(o)) empty = o.length === 0;
    else if (o instanceof Map || o instanceof Set) empty = o.size === 0;
    else if (o && typeof o === 'object') empty = Object.keys(o).length === 0;
    else throw assertionError('.empty was passed non-string primitive ' + inspect(o));
    this._assert(empty, 'expected ' + inspect(o) + ' to be empty', 'expected ' + inspect(o) + ' not to be empty');
    return this;
  });
  function numericSubject(self) {
    if (self._doLength) {
      const o = self._obj;
      const len = o == null ? undefined : (o instanceof Map || o instanceof Set ? o.size : o.length);
      if (typeof len !== 'number') throw assertionError('expected ' + inspect(o) + ' to have property \'length\'');
      return { n: len, label: inspect(o) + ' to have a length' };
    }
    if (typeof self._obj !== 'number' && !(self._obj instanceof Date)) throw assertionError('expected ' + inspect(self._obj) + ' to be a number or a date');
    return { n: +self._obj, label: inspect(self._obj) + ' to be' };
  }
  method(['above', 'gt', 'greaterThan'], function (n) { const s = numericSubject(this); this._assert(s.n > n, 'expected ' + s.label + ' above ' + n, 'expected ' + s.label + ' at most ' + n); return this; });
  method(['least', 'gte', 'greaterThanOrEqual'], function (n) { const s = numericSubject(this); this._assert(s.n >= n, 'expected ' + s.label + ' at least ' + n, 'expected ' + s.label + ' below ' + n); return this; });
  method(['below', 'lt', 'lessThan'], function (n) { const s = numericSubject(this); this._assert(s.n < n, 'expected ' + s.label + ' below ' + n, 'expected ' + s.label + ' at least ' + n); return this; });
  method(['most', 'lte', 'lessThanOrEqual'], function (n) { const s = numericSubject(this); this._assert(s.n <= n, 'expected ' + s.label + ' at most ' + n, 'expected ' + s.label + ' above ' + n); return this; });
  method(['within'], function (a, b) { const s = numericSubject(this); this._assert(s.n >= a && s.n <= b, 'expected ' + s.label + ' within ' + a + '..' + b, 'expected ' + s.label + ' not within ' + a + '..' + b); return this; });
  method(['closeTo', 'approximately'], function (n, delta) { this._assert(typeof this._obj === 'number' && Math.abs(this._obj - n) <= delta, 'expected ' + inspect(this._obj) + ' to be close to ' + n + ' +/- ' + delta, 'expected ' + inspect(this._obj) + ' not to be close to ' + n + ' +/- ' + delta); return this; });
  chainable(['length', 'lengthOf'], function () { this._doLength = true; }, function (n) {
    const s = numericSubject(this);
    this._assert(s.n === n, 'expected ' + inspect(this._obj) + ' to have a length of ' + n + ' but got ' + s.n, 'expected ' + inspect(this._obj) + ' to not have a length of ' + n);
    return this;
  });
  method(['instanceof', 'instanceOf'], function (C) { this._assert(this._obj instanceof C, 'expected ' + inspect(this._obj) + ' to be an instance of ' + (C && C.name ? C.name : inspect(C)), 'expected ' + inspect(this._obj) + ' to not be an instance of ' + (C && C.name ? C.name : inspect(C))); return this; });
  method(['property'], function (name, value) {
    const o = this._obj;
    let found; let got;
    if (this._nested) { const r = getPath(o, name); found = r.found; got = r.value; }
    else {
      found = o !== null && o !== undefined && (this._own ? Object.prototype.hasOwnProperty.call(o, name) : name in Object(o));
      got = found ? o[name] : undefined;
    }
    if (arguments.length < 2) {
      this._assert(found, 'expected ' + inspect(o) + ' to have property ' + inspect(name), 'expected ' + inspect(o) + ' to not have property ' + inspect(name));
    } else {
      this._assert(found && this._eq(got, value), 'expected ' + inspect(o) + ' to have property ' + inspect(name) + ' of ' + inspect(value) + ', but got ' + inspect(got), 'expected ' + inspect(o) + ' to not have property ' + inspect(name) + ' of ' + inspect(value));
    }
    if (!this._not) { const next = new Assertion(got, this._msg); next._deep = this._deep; return next; }
    return this;
  });
  method(['ownProperty', 'haveOwnProperty'], function (name, value) { this._own = true; return arguments.length < 2 ? this.property(name) : this.property(name, value); });
  method(['match', 'matches'], function (re) { this._assert(re.test(String(this._obj)), 'expected ' + inspect(this._obj) + ' to match ' + String(re), 'expected ' + inspect(this._obj) + ' not to match ' + String(re)); return this; });
  method(['string'], function (s) { this._assert(typeof this._obj === 'string' && this._obj.includes(s), 'expected ' + inspect(this._obj) + ' to contain ' + inspect(s), 'expected ' + inspect(this._obj) + ' to not contain ' + inspect(s)); return this; });
  method(['keys', 'key'], function (...args) {
    let expected = args.length === 1 && Array.isArray(args[0]) ? args[0] : args.length === 1 && args[0] && typeof args[0] === 'object' ? Object.keys(args[0]) : args;
    expected = expected.map(String);
    const o = this._obj;
    const actual = o instanceof Map || o instanceof Set ? Array.from(o.keys()).map(String) : Object.keys(Object(o));
    let ok;
    if (this._any) ok = expected.some((k) => actual.includes(k));
    else if (this._contains) ok = expected.every((k) => actual.includes(k));
    else ok = expected.every((k) => actual.includes(k)) && actual.length === expected.length;
    const word = this._any ? 'any of' : this._contains ? 'all of' : 'exactly';
    this._assert(ok, 'expected ' + inspect(o) + ' to have ' + word + ' keys ' + inspect(expected), 'expected ' + inspect(o) + ' to not have ' + word + ' keys ' + inspect(expected));
    return this;
  });
  method(['members'], function (arr) {
    const o = this._obj;
    if (!Array.isArray(o) || !Array.isArray(arr)) throw assertionError('expected ' + inspect(o) + ' to be an array');
    const has = (list, x) => list.some((y) => (this._deep ? deepEqual(x, y) : x === y));
    const ok = this._contains ? arr.every((x) => has(o, x)) : o.length === arr.length && arr.every((x) => has(o, x)) && o.every((x) => has(arr, x));
    this._assert(ok, 'expected ' + inspect(o) + ' to have ' + (this._contains ? 'members including ' : 'the same members as ') + inspect(arr), 'expected ' + inspect(o) + ' to not have ' + (this._contains ? 'members including ' : 'the same members as ') + inspect(arr));
    return this;
  });
  method(['oneOf'], function (arr) { this._assert(Array.isArray(arr) && arr.some((x) => this._eq(x, this._obj)), 'expected ' + inspect(this._obj) + ' to be one of ' + inspect(arr), 'expected ' + inspect(this._obj) + ' to not be one of ' + inspect(arr)); return this; });
  method(['satisfy', 'satisfies'], function (fn) { this._assert(!!fn(this._obj), 'expected ' + inspect(this._obj) + ' to satisfy ' + (fn.name || 'function'), 'expected ' + inspect(this._obj) + ' to not satisfy ' + (fn.name || 'function')); return this; });
  method(['respondTo', 'respondsTo'], function (m) { const o = this._obj; const ok = o != null && typeof (typeof o === 'function' ? o.prototype && o.prototype[m] : o[m]) === 'function'; this._assert(ok, 'expected ' + inspect(o) + ' to respond to ' + inspect(m), 'expected ' + inspect(o) + ' to not respond to ' + inspect(m)); return this; });
  method(['throw', 'throws', 'Throw'], function (errLike, msgLike) {
    if (typeof this._obj !== 'function') throw assertionError('expected ' + inspect(this._obj) + ' to be a function');
    let thrown = false; let err;
    try { this._obj(); } catch (e) { thrown = true; err = e; }
    if (!thrown) { this._assert(false, 'expected function to throw' + (errLike ? ' ' + (typeof errLike === 'function' ? errLike.name : inspect(errLike)) : ''), 'expected function to not throw'); return this; }
    let matches = true;
    const message = errMsg(err);
    const checkMsg = (m) => (m instanceof RegExp ? m.test(message) : typeof m === 'string' ? message.includes(m) : true);
    if (typeof errLike === 'function') matches = err instanceof errLike;
    else if (errLike instanceof Error) matches = err === errLike || message === errLike.message;
    else if (errLike !== undefined) matches = checkMsg(errLike);
    if (matches && msgLike !== undefined) matches = checkMsg(msgLike);
    this._assert(matches, 'expected function to throw ' + (typeof errLike === 'function' ? errLike.name : inspect(msgLike !== undefined ? msgLike : errLike)) + ' but it threw ' + inspect(message), 'expected function to not throw ' + (typeof errLike === 'function' ? errLike.name : inspect(msgLike !== undefined ? msgLike : errLike)));
    return this;
  });
  method(['increase', 'decrease', 'change'], function () { throw new Error('pm.expect(...).' + 'change/increase/decrease are not supported'); });

  function expect(obj, msg) { return new Assertion(obj, msg); }
  expect.fail = (msg) => { throw assertionError(msg === undefined ? 'expect.fail()' : String(msg)); };

  // ── async: pm.sendRequest + setTimeout ───────────────
  function normalizeSendSpec(spec) {
    if (typeof spec === 'string') spec = { url: spec };
    if (!spec || typeof spec !== 'object' || !spec.url) throw new Error('pm.sendRequest: first argument must be a URL string or an object with a url property');
    const out = { url: replaceIn(String(typeof spec.url === 'object' && spec.url !== null ? (spec.url.toString ? spec.url.toString() : spec.url.raw) : spec.url)), method: String(spec.method || 'GET').toUpperCase(), headers: {}, body: null, timeout: spec.timeout };
    const hdrs = spec.header !== undefined ? spec.header : spec.headers;
    if (hdrs) for (const p of paramsToList(hdrs)) out.headers[replaceIn(p.key)] = replaceIn(p.value);
    const b = spec.body;
    if (b != null) {
      if (typeof b === 'string') out.body = { type: 'raw', content: replaceIn(b) };
      else if (typeof b === 'object' && typeof b.mode === 'string') {
        if (b.mode === 'raw') {
          out.body = { type: 'raw', content: replaceIn(toStr(b.raw)) };
          const lang = b.options && b.options.raw && b.options.raw.language;
          if (lang && !Object.keys(out.headers).some((k) => k.toLowerCase() === 'content-type')) {
            out.headers['Content-Type'] = lang === 'json' ? 'application/json' : lang === 'xml' ? 'application/xml' : lang === 'html' ? 'text/html' : 'text/plain';
          }
        } else if (b.mode === 'urlencoded') {
          out.body = { type: 'urlencoded', content: typeof b.urlencoded === 'string' ? b.urlencoded : paramsToList(b.urlencoded).map((p) => encodeURIComponent(replaceIn(p.key)) + '=' + encodeURIComponent(replaceIn(p.value))).join('&') };
        } else if (b.mode === 'formdata') {
          out.body = { type: 'form', fields: paramsToList(b.formdata).map((p) => ({ key: replaceIn(p.key), kind: 'text', value: replaceIn(p.value) })) };
        } else if (b.mode === 'graphql') {
          const g = b.graphql || {};
          out.body = { type: 'graphql', query: toStr(g.query), variables: typeof g.variables === 'string' ? g.variables : (g.variables == null ? '' : JSON.stringify(g.variables)) };
        } else if (b.mode === 'none') out.body = null;
        else throw new Error('pm.sendRequest: unsupported body mode ' + b.mode);
      } else {
        // Plain object → JSON body (convenience, not strictly Postman).
        out.body = { type: 'raw', content: JSON.stringify(b) };
        if (!Object.keys(out.headers).some((k) => k.toLowerCase() === 'content-type')) out.headers['Content-Type'] = 'application/json';
      }
    }
    return out;
  }
  function sendRequest(spec, cb) {
    const normalized = normalizeSendSpec(spec);
    const id = String(nextCallbackId++);
    let promise;
    if (typeof cb !== 'function') {
      promise = new Promise((resolve, reject) => { cb = (err, res) => (err ? reject(err) : resolve(res)); });
    }
    callbacks[id] = cb;
    bridge('send', id, JSON.stringify(normalized));
    return promise;
  }
  function setTimeout(fn, ms, ...args) {
    if (typeof fn !== 'function') throw new Error('setTimeout requires a function');
    const id = String(nextCallbackId++);
    callbacks[id] = () => fn(...args);
    bridge('timer', id, String(Math.max(0, Number(ms) || 0)));
    return id;
  }
  function clearTimeout(id) {
    if (callbacks[String(id)]) { delete callbacks[String(id)]; bridge('clearTimer', String(id)); }
  }
  function setImmediate(fn, ...args) { return setTimeout(fn, 0, ...args); }

  // ── pm root ──────────────────────────────────────────
  const info = {
    eventName: phase === 'pre' ? 'prerequest' : 'test',
    iteration: 0,
    iterationCount: 1,
    requestName: init.requestName || '',
    requestId: init.requestId || '',
  };
  const pm = {
    info,
    environment,
    globals,
    variables,
    collectionVariables,
    iterationData,
    request,
    test,
    expect,
    sendRequest,
    cookies: { get: () => undefined, has: () => false, toObject: () => ({}), jar() { throw new Error('pm.cookies.jar() is not supported yet'); } },
    execution: { setNextRequest() {}, skipRequest() { throw new Error('pm.execution.skipRequest is not supported yet'); } },
    require() { throw new Error('require() is not available in Volt scripts'); },
    visualizer: { set() { console.warn('pm.visualizer is not supported in Volt'); } },
  };
  if (phase === 'post') {
    pm.response = response;
  } else {
    Object.defineProperty(pm, 'response', {
      get() { throw new Error('pm.response is only available in the post-response (Tests) script — the response has not been received yet in a pre-request script.'); },
      enumerable: true,
      configurable: true,
    });
  }

  // Legacy postman.* helpers (Postman v1 API).
  const postman = {
    setEnvironmentVariable: (k, v) => environment.set(k, v),
    getEnvironmentVariable: (k) => environment.get(k),
    clearEnvironmentVariable: (k) => environment.unset(k),
    clearEnvironmentVariables: () => environment.clear(),
    setGlobalVariable: (k, v) => globals.set(k, v),
    getGlobalVariable: (k) => globals.get(k),
    clearGlobalVariable: (k) => globals.unset(k),
    clearGlobalVariables: () => globals.clear(),
    setNextRequest() {},
  };

  // Legacy Volt API — same objects, plus the raw request view / plain response.
  const volt = {
    globals,
    environment,
    variables,
    request: reqView,
    test,
    expect,
    sendRequest,
  };
  if (phase === 'post') volt.response = legacyResponse;
  else Object.defineProperty(volt, 'response', { get() { return pm.response; }, enumerable: true, configurable: true });

  const legacyTests = {};
  const G = globalThis;
  G.pm = pm;
  G.postman = postman;
  G.volt = volt;
  G.console = console;
  G.tests = legacyTests;
  G.setTimeout = setTimeout;
  G.clearTimeout = clearTimeout;
  G.setImmediate = setImmediate;
  G.btoa = (s) => bridge('btoa', String(s));
  G.atob = (s) => bridge('atob', String(s));
  G.chai = { expect };
  G.responseCode = phase === 'post' && resData ? { code: resData.status, name: resData.statusText || '' } : undefined;
  G.responseBody = phase === 'post' && resData ? (resData.text == null ? '' : resData.text) : undefined;
  G.responseTime = phase === 'post' && resData ? resData.durationMs : undefined;

  // Host → sandbox dispatcher. Only primitives cross this boundary.
  function dispatch(payloadJson) {
    const p = JSON.parse(payloadJson);
    if (p.kind === 'state') {
      for (const name of Object.keys(legacyTests)) {
        if (!tests.some((t) => t.name === name)) tests.push({ name, passed: !!legacyTests[name], error: legacyTests[name] ? null : 'tests[' + JSON.stringify(name) + '] was false' });
      }
      return JSON.stringify({ request: reqView, envChanges, envVars, tests, localVars });
    }
    if (p.kind === 'send') {
      const cb = callbacks[p.id];
      delete callbacks[p.id];
      if (!cb) return '';
      if (p.error) cb(new Error(p.error), undefined);
      else cb(null, makeResponse(p.response));
      return '';
    }
    if (p.kind === 'timer') {
      const cb = callbacks[p.id];
      delete callbacks[p.id];
      if (cb) cb();
      return '';
    }
    if (p.kind === 'track') {
      // Top-level-await wrapper: report settlement of the async IIFE.
      const pr = G.__voltTopLevel;
      delete G.__voltTopLevel;
      if (pr && typeof pr.then === 'function') {
        bridge('track');
        pr.then(
          () => { bridge('untrack', ''); },
          (e) => {
            bridge('untrack', JSON.stringify({
              name: e && typeof e === 'object' ? e.name : undefined,
              message: errMsg(e) || 'unknown error',
              stack: e && typeof e === 'object' && typeof e.stack === 'string' ? e.stack : '',
            }));
          },
        );
      }
      return '';
    }
    return '';
  }
  Object.defineProperty(G, '__voltDispatch', { value: dispatch, writable: false, configurable: false, enumerable: false });
})
`;

type BridgeResult = string;
function ok(v: unknown): BridgeResult {
  // `undefined` has no JSON form — omit the key so the sandbox reads it back
  // as undefined (and `null` stays null).
  return v === undefined ? '{}' : JSON.stringify({ v });
}
function fail(e: unknown): BridgeResult {
  return JSON.stringify({ e: e instanceof Error ? e.message : String(e) });
}

export async function runPreRequest(
  script: string,
  request: ScriptRequestView,
  variables: Map<string, string>,
  env: EnvContext | null,
  options: ScriptRunOptions = {},
): Promise<ScriptResult<'pre'>> {
  if (!script.trim()) {
    return { ok: true, logs: [], error: null, tests: [], request, envMutations: null };
  }
  const r = await runScript('pre', script, request, null, variables, env, options);
  return { ...r, request: r.request ?? request };
}

export async function runPostResponse(
  script: string,
  request: ScriptRequestView,
  response: ScriptResponseView,
  variables: Map<string, string>,
  env: EnvContext | null,
  options: ScriptRunOptions = {},
): Promise<ScriptResult<'post'>> {
  if (!script.trim()) {
    return { ok: true, logs: [], error: null, tests: [], request: undefined, envMutations: null };
  }
  const r = await runScript('post', script, request, response, variables, env, options);
  return { ...r, request: undefined };
}

interface RawScriptResult {
  ok: boolean;
  logs: string[];
  error: string | null;
  tests: ScriptTestResult[];
  request: ScriptRequestView | undefined;
  envMutations: ScriptResult<'pre'>['envMutations'];
}

interface SandboxState {
  request: ScriptRequestView;
  envChanges: Record<string, string | null>;
  envVars: EnvVariable[];
  tests: ScriptTestResult[];
  localVars: Record<string, string>;
}

async function runScript(
  phase: 'pre' | 'post',
  script: string,
  request: ScriptRequestView,
  response: ScriptResponseView | null,
  variables: Map<string, string>,
  env: EnvContext | null,
  options: ScriptRunOptions,
): Promise<RawScriptResult> {
  const logs: string[] = [];
  let error: string | null = null;
  const filename = phase === 'pre' ? 'pre-request.js' : 'tests.js';
  const setError = (msg: string) => {
    if (error === null) error = msg;
  };

  // ── async bookkeeping ──
  let pending = 0;
  let aborted = false;
  let wake: (() => void) | null = null;
  const timers = new Map<string, NodeJS.Timeout>();
  const inFlightSends = new Set<string>();
  const settle = () => {
    pending--;
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  // Null-prototype sandbox object: a plain `{}` would be a HOST-realm object,
  // and `this.constructor.constructor('return process')()` walks its prototype
  // chain straight to the host `Function`.
  const ctx = vm.createContext(
    Object.create(null) as Record<string, unknown>,
    {
      microtaskMode: 'afterEvaluate',
      codeGeneration: { strings: true, wasm: false },
    },
  );
  const dispatchScript = new vm.Script('globalThis.__voltDispatch(globalThis.__voltPayload)', {
    filename: 'volt-sandbox.js',
  });
  // Deliver a payload into the sandbox. Time-boxed like the main script so a
  // callback with an infinite loop can't hang the main process.
  const callInContext = (payload: Record<string, unknown>): unknown => {
    Object.defineProperty(ctx, '__voltPayload', {
      value: JSON.stringify(payload),
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return dispatchScript.runInContext(ctx, { timeout: TIMEOUT_MS, displayErrors: true });
  };

  // Globals written during this run — overlaid onto the variable map so the
  // pre-request second substitution pass sees them.
  const globalsTouched = new Map<string, string | null>();

  const bridge: Record<string, (...args: string[]) => string> = {
    log: (level, text) => {
      if (logs.length < 1000) logs.push(`[${level}] ${text}`);
      return '';
    },
    globalGet: (key) => {
      try {
        return ok(getGlobal(key));
      } catch (e) {
        return fail(e);
      }
    },
    globalSet: (key, valueJson) => {
      try {
        const value = JSON.parse(valueJson);
        setGlobal(key, value);
        globalsTouched.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        return ok(null);
      } catch (e) {
        return fail(e);
      }
    },
    globalUnset: (key) => {
      try {
        deleteGlobal(key);
        globalsTouched.set(key, null);
        return ok(null);
      } catch (e) {
        return fail(e);
      }
    },
    globalAll: () => {
      try {
        return ok(listGlobals());
      } catch (e) {
        return fail(e);
      }
    },
    btoa: (s) => {
      try {
        return ok(Buffer.from(s, 'binary').toString('base64'));
      } catch (e) {
        return fail(e);
      }
    },
    atob: (s) => {
      try {
        return ok(Buffer.from(s, 'base64').toString('binary'));
      } catch (e) {
        return fail(e);
      }
    },
    track: () => {
      pending++;
      return ok(null);
    },
    untrack: (errJson) => {
      if (errJson) {
        try {
          setError(formatError(JSON.parse(errJson), filename));
        } catch {
          setError(errJson);
        }
      }
      settle();
      return ok(null);
    },
    timer: (id, msStr) => {
      const ms = Math.min(MAX_TIMER_MS, Math.max(0, Number(msStr) || 0));
      pending++;
      const handle = setTimeout(() => {
        timers.delete(id);
        if (!aborted) {
          try {
            callInContext({ kind: 'timer', id });
          } catch (e) {
            setError(formatError(e, filename));
          }
        }
        settle();
      }, ms);
      timers.set(id, handle);
      return ok(null);
    },
    clearTimer: (id) => {
      const handle = timers.get(id);
      if (handle) {
        clearTimeout(handle);
        timers.delete(id);
        settle();
      }
      return ok(null);
    },
    send: (id, specJson) => {
      let resolved: ResolvedRequest;
      try {
        resolved = specToResolved(JSON.parse(specJson));
      } catch (e) {
        return fail(e);
      }
      pending++;
      const inFlightId = `script-${randomUUID()}`;
      inFlightSends.add(inFlightId);
      void (async () => {
        let payload: Record<string, unknown>;
        try {
          const out = await executeRequest(inFlightId, resolved);
          payload = outputToPayload(out);
        } catch (e) {
          payload = { error: e instanceof Error ? e.message : String(e) };
        }
        inFlightSends.delete(inFlightId);
        if (!aborted) {
          try {
            callInContext({ kind: 'send', id, ...payload });
          } catch (e) {
            setError(formatError(e, filename));
          }
        }
        settle();
      })();
      return ok(null);
    },
  };

  const init = {
    phase,
    request,
    response,
    env: env ? { name: env.name, variables: env.variables } : null,
    variables: Object.fromEntries(variables),
    requestName: options.requestName ?? '',
    requestId: options.requestId ?? '',
  };

  try {
    const install = vm.runInContext(SANDBOX_BOOTSTRAP, ctx, {
      filename: 'volt-sandbox.js',
      timeout: TIMEOUT_MS,
    }) as (bridge: unknown, initJson: string) => void;
    install(bridge, JSON.stringify(init));
  } catch (e) {
    return finish(`Script sandbox failed to initialize: ${formatError(e, filename)}`);
  }

  // Compile. A script that uses top-level `await` is wrapped in an async IIFE
  // (Postman allows this) and its settlement is tracked. Decide by token, not
  // by compile failure alone: in a sloppy-mode script `await (x)` parses fine
  // as a call to an identifier named `await` and only fails at runtime.
  const wrapAsync = () =>
    new vm.Script(`globalThis.__voltTopLevel = (async () => {\n${script}\n})();`, {
      filename,
      lineOffset: -1,
    });
  const plain = () => new vm.Script(script, { filename });
  const mentionsAwait = /\bawait\b/.test(script);
  let compiled: vm.Script | null = null;
  let compileError: string | null = null;
  // Preferred form first; the other as a fallback. The preferred form's
  // error is the one reported.
  for (const attempt of mentionsAwait ? [wrapAsync, plain] : [plain, wrapAsync]) {
    try {
      compiled = attempt();
      break;
    } catch (e) {
      compileError ??= formatError(e, filename);
    }
  }
  if (!compiled) return finish(compileError ?? 'Script failed to compile');

  try {
    compiled.runInContext(ctx, { timeout: TIMEOUT_MS, displayErrors: true });
    callInContext({ kind: 'track' });
  } catch (e) {
    setError(formatError(e, filename));
  }

  // Wait for pm.sendRequest / setTimeout callbacks (unless the script body
  // already failed — Postman stops at the first uncaught error too).
  if (error === null) {
    const deadline = Date.now() + ASYNC_BUDGET_MS;
    while (pending > 0) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setError(
          `Script timed out after ${ASYNC_BUDGET_MS / 1000}s waiting for pm.sendRequest / setTimeout callbacks`,
        );
        break;
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, remaining);
        wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
    }
  }
  return finish(null);

  function finish(fatal: string | null): RawScriptResult {
    if (fatal) setError(fatal);
    aborted = true;
    for (const handle of timers.values()) clearTimeout(handle);
    timers.clear();
    for (const id of inFlightSends) cancelRequest(id);

    let state: SandboxState | null = null;
    try {
      const raw = callInContext({ kind: 'state' });
      if (typeof raw === 'string') state = JSON.parse(raw) as SandboxState;
    } catch (e) {
      setError(`Could not read script state: ${formatError(e, filename)}`);
    }

    const tests = state?.tests ?? [];
    for (const t of tests) {
      if (t.skipped) logs.push(`[test] ○ ${t.name} (skipped)`);
      else if (t.passed) logs.push(`[test] ✓ ${t.name}`);
      else logs.push(`[test] ✗ ${t.name}${t.error ? ` — ${t.error}` : ''}`);
    }

    let outRequest: ScriptRequestView | undefined;
    if (phase === 'pre') {
      outRequest = state && isRequestView(state.request) ? state.request : request;
      // Second substitution pass: variables the script just set
      // (pm.environment.set / pm.globals.set / pm.variables.set) should apply
      // to this request, like Postman resolves {{vars}} after the pre-request
      // script.
      const merged = new Map(variables);
      if (env && state) {
        for (const [k, v] of Object.entries(state.envChanges)) {
          if (v === null) merged.delete(k);
          else merged.set(k, v);
        }
      }
      for (const [k, v] of globalsTouched) {
        if (v === null) merged.delete(k);
        else if (!variables.has(k)) merged.set(k, v);
      }
      if (state) for (const [k, v] of Object.entries(state.localVars)) merged.set(k, v);
      substituteRequest(outRequest, merged);
    }

    const envChanges = state?.envChanges ?? {};
    return {
      ok: error === null,
      logs,
      error,
      tests,
      request: outRequest,
      envMutations:
        env && state && Object.keys(envChanges).length > 0
          ? { changes: envChanges, finalVars: state.envVars }
          : null,
    };
  }
}

function isRequestView(v: unknown): v is ScriptRequestView {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as ScriptRequestView).url === 'string' &&
    typeof (v as ScriptRequestView).method === 'string' &&
    Array.isArray((v as ScriptRequestView).headers)
  );
}

function substituteRequest(view: ScriptRequestView, vars: Map<string, string>) {
  const sub = (s: string) =>
    s.replace(VAR_RE, (m, name: string) => (vars.has(name) ? vars.get(name)! : m));
  view.url = sub(view.url);
  for (const h of view.headers) {
    if (!h) continue;
    h.key = sub(String(h.key ?? ''));
    h.value = sub(String(h.value ?? ''));
  }
  const body = view.body as Record<string, unknown> | null;
  if (body && typeof body === 'object') {
    if (typeof body.content === 'string') body.content = sub(body.content);
    if (typeof body.query === 'string') body.query = sub(body.query);
    if (typeof body.variables === 'string') body.variables = sub(body.variables);
    if (Array.isArray(body.fields)) {
      for (const f of body.fields as Array<{ key: string; kind: string; value: string }>) {
        if (!f) continue;
        f.key = sub(String(f.key ?? ''));
        if (f.kind !== 'file') f.value = sub(String(f.value ?? ''));
      }
    }
  }
}

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function specToResolved(spec: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: ResolvedRequest['body'] | null;
  timeout?: unknown;
}): ResolvedRequest {
  const method = String(spec.method || 'GET').toUpperCase();
  if (!METHODS.has(method)) throw new Error(`pm.sendRequest: unsupported method ${method}`);
  const timeout = Number(spec.timeout);
  return {
    method: method as ResolvedRequest['method'],
    url: String(spec.url),
    headers: spec.headers ?? {},
    body: spec.body ?? { type: 'none' },
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : SEND_REQUEST_TIMEOUT_MS,
    followRedirects: true,
    ignoreTlsErrors: false,
  };
}

function outputToPayload(out: SendRequestOutput): Record<string, unknown> {
  if (!out.ok) return { error: out.errorMessage || out.errorCode || 'request failed' };
  return {
    response: {
      code: out.statusCode,
      status: out.statusText,
      headers: out.headers,
      text: out.bodyBase64 ? Buffer.from(out.bodyBase64, 'base64').toString('utf-8') : '',
      responseTime: out.timing?.totalMs ?? 0,
      responseSize: out.bodySizeBytes,
    },
  };
}

/** Turn a thrown value (host- or sandbox-realm) into a one-line message with a line number when known. */
function formatError(e: unknown, filename: string): string {
  let message: string;
  let stack = '';
  if (e && typeof e === 'object') {
    const obj = e as { message?: unknown; name?: unknown; stack?: unknown };
    message = obj.message !== undefined ? String(obj.message) : String(e);
    if (obj.name === 'AssertionError') message = `AssertionError: ${message}`;
    else if (typeof obj.name === 'string' && obj.name !== 'Error' && !message.startsWith(obj.name)) {
      message = `${obj.name}: ${message}`;
    }
    stack = typeof obj.stack === 'string' ? obj.stack : '';
  } else {
    message = String(e);
  }
  if (/Script execution timed out/i.test(message)) {
    return `Script timed out after ${TIMEOUT_MS / 1000}s — check for an infinite loop`;
  }
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const loc = new RegExp(escaped + ':(\\d+)').exec(stack);
  if (loc && !message.includes(`line ${loc[1]}`)) message += ` (line ${loc[1]})`;
  return message;
}
