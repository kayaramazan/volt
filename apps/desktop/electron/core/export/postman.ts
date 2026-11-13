// Export a Volt collection to Postman v2.1 JSON.
//
// Mirrors the shape that `import/postman.ts` ingests, so a round-trip
// (Volt → Postman → Volt) preserves the same data.
//
// What we map:
//   - Collection name + description + variables → top-level info + variable[]
//   - Sub-collections → items with `item[]` (folders)
//   - Requests → items with `request: {...}`
//   - Auth: none/bearer/basic/apiKey ↔ Postman auth types
//   - Bodies: raw/form/urlencoded/binary ↔ Postman body modes
//
// What we drop (intentional or unsupported by Postman 2.1):
//   - Pre/post-request scripts (Postman has scripts but they speak Postman's
//     `pm.*` API; ours speak `volt.*`. We DO embed them as commented exec[]
//     bodies so the user can port them manually.)
//   - Examples — Postman supports them; we serialize as `response[]`.

import {
  listCollections,
  listEnvironments,
  listRequests,
} from '../db/queries';

interface CollectionRow {
  id: string;
  parentId: string | null;
  name: string;
  description?: string;
  variables?: Array<{ key: string; value: string }>;
}

interface RequestRow {
  id: string;
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean; description?: string }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>;
  pathVariables?: Array<{ key: string; value: string; enabled?: boolean; description?: string }>;
  bodyType: string;
  body: Record<string, unknown>;
  auth: Record<string, unknown>;
  description?: string;
  preRequestScript?: string;
  postResponseScript?: string;
  examples?: Array<{
    name: string;
    request: Record<string, unknown>;
    response: Record<string, unknown> | null;
  }>;
}

export function exportPostman(
  workspaceId: string,
  rootCollectionId: string | null,
): { content: string; filename: string } {
  const collections = (listCollections(workspaceId) as unknown as CollectionRow[]);
  const requests = (listRequests(workspaceId) as unknown as RequestRow[]);
  const envs = listEnvironments(workspaceId);

  // If a root collection was specified, restrict to it + descendants.
  const includedIds = rootCollectionId ? collectDescendants(rootCollectionId, collections) : null;
  const filteredCollections = includedIds
    ? collections.filter((c) => includedIds.has(c.id))
    : collections;
  const filteredRequests = includedIds
    ? requests.filter((r) => r.collectionId && includedIds.has(r.collectionId))
    : requests;

  // Locate the "root" of the export: either the specified root, or a synthetic
  // top-level collection wrapping everything that doesn't have a parent.
  const rootRow = rootCollectionId
    ? filteredCollections.find((c) => c.id === rootCollectionId)
    : null;
  const rootName = rootRow?.name ?? 'Volt Export';
  const rootDescription = rootRow?.description ?? '';
  const rootVariables = rootRow?.variables ?? [];

  const directChildrenOf = (parentId: string | null): CollectionRow[] =>
    filteredCollections.filter((c) => c.parentId === parentId);
  const requestsIn = (collectionId: string | null): RequestRow[] =>
    filteredRequests.filter((r) => (r.collectionId ?? null) === collectionId);

  function buildFolder(coll: CollectionRow): unknown {
    const items: unknown[] = [];
    for (const child of directChildrenOf(coll.id)) items.push(buildFolder(child));
    for (const req of requestsIn(coll.id)) items.push(buildRequest(req));
    return {
      name: coll.name,
      description: coll.description || undefined,
      item: items,
      variable: postmanVars(coll.variables ?? []),
    };
  }

  // Top-level items: either children of the root collection, OR the entire
  // top-level of the workspace.
  const topItems: unknown[] = [];
  if (rootRow) {
    for (const child of directChildrenOf(rootRow.id)) topItems.push(buildFolder(child));
    for (const req of requestsIn(rootRow.id)) topItems.push(buildRequest(req));
  } else {
    for (const child of directChildrenOf(null)) topItems.push(buildFolder(child));
    for (const req of requestsIn(null)) topItems.push(buildRequest(req));
  }

  const out = {
    info: {
      _postman_id: rootCollectionId ?? cryptoRandom(),
      name: rootName,
      description: rootDescription || undefined,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: topItems,
    variable: postmanVars(rootVariables),
  };

  // Postman environment exports are a separate file format; we don't combine.
  // If env data is desired, the user can export it manually — we just warn.
  void envs;

  const safeName = rootName.replace(/[^a-z0-9-_]+/gi, '_');
  return {
    content: JSON.stringify(out, null, 2),
    filename: `${safeName}.postman_collection.json`,
  };
}

function collectDescendants(rootId: string, all: CollectionRow[]): Set<string> {
  const out = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        added = true;
      }
    }
  }
  return out;
}

