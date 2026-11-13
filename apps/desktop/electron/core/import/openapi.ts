// OpenAPI 3.x / Swagger 2.0 import.
//
// Parses a spec (JSON or YAML — sniffed from the content, not the extension)
// and creates a collection where:
//   - operations are grouped into folders by their first tag (Postman does the
//     same); untagged operations go into a folder per path
//   - each operation becomes a request
//   - parameters → headers / query params; path params become `:name` segments
//   - request body schema → example body (raw JSON/XML, form-data, urlencoded, binary)
//   - securitySchemes → auth config (bearer / basic / apiKey / oauth2)
//   - first server URL → `baseUrl` collection variable
//
// Swagger 2.0 documents are converted to the OpenAPI 3 shape up front so the
// rest of the importer only has to understand one format.
//
// We do dependency-free dereferencing (basic $ref resolution) to keep the
// app bundle small. For complex circular schemas, we degrade to empty bodies
// rather than infinite-looping.

import YAML from 'yaml';
import { createCollection, createRequest, updateCollection } from '../db/queries';
import type { ImportSummary } from './postman';

interface OpenAPIDoc {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; description?: string };
  servers?: Array<{ url?: string; variables?: Record<string, { default?: string; enum?: string[] }> }>;
  paths?: Record<string, PathItem>;
  components?: { securitySchemes?: Record<string, SecurityScheme>; schemas?: Record<string, unknown> };
  security?: Array<Record<string, string[]>>;
  // Swagger 2 only
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  securityDefinitions?: Record<string, SwaggerSecurityDefinition>;
  definitions?: Record<string, unknown>;
}

interface PathItem {
  parameters?: Parameter[];
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
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBodySchema;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
  // Swagger 2 only
  consumes?: string[];
}

interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData';
  required?: boolean;
  description?: string;
  schema?: SchemaLike;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
  // Swagger 2 only (schema-ish fields live on the parameter itself)
  type?: string;
  format?: string;
  default?: unknown;
  enum?: unknown[];
  'x-example'?: unknown;
}

interface MediaType {
  schema?: SchemaLike;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
}

interface RequestBodySchema {
  required?: boolean;
  description?: string;
  content?: Record<string, MediaType>;
}

interface SchemaLike {
  type?: string;
  format?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, SchemaLike>;
  required?: string[];
  items?: SchemaLike;
  allOf?: SchemaLike[];
  oneOf?: SchemaLike[];
  anyOf?: SchemaLike[];
  additionalProperties?: unknown;
  nullable?: boolean;
}

interface SecurityScheme {
  type: string; // 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  scheme?: string; // for http: 'basic' | 'bearer'
  in?: string; // for apiKey: 'header' | 'query' | 'cookie'
  name?: string; // for apiKey
  flows?: Record<string, { authorizationUrl?: string; tokenUrl?: string; scopes?: Record<string, string> }>;
}

interface SwaggerSecurityDefinition {
  type: string; // 'basic' | 'apiKey' | 'oauth2'
  in?: string;
  name?: string;
  flow?: string; // 'implicit' | 'password' | 'application' | 'accessCode'
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: Record<string, string>;
}

