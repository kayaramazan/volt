// OpenAPI 3.0 import.
//
// Parses an OpenAPI spec (JSON or YAML) and creates a collection where:
//   - each path becomes a folder
//   - each operation becomes a request
//   - parameters → headers/query/path params
//   - request body schema → example body
//   - securitySchemes → auth config
//   - first server URL → {{baseUrl}} variable
//
// We do dependency-free dereferencing (basic $ref resolution) to keep the
// app bundle small. For complex circular schemas, we degrade to empty bodies
// rather than infinite-looping.

import YAML from 'yaml';
import {
  createCollection,
  createEnvironment,
  createRequest,
  updateEnvironment,
} from '../db/queries';
import type { ImportSummary } from './postman';

interface OpenAPIDoc {
  openapi?: string;
  info?: { title?: string };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, PathItem>;
  components?: { securitySchemes?: Record<string, SecurityScheme>; schemas?: Record<string, unknown> };
  security?: Array<Record<string, string[]>>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  head?: Operation;
  options?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBodySchema;
  security?: Array<Record<string, string[]>>;
}

interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema?: { type?: string; example?: unknown };
  example?: unknown;
}

interface RequestBodySchema {
  required?: boolean;
  content?: Record<string, { schema?: unknown; example?: unknown; examples?: Record<string, { value?: unknown }> }>;
}

interface SecurityScheme {
  type: string;        // 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  scheme?: string;     // for http: 'basic' | 'bearer'
  in?: string;         // for apiKey: 'header' | 'query'
  name?: string;       // for apiKey
}

const HTTP_VERBS: Array<keyof PathItem> = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export function importOpenAPI(
  workspaceId: string,
  fileContent: string,
  fileExt: 'json' | 'yaml',
): { success: boolean; summary: ImportSummary; rootCollectionId?: string; error?: string } {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  let doc: OpenAPIDoc;
  try {
    doc = fileExt === 'yaml' ? (YAML.parse(fileContent) as OpenAPIDoc) : JSON.parse(fileContent);
  } catch (e) {
    return {
      success: false,
      summary,
      error: `Failed to parse spec: ${(e as Error).message}`,
    };
  }

  if (!doc.openapi || !doc.openapi.startsWith('3.')) {
    return {
      success: false,
      summary,
      error: 'Only OpenAPI 3.x is supported. Swagger 2.0 not yet supported.',
    };
  }

  // Resolve $ref (single-pass; circular refs become empty objects)
  doc = derefSchema(doc, doc) as OpenAPIDoc;

  // Root collection
  const rootName = doc.info?.title?.trim() || 'OpenAPI Collection';
  const rootColl = createCollection({
    workspaceId,
    parentId: null,
    name: rootName,
  });
  summary.collections++;

  // baseUrl variable → into a new env
  if (doc.servers && doc.servers.length > 0 && doc.servers[0]?.url) {
    const env = createEnvironment({ workspaceId, name: rootName });
    updateEnvironment(env!.id, {
      variables: [{ key: 'baseUrl', value: doc.servers[0].url, secretRef: null }],
    });
    summary.environments++;
  }

  // Walk paths
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem) continue;

    // Folder per path
    const folder = createCollection({
      workspaceId,
      parentId: rootColl!.id,
      name: pathKey,
    });
    summary.collections++;

    for (const verb of HTTP_VERBS) {
      const op = pathItem[verb];
      if (!op) continue;
      importOperation(workspaceId, folder!.id, pathKey, verb, op, doc, summary);
    }
  }

  return { success: true, summary, rootCollectionId: rootColl!.id };
}

