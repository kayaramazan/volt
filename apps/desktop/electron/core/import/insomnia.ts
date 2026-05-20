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

import { createCollection, createEnvironment, createRequest } from '../db/queries';
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
  metaSortKey?: number;
}

interface InsomniaRequest {
  _type: 'request';
  _id: string;
  parentId: string;
  name: string;
  method?: string;
  url?: string;
  headers?: Array<{ name: string; value: string; disabled?: boolean }>;
  parameters?: Array<{ name: string; value: string; disabled?: boolean }>;
  body?: InsomniaBody;
  authentication?: InsomniaAuth;
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
  data?: Record<string, string>;
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
  for (const e of insomniaEnvs) {
    createEnvironment({ workspaceId, name: e.name || 'Imported Environment' });
    summary.environments++;
    if (e.data && Object.keys(e.data).length > 0) {
      summary.warnings.push(
        `Environment "${e.name}" has ${Object.keys(e.data).length} variables — re-enter sensitive values.`,
      );
    }
  }

  return { success: true, summary, rootCollectionId };
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

  for (const child of children) {
    if (child._type === 'request_group') {
      const folder = createCollection({
        workspaceId,
        parentId: parentCollectionId,
        name: child.name || 'Untitled Folder',
      });
      summary.collections++;
      importChildren(resources, child._id, workspaceId, folder!.id, summary);
    } else if (child._type === 'request') {
      importRequest(child, workspaceId, parentCollectionId, summary);
    }
  }
}

function importRequest(
  r: InsomniaRequest,
  workspaceId: string,
  parentCollectionId: string,
  summary: ImportSummary,
) {
  const headers = (r.headers ?? []).map((h, i) => ({
    id: `h-${i}-${Math.random().toString(36).slice(2)}`,
    key: h.name,
    value: h.value,
    enabled: h.disabled !== true,
  }));

  const queryParams = (r.parameters ?? []).map((p, i) => ({
    id: `q-${i}-${Math.random().toString(36).slice(2)}`,
    key: p.name,
    value: p.value,
    enabled: p.disabled !== true,
  }));

  const { bodyType, body } = mapBody(r.body);
  const auth = mapAuth(r.authentication);

  createRequest({
    workspaceId,
    collectionId: parentCollectionId,
    name: r.name || 'Untitled Request',
    method: (r.method ?? 'GET').toUpperCase(),
    url: r.url ?? '',
    headers,
    queryParams,
    bodyType,
    body,
    auth,
  });
  summary.requests++;
}

function mapBody(b?: InsomniaBody): { bodyType: string; body: unknown } {
  if (!b || !b.mimeType) return { bodyType: 'none', body: { type: 'none' } };

  if (b.mimeType.includes('json') || b.mimeType === 'text/plain' || b.mimeType === 'text/xml') {
    const lang = b.mimeType.includes('json')
      ? 'json'
      : b.mimeType.includes('xml')
        ? 'xml'
        : 'text';
    return {
      bodyType: 'raw',
      body: { type: 'raw', language: lang, content: b.text ?? '' },
    };
  }
  if (b.mimeType === 'application/x-www-form-urlencoded') {
    return {
      bodyType: 'urlencoded',
      body: {
        type: 'urlencoded',
        fields: (b.params ?? []).map((p, i) => ({
          id: `u-${i}-${Math.random().toString(36).slice(2)}`,
          key: p.name,
          value: p.value,
          enabled: p.disabled !== true,
        })),
      },
    };
  }
  if (b.mimeType === 'multipart/form-data') {
    return {
      bodyType: 'form',
      body: {
        type: 'form',
        fields: (b.params ?? []).map((p, i) => ({
          id: `f-${i}-${Math.random().toString(36).slice(2)}`,
          key: p.name,
          kind: p.type === 'file' ? ('file' as const) : ('text' as const),
          value: p.type === 'file' ? p.fileName ?? '' : p.value,
          enabled: p.disabled !== true,
        })),
      },
    };
  }
  if (b.fileName) {
    return { bodyType: 'binary', body: { type: 'binary', filePath: b.fileName } };
  }
  return { bodyType: 'none', body: { type: 'none' } };
}

function mapAuth(a?: InsomniaAuth): unknown {
  if (!a || !a.type || a.type === 'none' || a.disabled) return { type: 'none' };
  switch (a.type) {
    case 'bearer':
      return { type: 'bearer', token: a.token ?? '' };
    case 'basic':
      return { type: 'basic', username: a.username ?? '', password: a.password ?? '' };
    case 'apikey':
      return {
        type: 'apiKey',
        key: a.key ?? '',
        value: a.value ?? '',
        placement: (a.addTo === 'query' ? 'query' : 'header') as 'header' | 'query',
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