const HTTP_VERBS: Array<keyof Omit<PathItem, 'parameters'>> = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function rowId(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2)}`;
}

export function importOpenAPI(
  workspaceId: string,
  fileContent: string,
  fileExt: 'json' | 'yaml',
): { success: boolean; summary: ImportSummary; rootCollectionId?: string; error?: string } {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  // YAML is a superset of JSON, but JSON.parse is stricter and faster — try
  // it first regardless of the extension hint (pasted specs have none).
  let doc: OpenAPIDoc;
  try {
    doc = JSON.parse(fileContent) as OpenAPIDoc;
  } catch {
    try {
      doc = YAML.parse(fileContent) as OpenAPIDoc;
    } catch (e) {
      return {
        success: false,
        summary,
        error: `Failed to parse spec as ${fileExt === 'yaml' ? 'YAML' : 'JSON or YAML'}: ${(e as Error).message}`,
      };
    }
  }
  if (!doc || typeof doc !== 'object') {
    return { success: false, summary, error: 'Spec is empty or not an object.' };
  }

  if (typeof doc.swagger === 'string' && doc.swagger.startsWith('2')) {
    doc = convertSwagger2(doc);
  } else if (typeof doc.openapi !== 'string' || !/^3\./.test(doc.openapi)) {
    return {
      success: false,
      summary,
      error: 'Not an OpenAPI 3.x or Swagger 2.0 document (missing `openapi: 3.x` / `swagger: "2.0"`).',
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
    description: doc.info?.description ?? '',
  });
  summary.collections++;

  // baseUrl → collection variable (what Postman does), so {{baseUrl}} resolves
  // without the user having to pick an environment first.
  const baseUrl = serverUrl(doc.servers?.[0]);
  if (baseUrl) {
    updateCollection(rootColl!.id, { variables: [{ key: 'baseUrl', value: baseUrl, secretRef: null }] });
  } else {
    summary.warnings.push('Spec has no `servers` entry — set the {{baseUrl}} collection variable manually.');
  }

  // Folders: one per tag when the spec uses tags, otherwise one per path.
  const folders = new Map<string, string>();
  let folderIndex = 0;
  const folderFor = (name: string): string => {
    let id = folders.get(name);
    if (!id) {
      const f = createCollection({ workspaceId, parentId: rootColl!.id, name });
      updateCollection(f!.id, { sortOrder: folderIndex++ });
      summary.collections++;
      id = f!.id;
      folders.set(name, id);
    }
    return id;
  };
  const usesTags = Object.values(doc.paths ?? {}).some(
    (pi) => pi && HTTP_VERBS.some((v) => Array.isArray(pi[v]?.tags) && pi[v]!.tags!.length > 0),
  );

  const requestIndex = new Map<string, number>();
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const verb of HTTP_VERBS) {
      const op = pathItem[verb];
      if (!op || typeof op !== 'object') continue;
      const folderName = usesTags ? (op.tags?.[0]?.trim() || 'Untagged') : pathKey;
      const folderId = folderFor(folderName);
      const idx = requestIndex.get(folderId) ?? 0;
      requestIndex.set(folderId, idx + 1);
      importOperation(workspaceId, folderId, pathKey, verb, op, pathItem.parameters ?? [], doc, idx, summary);
    }
  }

  return { success: true, summary, rootCollectionId: rootColl!.id };
}

function serverUrl(server?: { url?: string; variables?: Record<string, { default?: string; enum?: string[] }> }): string {
  if (!server?.url) return '';
  let url = server.url;
  for (const [name, v] of Object.entries(server.variables ?? {})) {
    const val = v?.default ?? v?.enum?.[0];
    if (val !== undefined) url = url.split(`{${name}}`).join(String(val));
  }
  return url.replace(/\/$/, '');
}

function importOperation(
  workspaceId: string,
  folderId: string,
  pathKey: string,
  verb: keyof Omit<PathItem, 'parameters'>,
  op: Operation,
  pathParams: Parameter[],
  doc: OpenAPIDoc,
  sortOrder: number,
  summary: ImportSummary,
) {
  const name = (op.summary?.trim() || op.operationId || `${verb.toUpperCase()} ${pathKey}`).slice(0, 200);
  const method = verb.toUpperCase();
  // `{petId}` → `:petId` (Postman-style path variable)
  const url = `{{baseUrl}}${pathKey.replace(/\{([^/{}]+)\}/g, ':$1')}`;

  // Path-level parameters apply to every operation; operation-level ones override by name+in.
  const merged = new Map<string, Parameter>();
  for (const p of [...pathParams, ...(op.parameters ?? [])]) {
    if (p && typeof p === 'object' && typeof p.name === 'string') merged.set(`${p.in}:${p.name}`, p);
  }

  type Row = { id: string; key: string; value: string; enabled: boolean; description?: string };
  const headers: Row[] = [];
  const queryParams: Row[] = [];
  const pathVariables: Row[] = [];
  for (const p of merged.values()) {
    const value = paramExample(p);
    const row = {
      id: rowId('p', headers.length + queryParams.length + pathVariables.length),
      key: p.name,
      value,
      // Optional params with no example would send `?limit=` noise — leave them off by default.
      enabled: p.in === 'path' || p.required === true || value !== '',
      ...(p.description ? { description: p.description } : {}),
    };
    if (p.in === 'header') headers.push(row);
    else if (p.in === 'query') queryParams.push(row);
    else if (p.in === 'path') pathVariables.push(row);
    // cookie params are not supported.
  }
  // `:name` segments in the path without a declared parameter still get a row.
  for (const m of url.matchAll(/\/:([A-Za-z_][\w-]*)/g)) {
    if (!pathVariables.some((v) => v.key === m[1])) {
      pathVariables.push({ id: rowId('p', pathVariables.length), key: m[1]!, value: '', enabled: true });
    }
  }

  // Body — prefer JSON, then whatever the spec lists first.
  let bodyType = 'none';
  let body: unknown = { type: 'none' };
  const content = op.requestBody?.content;
  if (content && typeof content === 'object') {
    const mimes = Object.keys(content);
    const mime = mimes.find((m) => /json/i.test(m)) ?? mimes[0];
    const media = mime ? content[mime] : undefined;
    if (mime && media) {
      const base = mime.toLowerCase().split(';')[0]!.trim();
      const props = schemaProperties(media.schema);
      if (base === 'multipart/form-data') {
        bodyType = 'form';
        body = {
          type: 'form',
          fields: Object.entries(props).map(([key, s], i) => ({
            id: rowId('f', i),
            key,
            kind: s?.format === 'binary' || s?.type === 'file' ? ('file' as const) : ('text' as const),
            value: s?.format === 'binary' || s?.type === 'file' ? '' : stringify(extractExample(s)),
            enabled: true,
          })),
        };
      } else if (base === 'application/x-www-form-urlencoded') {
        bodyType = 'urlencoded';
        body = {
          type: 'urlencoded',
          fields: Object.entries(props).map(([key, s], i) => ({
            id: rowId('u', i),
            key,
            value: stringify(extractExample(s)),
            enabled: true,
          })),
        };
      } else if (base === 'application/octet-stream' || media.schema?.format === 'binary') {
        bodyType = 'binary';
        body = { type: 'binary', filePath: '' };
      } else {
        const example = media.example ?? firstExample(media.examples) ?? extractExample(media.schema);
        const language = /json/i.test(base)
          ? 'json'
          : /xml/i.test(base)
            ? 'xml'
            : /html/i.test(base)
              ? 'html'
              : 'text';
        bodyType = 'raw';
        body = {
          type: 'raw',
          language,
          content:
            typeof example === 'string'
              ? example
              : language === 'json'
                ? JSON.stringify(example ?? {}, null, 2)
                : language === 'xml'
                  ? toXml(example, rootXmlName(media.schema))
                  : stringify(example),
        };
      }
      // Ensure Content-Type header is set for raw bodies (form/urlencoded set their own on send)
      if (bodyType === 'raw' && !headers.some((h) => h.key.toLowerCase() === 'content-type')) {
        headers.push({ id: rowId('h-ct', 0), key: 'Content-Type', value: mime, enabled: true });
      }
    }
  }

  // Auth from securitySchemes (operation-level overrides document-level; `[]` means none)
  const auth = mapSecurity(op.security ?? doc.security ?? [], doc.components?.securitySchemes ?? {}, summary);

  const descriptionParts = [op.description?.trim() ?? ''];
  if (op.deprecated) descriptionParts.unshift('**Deprecated**');
  if (op.requestBody?.description) descriptionParts.push(`Request body: ${op.requestBody.description}`);

  createRequest({
    workspaceId,
    collectionId: folderId,
    name,
    method,
    url,
    headers,
    queryParams,
    // Part of the shared ApiRequest schema; persisted once the DB layer has the column.
    pathVariables,
    bodyType,
    body,
    auth,
    description: descriptionParts.filter(Boolean).join('\n\n'),
    sortOrder,
  } as Parameters<typeof createRequest>[0]);
  summary.requests++;
}

function paramExample(p: Parameter): string {
  const v =
    p.example ??
    p['x-example'] ??
    firstExample(p.examples) ??
    p.schema?.example ??
    p.schema?.default ??
    p.default ??
    p.schema?.enum?.[0] ??
    p.enum?.[0];
  return v === undefined || v === null ? '' : stringify(v);
}

function firstExample(examples?: Record<string, { value?: unknown }>): unknown {
  if (!examples || typeof examples !== 'object') return undefined;
  const first = Object.values(examples)[0];
  return first && typeof first === 'object' ? first.value : undefined;
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function schemaProperties(schema?: SchemaLike): Record<string, SchemaLike> {
  if (!schema || typeof schema !== 'object') return {};
  const out: Record<string, SchemaLike> = {};
  for (const sub of schema.allOf ?? []) Object.assign(out, schemaProperties(sub));
  Object.assign(out, schema.properties ?? {});
  return out;
}

function rootXmlName(schema?: SchemaLike): string {
  const x = (schema as { xml?: { name?: string } } | undefined)?.xml?.name;
  return x || 'root';
}

function toXml(value: unknown, tag: string, depth = 0): string {
  const pad = '  '.repeat(depth);
  if (value === null || value === undefined) return `${pad}<${tag}/>`;
  if (Array.isArray(value)) return value.map((v) => toXml(v, tag, depth)).join('\n');
  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => toXml(v, k, depth + 1))
      .join('\n');
    return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
  }
  const text = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `${pad}<${tag}>${text}</${tag}>`;
}

/** Pick a security scheme → Volt auth. `requirements` is an OR list; we use the first entry. */
function mapSecurity(
  reqs: Array<Record<string, string[]>>,
  schemes: Record<string, SecurityScheme>,
  summary: ImportSummary,
): unknown {
  if (!Array.isArray(reqs) || reqs.length === 0) return { type: 'none' };
  const first = reqs.find((r) => r && typeof r === 'object' && Object.keys(r).length > 0);
  if (!first) return { type: 'none' };
  const schemeName = Object.keys(first)[0]!;
  const scheme = schemes[schemeName];
  if (!scheme) {
    summary.warnings.push(`Security scheme "${schemeName}" is referenced but not defined — auth set to none.`);
    return { type: 'none' };
  }

  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
    return { type: 'bearer', token: '{{accessToken}}' };
  }
  if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
    return { type: 'basic', username: '{{username}}', password: '{{password}}' };
  }
  if (scheme.type === 'apiKey' && scheme.name) {
    if (scheme.in === 'cookie') {
      return { type: 'apiKey', key: 'Cookie', value: `${scheme.name}={{apiKey}}`, placement: 'header' };
    }
    return {
      type: 'apiKey',
      key: scheme.name,
      value: '{{apiKey}}',
      placement: scheme.in === 'query' ? 'query' : 'header',
    };
  }
  if (scheme.type === 'oauth2' && scheme.flows) {
    const flows = scheme.flows;
    const scopes = first[schemeName] ?? [];
    const pick = (flow: { authorizationUrl?: string; tokenUrl?: string }, grant: string) => ({
      type: 'oauth2',
      grant,
      tokenUrl: flow.tokenUrl ?? '',
      ...(flow.authorizationUrl ? { authUrl: flow.authorizationUrl } : {}),
      clientId: '{{clientId}}',
      clientSecret: '{{clientSecret}}',
      ...(scopes.length ? { scope: scopes.join(' ') } : {}),
      headerPrefix: 'Bearer',
      tokenCacheKey: `oauth_${Math.random().toString(36).slice(2, 10)}`,
    });
    if (flows.clientCredentials) return pick(flows.clientCredentials, 'client_credentials');
    if (flows.authorizationCode) return pick(flows.authorizationCode, 'authorization_code');
    if (flows.password) return { ...pick(flows.password, 'password'), username: '{{username}}', password: '{{password}}' };
    if (flows.implicit) {
      summary.warnings.push(`OAuth 2.0 implicit flow (${schemeName}) is not supported — imported as bearer token.`);
      return { type: 'bearer', token: '{{accessToken}}' };
    }
  }
  if (scheme.type === 'openIdConnect') {
    return { type: 'bearer', token: '{{accessToken}}' };
  }
  summary.warnings.push(`Security scheme "${schemeName}" (${scheme.type}) is not supported — auth set to none.`);
  return { type: 'none' };
}

/**
 * Walk a schema and pick example/default values, producing a small JSON object
 * that can serve as a starter request body.
 */
function extractExample(schema: unknown, depth = 0): unknown {
  if (depth > 6 || schema == null || typeof schema !== 'object') return null;
  const s = schema as SchemaLike;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (s.enum && s.enum.length > 0) return s.enum[0];
  if (s.allOf && s.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const sub of s.allOf) {
      const v = extractExample(sub, depth + 1);
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(merged, v);
    }
    return merged;
  }
  if (s.oneOf?.length) return extractExample(s.oneOf[0], depth + 1);
  if (s.anyOf?.length) return extractExample(s.anyOf[0], depth + 1);

  const type = s.type ?? (s.properties ? 'object' : s.items ? 'array' : undefined);
  switch (type) {
    case 'string':
      switch (s.format) {
        case 'date':
          return '2024-01-01';
        case 'date-time':
          return '2024-01-01T00:00:00Z';
        case 'email':
          return 'user@example.com';
        case 'uuid':
          return '00000000-0000-0000-0000-000000000000';
        case 'uri':
        case 'url':
          return 'https://example.com';
        default:
          return '';
      }
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array': {
      const item = extractExample(s.items, depth + 1);
      return item === null ? [] : [item];
    }
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
  const parts = ref
    .slice(2)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ─────────────────────────────────────────────────────────
// Swagger 2.0 → OpenAPI 3 shape
// ─────────────────────────────────────────────────────────

function convertSwagger2(src: OpenAPIDoc): OpenAPIDoc {
  // Re-point `#/definitions/X` refs at `#/components/schemas/X` in one sweep.
  const doc = JSON.parse(
    JSON.stringify(src).replace(/"#\/definitions\//g, '"#/components/schemas/'),
  ) as OpenAPIDoc;

  const out: OpenAPIDoc = {
    openapi: '3.0.0',
    info: doc.info,
    paths: {},
    components: { schemas: doc.definitions ?? {}, securitySchemes: {} },
    security: doc.security,
  };

  if (doc.host) {
    const scheme = doc.schemes?.[0] ?? 'https';
    out.servers = [{ url: `${scheme}://${doc.host}${doc.basePath ?? ''}` }];
  } else if (doc.basePath) {
    out.servers = [{ url: doc.basePath }];
  }

  for (const [name, def] of Object.entries(doc.securityDefinitions ?? {})) {
    if (!def || typeof def !== 'object') continue;
    let scheme: SecurityScheme | null = null;
    if (def.type === 'basic') scheme = { type: 'http', scheme: 'basic' };
    else if (def.type === 'apiKey') scheme = { type: 'apiKey', in: def.in, name: def.name };
    else if (def.type === 'oauth2') {
      const flowKey =
        def.flow === 'application'
          ? 'clientCredentials'
          : def.flow === 'accessCode'
            ? 'authorizationCode'
            : def.flow === 'password'
              ? 'password'
              : 'implicit';
      scheme = {
        type: 'oauth2',
        flows: {
          [flowKey]: { authorizationUrl: def.authorizationUrl, tokenUrl: def.tokenUrl, scopes: def.scopes ?? {} },
        },
      };
    }
    if (scheme) out.components!.securitySchemes![name] = scheme;
  }

  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const converted: PathItem = {};
    if (Array.isArray(pathItem.parameters)) {
      converted.parameters = pathItem.parameters.filter((p) => p.in !== 'body' && p.in !== 'formData').map(convertParam);
    }
    for (const verb of HTTP_VERBS) {
      const op = pathItem[verb];
      if (!op || typeof op !== 'object') continue;
      const params = (op.parameters ?? []).filter((p) => p && typeof p === 'object');
      const bodyParam = params.find((p) => p.in === 'body');
      const formParams = params.filter((p) => p.in === 'formData');
      const consumes = op.consumes ?? doc.consumes ?? [];
      const newOp: Operation = {
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        security: op.security,
        deprecated: op.deprecated,
        parameters: params.filter((p) => p.in !== 'body' && p.in !== 'formData').map(convertParam),
      };
      if (bodyParam) {
        const mime = consumes[0] ?? 'application/json';
        newOp.requestBody = {
          required: bodyParam.required,
          description: bodyParam.description,
          content: { [mime]: { schema: bodyParam.schema } },
        };
      } else if (formParams.length > 0) {
        const mime = consumes.find((c) => /urlencoded/i.test(c)) ?? 'multipart/form-data';
        const properties: Record<string, SchemaLike> = {};
        for (const p of formParams) {
          properties[p.name] = {
            type: p.type === 'file' ? 'string' : p.type,
            ...(p.type === 'file' ? { format: 'binary' } : {}),
            example: p['x-example'] ?? p.default,
            enum: p.enum,
          };
        }
        newOp.requestBody = { content: { [mime]: { schema: { type: 'object', properties } } } };
      }
      converted[verb] = newOp;
    }
    out.paths![pathKey] = converted;
  }
  return out;
}

function convertParam(p: Parameter): Parameter {
  if (p.schema) return p;
  return {
    name: p.name,
    in: p.in,
    required: p.required,
    description: p.description,
    example: p['x-example'],
    schema: { type: p.type, format: p.format, default: p.default, enum: p.enum },
  };
}
