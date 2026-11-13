// Insomnia v4 import.
//
// Insomnia exports a flat array of records with `_type` field identifying:
//   - workspace      → top-level workspace
//   - request_group  → folder
//   - request        → request
//   - environment    → environment
//
// Records are parented via `parentId`. We build a tree, then create
// collections/requests/environments in the target workspace.

import {
  createCollection,
  createEnvironment,
  createRequest,
  updateCollection,
  updateEnvironment,
} from '../db/queries';
import type { ImportSummary } from './postman';

interface InsomniaExport {
  _type: 'export';
  __export_format: number;
  resources: InsomniaResource[];
}

type InsomniaResource =
  | InsomniaWorkspace
  | InsomniaRequestGroup
  | InsomniaRequest
  | InsomniaEnvironment;

interface InsomniaWorkspace {
  _type: 'workspace';
  _id: string;
  name: string;
}

interface InsomniaRequestGroup {
  _type: 'request_group';
  _id: string;
  parentId: string;
  name: string;
  description?: string;
  metaSortKey?: number;
}

interface InsomniaRequest {
  _type: 'request';
  _id: string;
  parentId: string;
  name: string;
  description?: string;
  method?: string;
  url?: string;
  headers?: Array<{ name: string; value: string; disabled?: boolean }>;
  parameters?: Array<{ name: string; value: string; disabled?: boolean }>;
  body?: InsomniaBody;
  authentication?: InsomniaAuth;
  // Insomnia 9+ scripts — they use Insomnia's `insomnia.*` API, which mirrors Postman's `pm.*`.
  preRequestScript?: string;
  afterResponseScript?: string;
  metaSortKey?: number;
}

interface InsomniaBody {
  mimeType?: string;  // 'application/json', 'multipart/form-data', etc.
  text?: string;
  params?: Array<{ name: string; value: string; type?: string; fileName?: string; disabled?: boolean }>;
  fileName?: string;
}

interface InsomniaAuth {
  type?: string;  // 'bearer' | 'basic' | 'apikey' | 'none'
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  addTo?: string; // 'header' | 'query'
  disabled?: boolean;
}

interface InsomniaEnvironment {
  _type: 'environment';
  _id: string;
  parentId: string;
  name: string;
  data?: Record<string, unknown>;
}

export function importInsomnia(
  workspaceId: string,
  fileContent: string,
): { success: boolean; summary: ImportSummary; rootCollectionId?: string; error?: string } {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    return { success: false, summary, error: 'File is not valid JSON.' };
  }

  if (!isInsomniaExport(parsed)) {
    return { success: false, summary, error: 'Not a recognized Insomnia v4 export.' };
  }

  // Build maps from id → resource for traversal
  const byId = new Map<string, InsomniaResource>();
  for (const r of parsed.resources) byId.set(r._id, r);

  // Find workspaces and their children
  const insomniaWorkspaces = parsed.resources.filter(
    (r): r is InsomniaWorkspace => r._type === 'workspace',
  );

  let rootCollectionId: string | undefined;

  for (const wsRes of insomniaWorkspaces) {
    // Create a top-level collection per Insomnia workspace
    const rootColl = createCollection({
      workspaceId,
      parentId: null,
      name: wsRes.name || 'Imported',
      description: (wsRes as { description?: string }).description ?? '',
    });
    summary.collections++;
    rootCollectionId ??= rootColl!.id;

    // Find children by parentId === wsRes._id, recursively
    importChildren(parsed.resources, wsRes._id, workspaceId, rootColl!.id, summary);
  }

  // Environments are children of workspaces — but we already imported them
  // implicitly in importChildren? No: importChildren only handles request_group
  // and request types. Handle environments separately.
  const insomniaEnvs = parsed.resources.filter(
    (r): r is InsomniaEnvironment => r._type === 'environment',
  );
  // Insomnia has a "Base Environment" per workspace with sub-environments
  // parented to it that override its values. Volt environments are flat, so
  // each sub-environment is imported merged over its base.
  const envById = new Map(insomniaEnvs.map((e) => [e._id, e] as const));
  const isBase = (e: InsomniaEnvironment) => !envById.has(e.parentId);
  const subEnvs = insomniaEnvs.filter((e) => !isBase(e));
  for (const e of insomniaEnvs) {
    if (isBase(e) && subEnvs.some((s) => s.parentId === e._id)) continue; // folded into its children
    const merged: Record<string, unknown> = {};
    const chain: InsomniaEnvironment[] = [];
    for (let cur: InsomniaEnvironment | undefined = e; cur; cur = envById.get(cur.parentId)) chain.unshift(cur);
    for (const c of chain) Object.assign(merged, c.data ?? {});
    const created = createEnvironment({ workspaceId, name: e.name || 'Imported Environment' });
    updateEnvironment(created!.id, {
      variables: Object.entries(merged).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? convertTemplates(value) : JSON.stringify(value),
        secretRef: null,
      })),
    });
    summary.environments++;
  }

  return { success: true, summary, rootCollectionId };
}