function importOperation(
  workspaceId: string,
  folderId: string,
  pathKey: string,
  verb: keyof PathItem,
  op: Operation,
  doc: OpenAPIDoc,
  summary: ImportSummary,
) {
  const name = op.summary?.trim() || op.operationId || `${verb.toUpperCase()} ${pathKey}`;
  const method = verb.toUpperCase();
  const url = `{{baseUrl}}${pathKey}`;

  // Parameters → headers / queryParams (path params we leave inline in URL)
  const headers: Array<{ id: string; key: string; value: string; enabled: boolean }> = [];
  const queryParams: Array<{ id: string; key: string; value: string; enabled: boolean }> = [];

  for (const p of op.parameters ?? []) {
    const example = (p.example ?? p.schema?.example ?? '') as string | number | boolean;
    const value = String(example);
    const row = {
      id: `p-${Math.random().toString(36).slice(2)}`,
      key: p.name,
      value,
      enabled: true,
    };
    if (p.in === 'header') headers.push(row);
    else if (p.in === 'query') queryParams.push(row);
    // path params: left in URL as {paramName}; caller fills in
  }

  // Body — pick first content type with a schema example
  let bodyType = 'none';
  let body: unknown = { type: 'none' };
  if (op.requestBody?.content) {
    const jsonContent =
      op.requestBody.content['application/json'] ??
      Object.values(op.requestBody.content)[0];
    if (jsonContent) {
      const example = jsonContent.example ?? extractExample(jsonContent.schema);
      bodyType = 'raw';
      body = {
        type: 'raw',
        language: 'json',
        content: typeof example === 'string' ? example : JSON.stringify(example, null, 2),
      };
      // Ensure Content-Type header is set
      if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
        headers.push({
          id: `h-ct-${Math.random().toString(36).slice(2)}`,
          key: 'Content-Type',
          value: 'application/json',
          enabled: true,
        });
      }
    }
  }

  // Auth from securitySchemes
  const auth = mapSecurity(op.security ?? doc.security ?? [], doc.components?.securitySchemes ?? {});

  createRequest({
    workspaceId,
    collectionId: folderId,
    name,
    method,
    url,
    headers,
    queryParams,
    bodyType,
    body,
    auth,
  });
  summary.requests++;
}

function mapSecurity(
  reqs: Array<Record<string, string[]>>,
  schemes: Record<string, SecurityScheme>,
): unknown {
  if (reqs.length === 0) return { type: 'none' };
  const first = reqs[0];
  if (!first) return { type: 'none' };
  const schemeName = Object.keys(first)[0];
  if (!schemeName) return { type: 'none' };
  const scheme = schemes[schemeName];
  if (!scheme) return { type: 'none' };

  if (scheme.type === 'http' && scheme.scheme === 'bearer') {
    return { type: 'bearer', token: '{{accessToken}}' };
  }
  if (scheme.type === 'http' && scheme.scheme === 'basic') {
    return { type: 'basic', username: '{{username}}', password: '{{password}}' };
  }
  if (scheme.type === 'apiKey' && scheme.name) {
    return {
      type: 'apiKey',
      key: scheme.name,
      value: '{{apiKey}}',
      placement: scheme.in === 'query' ? 'query' : 'header',
    };
  }
  return { type: 'none' };
}

/**
 * Walk a schema and pick example/default values, producing a small JSON object
 * that can serve as a starter request body.
 */
function extractExample(schema: unknown, depth = 0): unknown {
  if (depth > 5 || schema == null || typeof schema !== 'object') return null;
  const s = schema as {
    type?: string;
    example?: unknown;
    default?: unknown;
    properties?: Record<string, unknown>;
    items?: unknown;
    enum?: unknown[];
  };
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (s.enum && s.enum.length > 0) return s.enum[0];
  switch (s.type) {
    case 'string':
      return '';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [extractExample(s.items, depth + 1)].filter((v) => v !== null);
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const [k, propSchema] of Object.entries(s.properties ?? {})) {
        obj[k] = extractExample(propSchema, depth + 1);
      }
      return obj;
    }
    default:
      return null;
  }
}

/**
 * Single-pass $ref resolution. Replaces { $ref: "#/components/schemas/Foo" }
 * with the referenced schema. Circular references are detected and become {}.
 */
function derefSchema(node: unknown, root: OpenAPIDoc, seen: Set<string> = new Set()): unknown {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((n) => derefSchema(n, root, seen));

  const obj = node as Record<string, unknown>;
  if (typeof obj.$ref === 'string') {
    const refPath = obj.$ref;
    if (seen.has(refPath)) return {}; // circular
    const target = lookupRef(refPath, root);
    if (!target) return {};
    seen.add(refPath);
    const resolved = derefSchema(target, root, seen);
    seen.delete(refPath);
    return resolved;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = derefSchema(v, root, seen);
  }
  return result;
}

function lookupRef(ref: string, root: OpenAPIDoc): unknown {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
