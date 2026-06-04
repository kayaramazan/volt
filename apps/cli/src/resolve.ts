// Variable substitution + request resolution. Mirrors the desktop's
// electron/core/http/resolve.ts logic at a smaller scope — we only need
// to support what the CLI can send (no GraphQL editor body, no binary
// uploads, etc., but we leave hooks so they can be added later).

import type { ApiRequest, Collection, Environment } from './db';

const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface ResolvedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: { type: 'none' } | { type: 'raw'; content: string };
  timeoutMs: number;
}

export interface ResolveContext {
  collectionChain: Collection[]; // root → deepest (deepest wins)
  environment: Environment | null;
  globals: Record<string, unknown>;
}

export interface ResolveWarning {
  kind: 'unsupported-body' | 'unsupported-auth' | 'unsupported-script' | 'unresolved-var';
  message: string;
}

export function buildVarMap(ctx: ResolveContext): Map<string, string> {
  const m = new Map<string, string>();
  // Globals → env → collection chain (deepest last so it overrides).
  for (const [k, v] of Object.entries(ctx.globals)) {
    if (v != null) m.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  if (ctx.environment) {
    for (const v of ctx.environment.variables) m.set(v.key, v.value);
  }
  for (const c of [...ctx.collectionChain].reverse()) {
    for (const v of c.variables) m.set(v.key, v.value);
  }
  return m;
}

export function substituteWith(vars: Map<string, string>, warnings: ResolveWarning[]) {
  return (s: string): string =>
    s.replace(VAR_RE, (_, name) => {
      const hit = vars.get(name);
      if (hit == null) {
        warnings.push({
          kind: 'unresolved-var',
          message: `Unresolved variable: {{${name}}}`,
        });
        return '';
      }
      return hit;
    });
}

export function resolveRequest(
  req: ApiRequest,
  ctx: ResolveContext,
): { resolved: ResolvedRequest; warnings: ResolveWarning[] } {
  const warnings: ResolveWarning[] = [];
  const vars = buildVarMap(ctx);
  const subst = substituteWith(vars, warnings);

  // Headers (skip disabled, subst key + value)
  const headers: Record<string, string> = {};
  for (const h of req.headers ?? []) {
    if (h.enabled === false) continue;
    if (!h.key) continue;
    headers[subst(h.key)] = subst(h.value);
  }

  // URL + query params
  let url = subst(req.url);
  const qs = (req.queryParams ?? [])
    .filter((q) => q.enabled !== false && q.key)
    .map((q) => `${encodeURIComponent(subst(q.key))}=${encodeURIComponent(subst(q.value))}`)
    .join('&');
  if (qs) url += (url.includes('?') ? '&' : '?') + qs;

  // Body — handle the common cases. Anything unsupported emits a warning
  // and falls back to no body so the CLI still sends *something*.
  const bodyOut = resolveBody(req, subst, warnings);

  // Auth — Bearer/Basic/API key map to headers (or to query for apiKey w/ placement=query).
  applyAuth(req, headers, url, subst, warnings);

  // Pre/post scripts — explicitly unsupported in this build.
  if (req.preRequestScript?.trim() || req.postResponseScript?.trim()) {
    warnings.push({
      kind: 'unsupported-script',
      message: 'Pre/post-request scripts are not yet executed by the CLI; sending raw request.',
    });
  }

  return {
    resolved: {
      method: req.method,
      url,
      headers,
      body: bodyOut,
      timeoutMs: 60_000,
    },
    warnings,
  };
}

function resolveBody(
  req: ApiRequest,
  subst: (s: string) => string,
  warnings: ResolveWarning[],
): ResolvedRequest['body'] {
  const body = req.body as { type?: string } | null;
  const type = body?.type ?? 'none';
  if (type === 'none') return { type: 'none' };
  if (type === 'raw') {
    const content = (body as { content?: string }).content ?? '';
    return { type: 'raw', content: subst(content) };
  }
  if (type === 'urlencoded') {
    const fields = (body as { fields?: Array<{ key: string; value: string; enabled?: boolean }> })
      .fields ?? [];
    const content = fields
      .filter((f) => f.enabled !== false && f.key)
      .map((f) => `${encodeURIComponent(subst(f.key))}=${encodeURIComponent(subst(f.value))}`)
      .join('&');
    return { type: 'raw', content };
  }
  if (type === 'graphql') {
    const q = (body as { query?: string }).query ?? '';
    const v = (body as { variables?: string }).variables ?? '';
    let variables: unknown = undefined;
    if (v.trim()) {
      try {
        variables = JSON.parse(subst(v));
      } catch {
        warnings.push({
          kind: 'unsupported-body',
          message: 'GraphQL variables were not valid JSON; sending the query without variables.',
        });
      }
    }
    return {
      type: 'raw',
      content: JSON.stringify({ query: subst(q), variables }),
    };
  }
  warnings.push({
    kind: 'unsupported-body',
    message: `Body type "${type}" is not yet supported by the CLI; sending no body.`,
  });
  return { type: 'none' };
}

function applyAuth(
  req: ApiRequest,
  headers: Record<string, string>,
  _url: string,
  subst: (s: string) => string,
  warnings: ResolveWarning[],
) {
  const auth = req.auth as { type?: string } | null;
  const t = auth?.type ?? 'none';
  if (t === 'none') return;
  if (t === 'bearer') {
    const token = (auth as { token?: string }).token ?? '';
    if (token) headers['Authorization'] = `Bearer ${subst(token)}`;
    return;
  }
  if (t === 'basic') {
    const u = (auth as { username?: string }).username ?? '';
    const p = (auth as { password?: string }).password ?? '';
    const encoded = Buffer.from(`${subst(u)}:${subst(p)}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
    return;
  }
  if (t === 'apiKey') {
    const key = (auth as { key?: string }).key ?? '';
    const value = (auth as { value?: string }).value ?? '';
    const placement = (auth as { placement?: string }).placement ?? 'header';
    if (placement === 'header') {
      headers[subst(key)] = subst(value);
    } else {
      // The url is only available read-only here; we'd have to mutate. For
      // first milestone we route apiKey-in-query through headers if asked,
      // but real apiKey-in-query support is on the polish list.
      warnings.push({
        kind: 'unsupported-auth',
        message: 'API key in query string is not yet wired in the CLI; sent as header instead.',
      });
      headers[subst(key)] = subst(value);
    }
    return;
  }
  warnings.push({
    kind: 'unsupported-auth',
    message: `Auth type "${t}" is not yet supported by the CLI; sending unauthenticated request.`,
  });
}

/** Walk parents upward, returning the chain from the request's collection
 *  (deepest) → root. Caller reverses if they want root-first.
 */
export function collectionChainFor(
  req: ApiRequest,
  collections: Collection[],
): Collection[] {
  const chain: Collection[] = [];
  let id = req.collectionId;
  const byId = new Map(collections.map((c) => [c.id, c] as const));
  while (id) {
    const c = byId.get(id);
    if (!c) break;
    chain.push(c);
    id = c.parentId;
  }
  return chain;
}