/** Insomnia templates `{{ _.name }}` → Volt `{{name}}`. */
function convertTemplates(s: string): string {
  return s.replace(/\{\{\s*_\.([\w.-]+)\s*\}\}/g, '{{$1}}');
}

function rowId(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2)}`;
}

function importChildren(
  resources: InsomniaResource[],
  parentInsomniaId: string,
  workspaceId: string,
  parentCollectionId: string,
  summary: ImportSummary,
) {
  // Children are folders + requests with parentId === parentInsomniaId
  const children = resources
    .filter((r) => 'parentId' in r && r.parentId === parentInsomniaId)
    .sort((a, b) => {
      const sa = ('metaSortKey' in a ? a.metaSortKey : 0) ?? 0;
      const sb = ('metaSortKey' in b ? b.metaSortKey : 0) ?? 0;
      return sa - sb;
    });

  let folderIndex = 0;
  let requestIndex = 0;
  for (const child of children) {
    if (child._type === 'request_group') {
      const folder = createCollection({
        workspaceId,
        parentId: parentCollectionId,
        name: child.name || 'Untitled Folder',
        description: child.description ?? '',
      });
      updateCollection(folder!.id, { sortOrder: folderIndex++ });
      summary.collections++;
      importChildren(resources, child._id, workspaceId, folder!.id, summary);
    } else if (child._type === 'request') {
      importRequest(child, workspaceId, parentCollectionId, requestIndex++, summary);
    }
  }
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function importRequest(
  r: InsomniaRequest,
  workspaceId: string,
  parentCollectionId: string,
  sortOrder: number,
  summary: ImportSummary,
) {
  const headers = (r.headers ?? [])
    .filter((h) => h && typeof h.name === 'string')
    .map((h, i) => ({
      id: rowId('h', i),
      key: h.name,
      value: convertTemplates(h.value ?? ''),
      enabled: h.disabled !== true,
    }));

  // Insomnia keeps `?a=1` inside `url` and ALSO lists params in `parameters`.
  // Volt appends queryParams on send, so lift the inline query into the table.
  const rawUrl = convertTemplates(r.url ?? '');
  const qIdx = rawUrl.indexOf('?');
  const url = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
  const inline =
    qIdx >= 0
      ? rawUrl
          .slice(qIdx + 1)
          .split('&')
          .filter(Boolean)
          .map((kv) => {
            const eq = kv.indexOf('=');
            const dec = (v: string) => {
              try {
                return decodeURIComponent(v.replace(/\+/g, ' '));
              } catch {
                return v;
              }
            };
            return eq < 0 ? { name: dec(kv), value: '' } : { name: dec(kv.slice(0, eq)), value: dec(kv.slice(eq + 1)) };
          })
      : [];
  const queryParams = [...inline, ...(r.parameters ?? []).filter((p) => p && typeof p.name === 'string')].map(
    (p, i) => ({
      id: rowId('q', i),
      key: p.name,
      value: convertTemplates(p.value ?? ''),
      enabled: (p as { disabled?: boolean }).disabled !== true,
    }),
  );

  const { bodyType, body } = mapBody(r.body);
  const auth = mapAuth(r.authentication);

  let method = (r.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    summary.warnings.push(`"${r.name}": method ${method} is not supported — imported as GET.`);
    method = 'GET';
  }

  createRequest({
    workspaceId,
    collectionId: parentCollectionId,
    name: r.name || 'Untitled Request',
    method,
    url,
    headers,
    queryParams,
    bodyType,
    body,
    auth,
    // Insomnia's `insomnia.*` script object is API-compatible with `pm.*`; alias it so scripts run unchanged.
    preRequestScript: insomniaScript(r.preRequestScript),
    postResponseScript: insomniaScript(r.afterResponseScript),
    description: r.description ?? '',
    sortOrder,
  });
  summary.requests++;
}

function insomniaScript(s?: string): string {
  if (!s || !s.trim()) return '';
  return /\binsomnia\./.test(s) && !/\bconst insomnia\b/.test(s) ? `const insomnia = pm;\n${s}` : s;
}

function mapBody(b?: InsomniaBody): { bodyType: string; body: unknown } {
  const none = { bodyType: 'none', body: { type: 'none' } };
  if (!b || typeof b !== 'object') return none;
  const mime = (b.mimeType ?? '').toLowerCase().split(';')[0]!.trim();

  if (mime === 'application/graphql' || mime === 'application/graphql+json') {
    // Insomnia stores the GraphQL body as a JSON envelope: {"query": "...", "variables": {...}}
    let query = b.text ?? '';
    let variables = '';
    try {
      const env = JSON.parse(b.text ?? '') as { query?: string; variables?: unknown };
      if (typeof env.query === 'string') {
        query = env.query;
        variables =
          env.variables == null ? '' : typeof env.variables === 'string' ? env.variables : JSON.stringify(env.variables, null, 2);
      }
    } catch {
      /* raw query text */
    }
    return { bodyType: 'graphql', body: { type: 'graphql', query: convertTemplates(query), variables: convertTemplates(variables) } };
  }
  if (mime === 'application/x-www-form-urlencoded') {
    return {
      bodyType: 'urlencoded',
      body: {
        type: 'urlencoded',
        fields: (b.params ?? [])
          .filter((p) => p && typeof p.name === 'string')
          .map((p, i) => ({
            id: rowId('u', i),
            key: p.name,
            value: convertTemplates(p.value ?? ''),
            enabled: p.disabled !== true,
          })),
      },
    };
  }
  if (mime === 'multipart/form-data') {
    return {
      bodyType: 'form',
      body: {
        type: 'form',
        fields: (b.params ?? [])
          .filter((p) => p && typeof p.name === 'string')
          .map((p, i) => ({
            id: rowId('f', i),
            key: p.name,
            kind: p.type === 'file' ? ('file' as const) : ('text' as const),
            value: p.type === 'file' ? (p.fileName ?? '') : convertTemplates(p.value ?? ''),
            enabled: p.disabled !== true,
          })),
      },
    };
  }
  if (mime === 'application/octet-stream' || (b.fileName && b.text == null)) {
    return { bodyType: 'binary', body: { type: 'binary', filePath: b.fileName ?? '' } };
  }
  if (typeof b.text === 'string' && (mime || b.text.length > 0)) {
    const lang = /json/.test(mime)
      ? 'json'
      : /xml/.test(mime)
        ? 'xml'
        : /html/.test(mime)
          ? 'html'
          : /javascript|ecmascript/.test(mime)
            ? 'javascript'
            : 'text';
    return {
      bodyType: 'raw',
      body: { type: 'raw', language: lang, content: convertTemplates(b.text) },
    };
  }
  return none;
}

function mapAuth(a?: InsomniaAuth): unknown {
  if (!a || !a.type || a.type === 'none' || a.disabled) return { type: 'none' };
  switch (a.type) {
    case 'bearer':
      return { type: 'bearer', token: convertTemplates(a.token ?? '') };
    case 'basic':
      return {
        type: 'basic',
        username: convertTemplates(a.username ?? ''),
        password: convertTemplates(a.password ?? ''),
      };
    case 'apikey':
      return {
        type: 'apiKey',
        key: convertTemplates(a.key ?? ''),
        value: convertTemplates(a.value ?? ''),
        // Insomnia writes `queryParams`; older exports used `query`.
        placement: (a.addTo === 'queryParams' || a.addTo === 'query' ? 'query' : 'header') as 'header' | 'query',
      };
    default:
      return { type: 'none' };
  }
}

function isInsomniaExport(o: unknown): o is InsomniaExport {
  if (typeof o !== 'object' || o === null) return false;
  const obj = o as { _type?: unknown; resources?: unknown };
  return obj._type === 'export' && Array.isArray(obj.resources);
}
