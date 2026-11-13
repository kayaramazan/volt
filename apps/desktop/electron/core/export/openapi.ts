// Export a Volt collection to OpenAPI 3.0 JSON.
//
// OpenAPI describes an API surface; Volt holds concrete request examples.
// We reverse-engineer a minimal spec:
//   - Group requests by host. First host becomes the `servers[0].url`.
//   - Each unique path becomes a path item; each request hitting that path
//     contributes an operation under the method key.
//   - Headers + query params become `parameters`.
//   - Bodies become `requestBody.content` with a single mime-typed example.
//   - Bearer/Basic/apiKey auth → securitySchemes.
//
// Things to know:
//   - We don't try to infer JSON schemas — we just attach the body as an
//     example. Tools that auto-generate schemas from examples will fill in.
//   - Path templating: if the URL contains `{vars}`-style placeholders we
//     keep them; `{{vars}}` are kept as-is (the user can re-template by hand).
//   - Operation IDs are generated from `method + path + index` so they're
//     unique even when the same request appears twice.

import {
  listCollections,
  listRequests,
} from '../db/queries';

interface CollectionRow {
  id: string;
  parentId: string | null;
  name: string;
  description?: string;
}

interface RequestRow {
  id: string;
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean; description?: string }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean; description?: string }>;
  bodyType: string;
  body: Record<string, unknown>;
  auth: Record<string, unknown>;
  description?: string;
}

export function exportOpenAPI(
  workspaceId: string,
  rootCollectionId: string | null,
): { content: string; filename: string } {
  const collections = listCollections(workspaceId) as unknown as CollectionRow[];
  const allRequests = listRequests(workspaceId) as unknown as RequestRow[];

  const included = rootCollectionId
    ? collectDescendants(rootCollectionId, collections)
    : null;
  const requests = included
    ? allRequests.filter((r) => r.collectionId && included.has(r.collectionId))
    : allRequests;

  const rootCollection = rootCollectionId
    ? collections.find((c) => c.id === rootCollectionId)
    : null;

  // Pick a base server URL from the most common origin across requests.
  const origins = new Map<string, number>();
  for (const r of requests) {
    const o = originOf(r.url);
    if (o) origins.set(o, (origins.get(o) ?? 0) + 1);
  }
  const topOrigin = [...origins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const paths: Record<string, Record<string, unknown>> = {};
  const securitySchemes: Record<string, unknown> = {};
  const opCounter = new Map<string, number>();

  for (const r of requests) {
    // Postman-style `:id` segments become OpenAPI `{id}` templates.
    const pathname = (pathnameOf(r.url) || '/').replace(/\/:([A-Za-z_][\w-]*)/g, '/{$1}');
    if (!paths[pathname]) paths[pathname] = {};
    const method = r.method.toLowerCase();

    const opKey = `${method}_${pathname}`;
    const dup = opCounter.get(opKey) ?? 0;
    opCounter.set(opKey, dup + 1);
    const idSuffix = dup === 0 ? '' : `_${dup + 1}`;

    const tag = (() => {
      if (!r.collectionId) return undefined;
      const owner = collections.find((c) => c.id === r.collectionId);
      return owner?.name;
    })();

    const operation: Record<string, unknown> = {
      operationId: `${method}${slug(pathname)}${idSuffix}`.replace(/^[^a-zA-Z_]/, '_'),
      summary: r.name,
      description: r.description || undefined,
      tags: tag ? [tag] : undefined,
      parameters: buildParameters(r),
    };

    const reqBody = buildRequestBody(r);
    if (reqBody) operation.requestBody = reqBody;

    const auth = mapAuthToSecurityScheme(r.auth, securitySchemes);
    if (auth) operation.security = [{ [auth]: [] }];

    operation.responses = {
      '200': { description: 'Successful response' },
    };

    paths[pathname][method] = operation;
  }

  const out: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: rootCollection?.name ?? 'Volt Export',
      description: rootCollection?.description ?? 'Generated from Volt.',
      version: '1.0.0',
    },
    servers: topOrigin ? [{ url: topOrigin }] : undefined,
    paths,
  };
  if (Object.keys(securitySchemes).length > 0) {
    out.components = { securitySchemes };
  }

  const safeName = (rootCollection?.name ?? 'volt_export').replace(/[^a-z0-9-_]+/gi, '_');
  return {
    content: JSON.stringify(out, null, 2),
    filename: `${safeName}.openapi.json`,
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

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    // Could be a relative URL — return everything before "?" if so.
    const q = url.indexOf('?');
    return q >= 0 ? url.slice(0, q) : url || null;
  }
}