function postmanVars(vars: Array<{ key: string; value: string }>) {
  if (!vars.length) return undefined;
  return vars.map((v) => ({ key: v.key, value: v.value, type: 'string' as const }));
}

function buildRequest(r: RequestRow): unknown {
  const headers = r.headers ?? [];
  const url = buildUrl(r.url, r.queryParams ?? [], r.pathVariables ?? []);
  return {
    name: r.name,
    request: {
      description: r.description || undefined,
      method: r.method.toUpperCase(),
      header: headers.map((h) => ({
        key: h.key,
        value: h.value,
        description: h.description,
        disabled: h.enabled === false ? true : undefined,
        type: 'text' as const,
      })),
      url,
      body: buildBody(r),
      auth: buildAuth(r.auth),
    },
    event: buildEvents(r),
    response: buildResponses(r),
  };
}

function buildUrl(
  rawUrl: string,
  query: Array<{ key: string; value: string; enabled?: boolean; description?: string }>,
  pathVariables: Array<{ key: string; value: string; enabled?: boolean; description?: string }> = [],
) {
  // Volt sends `url` + enabled `queryParams`; a `?…` already typed into the
  // URL is sent as-is. Postman wants both the full `raw` and a structured
  // `query[]` (which is what it shows in the Params table), so merge the two.
  const qIdx = rawUrl.indexOf('?');
  const base = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
  const inline = qIdx >= 0 ? parseQueryPairs(rawUrl.slice(qIdx + 1)) : [];
  const all = [
    ...inline.map((p) => ({ key: p.key, value: p.value, enabled: true as boolean, description: undefined as string | undefined })),
    ...query.filter((q) => q.key).map((q) => ({ key: q.key, value: q.value, enabled: q.enabled !== false, description: q.description })),
  ];
  const enabledQ = all.filter((q) => q.enabled);
  const raw =
    base +
    (enabledQ.length ? '?' + enabledQ.map((q) => `${q.key}=${q.value}`).join('&') : '');

  // Postman stores URL as both `raw` and a parsed structure. Parse what we can.
  let parsed: URL | null = null;
  try {
    if (!/\{\{/.test(base)) parsed = new URL(base);
  } catch {
    /* relative or templated URL — leave structure empty */
  }
  const out: Record<string, unknown> = {
    raw,
    query: all.length
      ? all.map((q) => ({
          key: q.key,
          value: q.value,
          disabled: q.enabled ? undefined : true,
          description: q.description || undefined,
        }))
      : undefined,
  };
  if (parsed) {
    out.protocol = parsed.protocol.replace(/:$/, '');
    out.host = parsed.hostname.split('.');
    if (parsed.port) out.port = parsed.port;
    if (parsed.pathname && parsed.pathname !== '/') {
      out.path = parsed.pathname.split('/').filter(Boolean);
    }
  } else {
    // Templated URL ({{baseUrl}}/path): Postman still expects host/path so the
    // Params table and the URL bar agree. Split on the first "/" after the host.
    const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/]*)(\/.*)?$/i.exec(base);
    if (m) {
      if (m[1]) out.protocol = m[1];
      if (m[2]) out.host = m[2].split('.');
      if (m[3] && m[3] !== '/') out.path = m[3].split('/').filter(Boolean);
    }
  }

  // Path variables: Postman lists every `:name` segment in `url.variable[]`.
  // Use the stored rows when present; otherwise derive empty ones from the URL.
  const names = [...base.matchAll(/(?:^|\/):([A-Za-z_][\w-]*)/g)].map((mm) => mm[1]!);
  const stored = new Map(pathVariables.filter((p) => p.key).map((p) => [p.key, p] as const));
  const variable: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const name of [...names, ...stored.keys()]) {
    if (seen.has(name)) continue;
    seen.add(name);
    const p = stored.get(name);
    variable.push({
      key: name,
      value: p?.value ?? '',
      disabled: p && p.enabled === false ? true : undefined,
      description: p?.description || undefined,
    });
  }
  if (variable.length) out.variable = variable;
  return out;
}

