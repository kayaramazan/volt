// Variable resolution and request preparation.
//
// Takes an ApiRequest (with {{variables}}) and the active environment +
// collection variables, produces a ResolvedRequest ready to send.
//
// Resolution priority (highest wins, Postman parity):
//   1. Environment variables
//   2. Collection variables (and parent collections, bottom-up)
//   3. Globals (per-device key/value store)
//   4. Dynamic variables ({{$guid}}, {{$timestamp}}, …)
// Disabled variables (enabled === false) are skipped.
// Unknown variables become empty strings (we'd warn in UI but not fail).
//
// NOTE: the renderer performs the same merge in RequestEditor (resolveLocally)
// before calling request:send; keep the two in step.

import { randomUUID } from 'node:crypto';

import type {
  ApiRequest,
  Collection,
  Environment,
  RequestAuth,
  RequestBody,
  ResolvedRequest,
  Variable,
} from '@volt/shared';

interface ResolveContext {
  request: ApiRequest;
  environment: Environment | null;
  /**
   * Collections from this request's parent up to root. The first item is the
   * direct parent. Variables defined closer to the request take priority.
   */
  collectionChain: Collection[];
  /** Per-device globals (lowest priority). Non-string values are JSON-encoded. */
  globals?: Record<string, unknown> | null;
  /**
   * Secret resolver — used to fetch values for variables flagged secretRef.
   * In production this calls keytar; in tests can be a Map lookup.
   */
  resolveSecret: (secretRef: string) => Promise<string | null>;
}

export async function resolveRequest(ctx: ResolveContext): Promise<{
  resolved: ResolvedRequest;
  unresolvedVars: string[];
}> {
  const variables = await collectVariables(ctx);
  const unresolved = new Set<string>();
  const subst = (s: string) => substitute(s, variables, unresolved);

  // Resolve URL with substitution + apply query params
  let url = subst(ctx.request.url);
  const queryPairs: [string, string][] = [];
  for (const q of ctx.request.queryParams) {
    if (q.enabled !== false) queryPairs.push([subst(q.key), subst(q.value)]);
  }
  if (queryPairs.length > 0) {
    const sep = url.includes('?') ? '&' : '?';
    url +=
      sep +
      queryPairs
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
  }

  // Resolve headers
  const headers: Record<string, string> = {};
  for (const h of ctx.request.headers) {
    if (h.enabled !== false) {
      const key = subst(h.key);
      const value = subst(h.value);
      if (key) headers[key] = value;
    }
  }

  // Apply auth (merges into headers or url)
  applyAuth(ctx.request.auth, subst, headers, url, (newUrl) => (url = newUrl));

  // Resolve body
  const body = resolveBody(ctx.request.body, subst);

  return {
    resolved: {
      method: ctx.request.method,
      url,
      headers,
      body,
      timeoutMs: 60_000,
      followRedirects: true,
      ignoreTlsErrors: false,
    },
    unresolvedVars: Array.from(unresolved),
  };
}

// ─────────────────────────────────────────────────────────
// Collection of variables (with secret resolution)
// ─────────────────────────────────────────────────────────

async function collectVariables(ctx: ResolveContext): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Globals first — lowest priority
  for (const [k, v] of Object.entries(ctx.globals ?? {})) {
    if (v == null || !k) continue;
    map.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  // Collection chain: root-first, so deeper collections override
  const reversed = [...ctx.collectionChain].reverse();
  for (const c of reversed) {
    for (const v of c.variables ?? []) {
      if (v.enabled === false || !v.key) continue;
      const value = await resolveValue(v, ctx.resolveSecret);
      map.set(v.key, value);
    }
  }

  // Environment last — highest priority (Postman: env > collection > global)
  if (ctx.environment) {
    for (const v of ctx.environment.variables ?? []) {
      if (v.enabled === false || !v.key) continue;
      const value = await resolveValue(v, ctx.resolveSecret);
      map.set(v.key, value);
    }
  }

  return map;
}

async function resolveValue(
  v: Variable,
  resolveSecret: (ref: string) => Promise<string | null>,
): Promise<string> {
  if (v.secretRef) {
    const secret = await resolveSecret(v.secretRef);
    return secret ?? '';
  }
  return v.value;
}

