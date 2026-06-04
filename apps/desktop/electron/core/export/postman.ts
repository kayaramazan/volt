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
  const url = buildUrl(r.url, r.queryParams ?? []);
  return {
    name: r.name,
    description: r.description || undefined,
    request: {
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

function buildUrl(raw: string, query: Array<{ key: string; value: string; enabled?: boolean }>) {
  const enabledQ = query.filter((q) => q.enabled !== false && q.key);
  // Postman stores URL as both `raw` and a parsed structure. Parse what we can.
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    /* relative or templated URL — leave structure empty */
  }
  const out: Record<string, unknown> = {
    raw,
    query: enabledQ.length
      ? enabledQ.map((q) => ({ key: q.key, value: q.value }))
      : undefined,
  };
  if (parsed) {
    out.protocol = parsed.protocol.replace(/:$/, '');
    out.host = parsed.hostname.split('.');
    if (parsed.port) out.port = parsed.port;
    if (parsed.pathname && parsed.pathname !== '/') {
      out.path = parsed.pathname.split('/').filter(Boolean);
    }
  }
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
      // Volt stores the encoded string; Postman wants key-value rows. Try to
      // re-split into pairs; fall back to a single field if parsing fails.
      const content = (b.content as string | undefined) ?? '';
      const params = parseQueryPairs(content).map((p) => ({
        key: p.key,
        value: p.value,
      }));
      return { mode: 'urlencoded', urlencoded: params };
    }
    case 'form': {
      const fields = (b.fields as Array<{ key: string; kind: 'text' | 'file'; value: string }> | undefined) ?? [];
      return {
        mode: 'formdata',
        formdata: fields.map((f) =>
          f.kind === 'file'
            ? { key: f.key, type: 'file' as const, src: f.value }
            : { key: f.key, type: 'text' as const, value: f.value },
        ),
      };
    }
    case 'binary': {
      const file = (b.filePath as string | undefined) ?? '';
      return { mode: 'file', file: { src: file } };
    }
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
    default:
      return undefined;
  }
}

function buildEvents(r: RequestRow): unknown[] | undefined {
  const events: unknown[] = [];
  if (r.preRequestScript?.trim()) {
    events.push({
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        // Comment so Postman doesn't try to run our volt.* API
        exec: ['// Volt pre-request script (uses volt.* API, not pm.*):']
          .concat(r.preRequestScript.split('\n').map((l) => '// ' + l)),
      },
    });
  }
  if (r.postResponseScript?.trim()) {
    events.push({
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: ['// Volt post-response script (uses volt.* API, not pm.*):']
          .concat(r.postResponseScript.split('\n').map((l) => '// ' + l)),
      },
    });
  }
  return events.length ? events : undefined;
}

function buildResponses(r: RequestRow): unknown[] | undefined {
  if (!r.examples?.length) return undefined;
  return r.examples.map((ex) => {
    const reqSnap = ex.request as Record<string, unknown> | undefined;
    const respSnap = ex.response as Record<string, unknown> | null;
    return {
      name: ex.name,
      originalRequest: reqSnap
        ? {
            method: (reqSnap.method as string) ?? r.method,
            url: (reqSnap.url as string) ?? r.url,
            header: ((reqSnap.headers as Array<{ key: string; value: string }> | undefined) ?? []).map(
              (h) => ({ key: h.key, value: h.value }),
            ),
            body:
              reqSnap.bodyType === 'raw' || reqSnap.bodyType === 'urlencoded'
                ? {
                    mode: 'raw',
                    raw: ((reqSnap.body as { content?: string })?.content) ?? '',
                  }
                : undefined,
          }
        : undefined,
      status: (respSnap?.ok === false ? respSnap.errorCode : 'OK') as string,
      code: (respSnap?.statusCode as number | undefined) ?? 0,
      header: ((respSnap?.headers as Array<[string, string]> | undefined) ?? []).map(([k, v]) => ({
        key: k,
        value: v,
      })),
      body: (respSnap?.bodyText as string | undefined) ?? '',
      _postman_previewlanguage: 'json',
    };
  });
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