function buildBody(r: RequestRow): unknown {
  const b = r.body ?? {};
  switch (r.bodyType) {
    case 'raw': {
      const lang = (b.language as string | undefined) ?? 'text';
      return {
        mode: 'raw',
        raw: (b.content as string | undefined) ?? '',
        options: { raw: { language: lang } },
      };
    }
    case 'urlencoded': {
      // Volt stores key-value rows (older rows may carry a pre-encoded
      // `content` string — re-split that so nothing is dropped).
      const fields: Array<{ key: string; value: string; enabled?: boolean }> =
        (b.fields as Array<{ key: string; value: string; enabled?: boolean }> | undefined) ??
        parseQueryPairs((b.content as string | undefined) ?? '');
      return {
        mode: 'urlencoded',
        urlencoded: fields.map((f) => ({
          key: f.key,
          value: f.value,
          type: 'text' as const,
          disabled: f.enabled === false ? true : undefined,
        })),
      };
    }
    case 'form': {
      const fields =
        (b.fields as Array<{ key: string; kind: 'text' | 'file'; value: string; enabled?: boolean }> | undefined) ?? [];
      return {
        mode: 'formdata',
        formdata: fields.map((f) =>
          f.kind === 'file'
            ? { key: f.key, type: 'file' as const, src: f.value, disabled: f.enabled === false ? true : undefined }
            : { key: f.key, type: 'text' as const, value: f.value, disabled: f.enabled === false ? true : undefined },
        ),
      };
    }
    case 'binary': {
      const file = (b.filePath as string | undefined) ?? '';
      return { mode: 'file', file: { src: file } };
    }
    case 'graphql':
      return {
        mode: 'graphql',
        graphql: {
          query: (b.query as string | undefined) ?? '',
          variables: (b.variables as string | undefined) ?? '',
        },
      };
    default:
      return undefined;
  }
}

function buildAuth(auth: Record<string, unknown> | undefined): unknown {
  if (!auth || !auth.type || auth.type === 'none') return undefined;
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearer: [{ key: 'token', value: (auth.token as string) ?? '', type: 'string' }],
      };
    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: (auth.username as string) ?? '', type: 'string' },
          { key: 'password', value: (auth.password as string) ?? '', type: 'string' },
        ],
      };
    case 'apiKey':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: (auth.key as string) ?? '', type: 'string' },
          { key: 'value', value: (auth.value as string) ?? '', type: 'string' },
          {
            key: 'in',
            value: (auth.placement as string) === 'query' ? 'query' : 'header',
            type: 'string',
          },
        ],
      };
    case 'oauth2': {
      const grant = auth.grant as string | undefined;
      const s = (k: string) => (auth[k] as string | undefined) ?? '';
      const params: Array<{ key: string; value: string; type: 'string' }> = [
        {
          key: 'grant_type',
          value:
            grant === 'client_credentials'
              ? 'client_credentials'
              : grant === 'password'
                ? 'password_credentials'
                : 'authorization_code',
          type: 'string',
        },
        { key: 'accessTokenUrl', value: s('tokenUrl'), type: 'string' },
        { key: 'clientId', value: s('clientId'), type: 'string' },
        { key: 'clientSecret', value: s('clientSecret'), type: 'string' },
        { key: 'headerPrefix', value: s('headerPrefix') || 'Bearer', type: 'string' },
        { key: 'addTokenTo', value: 'header', type: 'string' },
      ];
      if (s('authUrl')) params.push({ key: 'authUrl', value: s('authUrl'), type: 'string' });
      if (s('redirectUri')) params.push({ key: 'redirect_uri', value: s('redirectUri'), type: 'string' });
      if (s('scope')) params.push({ key: 'scope', value: s('scope'), type: 'string' });
      if (s('username')) params.push({ key: 'username', value: s('username'), type: 'string' });
      if (s('password')) params.push({ key: 'password', value: s('password'), type: 'string' });
      return { type: 'oauth2', oauth2: params };
    }
    default:
      return undefined;
  }
}

