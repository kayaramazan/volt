// Variable resolution and request preparation.
//
// Takes an ApiRequest (with {{variables}}) and the active environment +
// collection variables, produces a ResolvedRequest ready to send.
//
// Resolution priority (highest wins):
//   1. Collection variables (and parent collections, bottom-up)
//   2. Environment variables
// Unknown variables become empty strings (we'd warn in UI but not fail).

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

  // Environment first — lowest priority, overridden by collection
  if (ctx.environment) {
    for (const v of ctx.environment.variables ?? []) {
      const value = await resolveValue(v, ctx.resolveSecret);
      map.set(v.key, value);
    }
  }

  // Collection chain: root-first, so deeper collections override
  const reversed = [...ctx.collectionChain].reverse();
  for (const c of reversed) {
    for (const v of c.variables ?? []) {
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

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

function substitute(input: string, vars: Map<string, string>, unresolved: Set<string>): string {
  return input.replace(VAR_PATTERN, (match, name: string) => {
    if (vars.has(name)) return vars.get(name)!;
    unresolved.add(name);
    return '';
  });
}

// ─────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────

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
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return;
    }
    case 'basic': {
      const u = subst(auth.username);
      const p = subst(auth.password);
      const encoded = Buffer.from(`${u}:${p}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
      return;
    }
    case 'apiKey': {
      const key = subst(auth.key);
      const value = subst(auth.value);
      if (!key) return;
      if (auth.placement === 'header') {
        headers[key] = value;
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
