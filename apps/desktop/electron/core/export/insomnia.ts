// Export a Volt collection to Insomnia v4 JSON.
//
// Insomnia's format is a single flat `resources[]` array with `_type`
// discriminator and `parentId` links, plus a `__export_format: 4` envelope.
// Maps:
//   workspace      → wraps the export ("wrk_<rootId>")
//   request_group  → folders (Volt collections)
//   request        → requests
//   environment    → Volt environments at the workspace scope

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
  headers: Array<{ key: string; value: string; enabled?: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>;
  bodyType: string;
  body: Record<string, unknown>;
  auth: Record<string, unknown>;
  description?: string;
  preRequestScript?: string;
  postResponseScript?: string;
  sortOrder?: number;
}

interface EnvironmentRow {
  id: string;
  name: string;
  variables: Array<{ key: string; value: string }>;
}

export function exportInsomnia(
  workspaceId: string,
  rootCollectionId: string | null,
): { content: string; filename: string } {
  const collections = listCollections(workspaceId) as unknown as CollectionRow[];
  const requests = listRequests(workspaceId) as unknown as RequestRow[];
  const environments = listEnvironments(workspaceId) as unknown as EnvironmentRow[];

  const included = rootCollectionId
    ? collectDescendants(rootCollectionId, collections)
    : null;
  const filteredCollections = included
    ? collections.filter((c) => included.has(c.id))
    : collections;
  const filteredRequests = included
    ? requests.filter((r) => r.collectionId && included.has(r.collectionId))
    : requests;

  const rootCollection = rootCollectionId
    ? collections.find((c) => c.id === rootCollectionId)
    : null;
  const workspaceName = rootCollection?.name ?? 'Volt Export';
  const workspaceUid = `wrk_${rootCollectionId ?? workspaceId.replace(/-/g, '')}`;

  const resources: unknown[] = [
    {
      _id: workspaceUid,
      _type: 'workspace',
      parentId: null,
      name: workspaceName,
      description: rootCollection?.description ?? '',
      scope: 'collection',
    },
  ];

  // Request groups (folders). Insomnia uses dotted parent chain.
  function rgId(id: string) {
    return `fld_${id.replace(/-/g, '')}`;
  }
  function reqId(id: string) {
    return `req_${id.replace(/-/g, '')}`;
  }
  function envId(id: string) {
    return `env_${id.replace(/-/g, '')}`;
  }

  // Parent in Insomnia terms: collections that share the same Volt parent
  // become siblings under that parent's fld_; if a collection's parent is the
  // root export collection (or null), parent becomes the workspaceUid.
  function parentForCollection(c: CollectionRow): string {
    if (!c.parentId) return workspaceUid;
    if (rootCollection && c.parentId === rootCollection.id) return workspaceUid;
    return rgId(c.parentId);
  }
  function parentForRequest(r: RequestRow): string {
    if (!r.collectionId) return workspaceUid;
    if (rootCollection && r.collectionId === rootCollection.id) return workspaceUid;
    return rgId(r.collectionId);
  }

  // When exporting a specific root, that root collection itself is folded
  // into the workspace — its children become workspaceUid-parented.
  for (const c of filteredCollections) {
    if (rootCollection && c.id === rootCollection.id) continue;
    resources.push({
      _id: rgId(c.id),
      _type: 'request_group',
      parentId: parentForCollection(c),
      name: c.name,
      description: c.description ?? '',
      environment: {},
      environmentPropertyOrder: null,
    });
  }

  for (const r of filteredRequests) {
    resources.push({
      _id: reqId(r.id),
      _type: 'request',
      parentId: parentForRequest(r),
      name: r.name,
      description: r.description ?? '',
      method: r.method.toUpperCase(),
      // Insomnia appends `parameters[]` to `url` on send (like Volt does), and
      // that list is the only place a disabled param survives.
      url: tpl(r.url),
      parameters: (r.queryParams ?? [])
        .filter((q) => q.key)
        .map((q) => ({
          name: tpl(q.key),
          value: tpl(q.value),
          disabled: q.enabled === false ? true : undefined,
        })),
      headers: (r.headers ?? []).map((h) => ({
        name: tpl(h.key),
        value: tpl(h.value),
        disabled: h.enabled === false ? true : undefined,
      })),
      body: buildBody(r),
      authentication: buildAuth(r.auth),
      // Insomnia 9+ script hooks (`insomnia.*` mirrors `pm.*`, which Volt scripts can use directly).
      preRequestScript: exportScript(r.preRequestScript),
      afterResponseScript: exportScript(r.postResponseScript),
      metaSortKey: r.sortOrder ?? 0,
    });
  }

  for (const e of environments) {
    const data: Record<string, string> = {};
    for (const v of e.variables ?? []) data[v.key] = v.value;
    resources.push({
      _id: envId(e.id),
      _type: 'environment',
      parentId: workspaceUid,
      name: e.name,
      data,
      dataPropertyOrder: null,
      color: null,
      isPrivate: false,
    });
  }

  const out = {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: 'volt.app',
    resources,
  };

  const safeName = workspaceName.replace(/[^a-z0-9-_]+/gi, '_');
  return {
    content: JSON.stringify(out, null, 2),
    filename: `${safeName}.insomnia_export.json`,
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

/** Drop the `const insomnia = pm;` alias the importer adds so the script reads natively in Insomnia. */
function exportScript(s?: string): string {
  if (!s || !s.trim()) return '';
  return s.startsWith('const insomnia = pm;\n') ? s.slice('const insomnia = pm;\n'.length) : s;
}

/** Volt `{{name}}` → Insomnia template `{{ _.name }}` (the import does the reverse). */
function tpl(s: string): string {
  return (s ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, '{{ _.$1 }}');
}

function buildBody(r: RequestRow): unknown {
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
      return { mimeType: mime, text: tpl((b.content as string) ?? '') };
    }
    case 'urlencoded': {
      // Volt stores key/value rows; older rows may carry an encoded `content` string.
      const fields: Array<{ key: string; value: string; enabled?: boolean }> =
        (b.fields as Array<{ key: string; value: string; enabled?: boolean }> | undefined) ??
        parseQueryPairs((b.content as string | undefined) ?? '');
      return {
        mimeType: 'application/x-www-form-urlencoded',
        params: fields.map((f) => ({
          name: tpl(f.key),
          value: tpl(f.value),
          disabled: f.enabled === false ? true : undefined,
        })),
      };
    }
    case 'form': {
      const fields =
        (b.fields as Array<{ key: string; kind: 'text' | 'file'; value: string; enabled?: boolean }> | undefined) ??
        [];
      return {
        mimeType: 'multipart/form-data',
        params: fields.map((f) =>
          f.kind === 'file'
            ? { name: tpl(f.key), type: 'file' as const, fileName: f.value, disabled: f.enabled === false ? true : undefined }
            : { name: tpl(f.key), value: tpl(f.value), disabled: f.enabled === false ? true : undefined },
        ),
      };
    }
    case 'binary':
      return { mimeType: 'application/octet-stream', fileName: (b.filePath as string) ?? '' };
    case 'graphql': {
      // Insomnia stores GraphQL as a JSON envelope under its own mime type.
      let variables: unknown = {};
      try {
        variables = JSON.parse((b.variables as string | undefined) || '{}');
      } catch {
        variables = (b.variables as string | undefined) ?? '';
      }
      return {
        mimeType: 'application/graphql',
        text: JSON.stringify({ query: (b.query as string | undefined) ?? '', variables }),
      };
    }
    default:
      return {};
  }
}

function buildAuth(auth: Record<string, unknown> | undefined): unknown {
  if (!auth || !auth.type || auth.type === 'none') return {};
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', token: tpl((auth.token as string) ?? '') };
    case 'basic':
      return {
        type: 'basic',
        username: tpl((auth.username as string) ?? ''),
        password: tpl((auth.password as string) ?? ''),
      };
    case 'apiKey':
      return {
        type: 'apikey',
        key: tpl((auth.key as string) ?? ''),
        value: tpl((auth.value as string) ?? ''),
        addTo: (auth.placement as string) === 'query' ? 'queryParams' : 'header',
      };
    default:
      return {};
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