// Scripts are exported verbatim: the sandbox speaks Postman's pm.* API, so
// what runs here runs in Postman. Older Volt builds stored Postman scripts
// commented-out behind this marker — unwrap those so they still round-trip.
const PM_MARKER = '// Imported from Postman. Scripts use the pm.* API, which Volt does not provide —';

function scriptExec(script: string): string[] {
  const lines = script.split('\n');
  if (lines[0] === PM_MARKER) {
    return lines
      .slice(lines[1]?.startsWith('// port this') ? 2 : 1)
      .map((l) => (l.startsWith('// ') ? l.slice(3) : l === '//' ? '' : l));
  }
  return lines;
}

function buildEvents(r: RequestRow): unknown[] | undefined {
  const events: unknown[] = [];
  if (r.preRequestScript?.trim()) {
    events.push({
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: scriptExec(r.preRequestScript) },
    });
  }
  if (r.postResponseScript?.trim()) {
    events.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: scriptExec(r.postResponseScript) },
    });
  }
  return events.length ? events : undefined;
}

function buildResponses(r: RequestRow): unknown[] | undefined {
  if (!r.examples?.length) return undefined;
  return r.examples.map((ex) => {
    const reqSnap = ex.request as Record<string, unknown> | undefined;
    const respSnap = ex.response as Record<string, unknown> | null;
    const code = (respSnap?.statusCode as number | undefined) ?? 0;
    const respHeaders = ((respSnap?.headers as Array<[string, string] | { key: string; value: string }> | undefined) ?? []).map(
      (h) => (Array.isArray(h) ? { key: h[0], value: h[1] } : { key: h.key, value: h.value }),
    );
    const contentType =
      (respSnap?.contentType as string | undefined) ??
      respHeaders.find((h) => h.key.toLowerCase() === 'content-type')?.value ??
      '';
    const preview = /json/i.test(contentType)
      ? 'json'
      : /xml/i.test(contentType)
        ? 'xml'
        : /html/i.test(contentType)
          ? 'html'
          : 'text';
    return {
      name: ex.name,
      originalRequest: reqSnap
        ? {
            method: ((reqSnap.method as string) ?? r.method).toUpperCase(),
            header: ((reqSnap.headers as Array<{ key: string; value: string; enabled?: boolean }> | undefined) ?? []).map(
              (h) => ({ key: h.key, value: h.value, disabled: h.enabled === false ? true : undefined }),
            ),
            url: buildUrl(
              (reqSnap.url as string) ?? r.url,
              (reqSnap.queryParams as Array<{ key: string; value: string; enabled?: boolean }> | undefined) ?? [],
            ),
            body: buildBody({
              bodyType: (reqSnap.bodyType as string) ?? 'none',
              body: (reqSnap.body as Record<string, unknown>) ?? {},
            } as RequestRow),
          }
        : undefined,
      status:
        (respSnap?.statusText as string | undefined) ||
        (respSnap?.ok === false ? ((respSnap.errorCode as string) ?? 'Error') : statusTextFor(code)),
      code,
      _postman_previewlanguage: (respSnap?.previewLanguage as string | undefined) ?? preview,
      header: respHeaders,
      cookie: [],
      body: (respSnap?.bodyText as string | null | undefined) ?? '',
    };
  });
}

function statusTextFor(code: number): string {
  const table: Record<number, string> = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 301: 'Moved Permanently',
    302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity',
    429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  };
  return table[code] ?? (code ? String(code) : 'OK');
}

function parseQueryPairs(s: string): Array<{ key: string; value: string }> {
  if (!s) return [];
  return s
    .split('&')
    .filter(Boolean)
    .map((kv) => {
      const eq = kv.indexOf('=');
      if (eq < 0) return { key: decodeURIComponent(kv), value: '' };
      return {
        key: decodeURIComponent(kv.slice(0, eq)),
        value: decodeURIComponent(kv.slice(eq + 1)),
      };
    });
}

function cryptoRandom(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