// ─────────────────────────────────────────────────────────
// Substitution
// ─────────────────────────────────────────────────────────

const VAR_PATTERN = /\{\{\s*(\$?[\w.-]+)\s*\}\}/g;

// Postman-style dynamic variables, generated fresh for every occurrence.
const DYNAMIC: Record<string, () => string> = {
  $guid: () => randomUUID(),
  $randomUUID: () => randomUUID(),
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $isoTimestamp: () => new Date().toISOString(),
  $randomInt: () => String(Math.floor(Math.random() * 1001)),
  $randomBoolean: () => String(Math.random() < 0.5),
};

function substitute(input: string, vars: Map<string, string>, unresolved: Set<string>): string {
  if (!input || !input.includes('{{')) return input;
  return input.replace(VAR_PATTERN, (match, name: string) => {
    if (vars.has(name)) return vars.get(name)!;
    const dyn = Object.prototype.hasOwnProperty.call(DYNAMIC, name) ? DYNAMIC[name] : undefined;
    if (dyn) return dyn();
    unresolved.add(name);
    return '';
  });
}

// ─────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────

/**
 * Set a header, replacing any existing entry with the same name regardless of
 * case. Like Postman, the auth helper wins over a manually typed
 * `authorization:` row — and we never send the header twice.
 */
function setHeaderCI(headers: Record<string, string>, name: string, value: string) {
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) delete headers[k];
  }
  headers[name] = value;
}

function applyAuth(
  auth: RequestAuth,
  subst: (s: string) => string,
  headers: Record<string, string>,
  url: string,
  setUrl: (newUrl: string) => void,
) {
  switch (auth.type) {
    case 'none':
      return;
    case 'bearer': {
      const token = subst(auth.token);
      if (token) setHeaderCI(headers, 'Authorization', `Bearer ${token}`);
      return;
    }
    case 'basic': {
      const u = subst(auth.username);
      const p = subst(auth.password);
      const encoded = Buffer.from(`${u}:${p}`).toString('base64');
      setHeaderCI(headers, 'Authorization', `Basic ${encoded}`);
      return;
    }
    case 'apiKey': {
      const key = subst(auth.key);
      const value = subst(auth.value);
      if (!key) return;
      if (auth.placement === 'header') {
        setHeaderCI(headers, key, value);
      } else {
        const sep = url.includes('?') ? '&' : '?';
        setUrl(url + sep + `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
      return;
    }
    case 'oauth2': {
      // OAuth lookup is async; the resolver itself is sync. We don't fetch
      // here — IPC handler does it before calling executeRequest and injects
      // the token via `Authorization: <prefix> <token>`. So at resolve time
      // we leave the header empty; the engine layer will set it.
      return;
    }
  }
}

// ─────────────────────────────────────────────────────────
// Body
// ─────────────────────────────────────────────────────────

function resolveBody(body: RequestBody, subst: (s: string) => string): ResolvedRequest['body'] {
  switch (body.type) {
    case 'none':
      return { type: 'none' };
    case 'raw':
      return { type: 'raw', content: subst(body.content) };
    case 'form':
      return {
        type: 'form',
        fields: body.fields
          .filter((f) => f.enabled !== false)
          .map((f) => ({
            key: subst(f.key),
            kind: f.kind,
            // for files, the path itself is not subst'd
            value: f.kind === 'text' ? subst(f.value) : f.value,
          })),
      };
    case 'urlencoded':
      return {
        type: 'urlencoded',
        content: body.fields
          .filter((f) => f.enabled !== false)
          .map((f) => `${encodeURIComponent(subst(f.key))}=${encodeURIComponent(subst(f.value))}`)
          .join('&'),
      };
    case 'binary':
      return { type: 'binary', filePath: body.filePath };
    case 'graphql':
      return {
        type: 'graphql',
        query: subst((body as { query?: string }).query ?? ''),
        variables: subst((body as { variables?: string }).variables ?? ''),
        operationName: (body as { operationName?: string }).operationName,
      } as never;
    case 'grpc':
      // gRPC requests don't flow through the HTTP resolver — they have a
      // dedicated path in the renderer (GrpcRequestEditor) that calls the
      // grpc:invoke IPC directly. Hitting this branch is a bug.
      throw new Error('gRPC requests must be sent via grpc:invoke, not request:send.');
  }
}