function buildParameters(r: RequestRow): unknown[] | undefined {
  const params: unknown[] = [];
  for (const q of r.queryParams ?? []) {
    if (q.enabled === false || !q.key) continue;
    params.push({
      name: q.key,
      in: 'query',
      description: q.description,
      schema: { type: 'string', example: q.value },
    });
  }
  for (const h of r.headers ?? []) {
    if (h.enabled === false || !h.key) continue;
    // Skip headers that OpenAPI/auth tooling treats specially.
    const k = h.key.toLowerCase();
    if (k === 'authorization' || k === 'content-type' || k === 'accept') continue;
    params.push({
      name: h.key,
      in: 'header',
      description: h.description,
      schema: { type: 'string', example: h.value },
    });
  }
  // Path templating: detect `{foo}` placeholders (and Postman-style `:foo`) in the URL pathname.
  const pn = (pathnameOf(r.url) || '').replace(/\/:([A-Za-z_][\w-]*)/g, '/{$1}');
  const pathVars = [...pn.matchAll(/\{([^/{}]+)\}/g)].map((m) => m[1]);
  for (const name of pathVars) {
    params.push({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }
  return params.length ? params : undefined;
}

function buildRequestBody(r: RequestRow): unknown {
  const b = r.body ?? {};
  switch (r.bodyType) {
    case 'raw': {
      const lang = (b.language as string | undefined) ?? 'text';
      const mime =
        lang === 'json'
          ? 'application/json'
          : lang === 'xml'
            ? 'application/xml'
            : lang === 'html'
              ? 'text/html'
              : 'text/plain';
      const content = (b.content as string | undefined) ?? '';
      const example =
        mime === 'application/json' ? tryParseJson(content) : content;
      return {
        content: {
          [mime]: {
            example,
          },
        },
      };
    }
    case 'urlencoded': {
      // Volt stores key/value rows; older rows may carry an encoded `content` string.
      const params =
        (b.fields as Array<{ key: string; value: string; enabled?: boolean }> | undefined)?.filter(
          (f) => f.enabled !== false && f.key,
        ) ?? parseQueryPairs((b.content as string | undefined) ?? '');
      const props: Record<string, unknown> = {};
      for (const p of params) props[p.key] = { type: 'string', example: p.value };
      return {
        content: {
          'application/x-www-form-urlencoded': {
            schema: { type: 'object', properties: props },
          },
        },
      };
    }
    case 'form': {
      const fields =
        (b.fields as Array<{ key: string; kind: 'text' | 'file'; value: string }> | undefined) ??
        [];
      const props: Record<string, unknown> = {};
      for (const f of fields) {
        props[f.key] =
          f.kind === 'file'
            ? { type: 'string', format: 'binary' }
            : { type: 'string', example: f.value };
      }
      return {
        content: {
          'multipart/form-data': {
            schema: { type: 'object', properties: props },
          },
        },
      };
    }
    case 'binary':
      return {
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    case 'graphql': {
      let variables: unknown = {};
      try {
        variables = JSON.parse((b.variables as string | undefined) || '{}');
      } catch {
        variables = (b.variables as string | undefined) ?? '';
      }
      return {
        content: {
          'application/json': {
            example: { query: (b.query as string | undefined) ?? '', variables },
          },
        },
      };
    }
    default:
      return undefined;
  }
}

function mapAuthToSecurityScheme(
  auth: Record<string, unknown> | undefined,
  registry: Record<string, unknown>,
): string | null {
  if (!auth || !auth.type || auth.type === 'none') return null;
  if (auth.type === 'bearer') {
    if (!registry['BearerAuth']) {
      registry['BearerAuth'] = { type: 'http', scheme: 'bearer' };
    }
    return 'BearerAuth';
  }
  if (auth.type === 'basic') {
    if (!registry['BasicAuth']) {
      registry['BasicAuth'] = { type: 'http', scheme: 'basic' };
    }
    return 'BasicAuth';
  }
  if (auth.type === 'apiKey') {
    const name = (auth.key as string) ?? 'X-API-Key';
    const inLoc = (auth.placement as string) === 'query' ? 'query' : 'header';
    const id = `ApiKey_${(name as string).replace(/[^a-zA-Z0-9]/g, '_')}_${inLoc}`;
    if (!registry[id]) {
      registry[id] = { type: 'apiKey', name, in: inLoc };
    }
    return id;
  }
  return null;
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
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

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
