// Postman v2.0 / v2.1 collection + environment import.
//
// Spec: https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json
// We aim for lossless on collections + folders + requests + environments:
// nested folders, collection/folder/request auth (parent auth is applied to
// requests that inherit), variables, descriptions, every body mode, disabled
// headers/params, saved examples (`response[]`) and item order.
//
// Scripts: Postman scripts use the `pm.*` API, which Volt doesn't provide, so
// they are imported commented-out (nothing silently breaks on send). Scripts
// Volt itself exported are restored verbatim.

import {
  createCollection,
  createEnvironment,
  createRequest,
  updateCollection,
  updateEnvironment,
} from '../db/queries';

type PostmanDescription = string | { content?: string; type?: string } | null;

interface PostmanCollection {
  info: { name?: string; schema?: string; description?: PostmanDescription };
  item?: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth | null;
  event?: PostmanEvent[];
}

interface PostmanItem {
  name?: string;
  description?: PostmanDescription;
  // Folder → has `item`; Request → has `request`
  item?: PostmanItem[];
  request?: PostmanRequest | string;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth | null;
}

interface PostmanRequest {
  method?: string;
  url?: string | PostmanUrl;
  header?: PostmanHeader[] | string;
  body?: PostmanBody | null;
  auth?: PostmanAuth | null;
  description?: PostmanDescription;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[] | string;
  port?: string;
  path?: Array<string | { value?: string }> | string;
  query?: Array<{ key?: string | null; value?: string | null; disabled?: boolean; description?: PostmanDescription }>;
  variable?: PostmanVariable[];
  hash?: string;
}

interface PostmanHeader {
  key: string;
  value?: string | null;
  disabled?: boolean;
  description?: PostmanDescription;
}

interface PostmanBody {
  mode?: string; // 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql'
  raw?: string;
  options?: { raw?: { language?: string } };
  formdata?: Array<{ key: string; value?: string; type?: string; src?: string | string[]; disabled?: boolean }>;
  urlencoded?: Array<{ key: string; value?: string; disabled?: boolean }>;
  file?: { src?: string };
  graphql?: { query?: string; variables?: string };
  disabled?: boolean;
}

type PostmanAuthParams = Array<{ key: string; value: unknown; type?: string }> | Record<string, unknown>;

interface PostmanAuth {
  type?: string; // 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'noauth' | 'inherit' | ...
  [k: string]: unknown;
}

interface PostmanVariable {
  key?: string;
  value?: unknown;
  type?: string;
  disabled?: boolean;
}

interface PostmanEvent {
  listen: string; // 'prerequest' | 'test'
  script?: { exec?: string[] | string };
}

interface PostmanResponse {
  name?: string;
  originalRequest?: PostmanRequest;
  status?: string;
  code?: number;
  header?: Array<{ key: string; value: string }> | string | null;
  body?: string | null;
  _postman_previewlanguage?: string;
}

interface PostmanEnvironmentExport {
  id?: string;
  name: string;
  values: Array<{ key: string; value: unknown; type?: string; enabled?: boolean }>;
}

export interface ImportSummary {
  collections: number;
  requests: number;
  environments: number;
  warnings: string[];
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const RAW_LANGUAGES = ['json', 'xml', 'html', 'text', 'javascript'];
const PRE_MARKER = '// Volt pre-request script (uses volt.* API, not pm.*):';
const POST_MARKER = '// Volt post-response script (uses volt.* API, not pm.*):';
const PM_MARKER = '// Imported from Postman. Scripts use the pm.* API, which Volt does not provide —';
const PM_MARKER_2 = '// port this to the volt.* API and remove the leading comment markers to enable it.';

interface ImportCtx {
  workspaceId: string;
  summary: ImportSummary;
  pmScripts: number;
  inheritedAuthApplied: number;
}

function rowId(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2)}`;
}

export function importPostman(workspaceId: string, fileContent: string): {
  success: boolean;
  summary: ImportSummary;
  rootCollectionId?: string;
  error?: string;
} {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    return { success: false, summary, error: 'File is not valid JSON.' };
  }

  // Detect environment export vs collection export
  if (isPostmanEnvironment(parsed)) {
    importEnvironment(workspaceId, parsed, summary);
    return { success: true, summary };
  }

  if (!isPostmanCollection(parsed)) {
    return {
      success: false,
      summary,
      error: 'Not a recognized Postman v2.x collection or environment file.',
    };
  }

  // Create root collection from the import name
  const rootName = parsed.info.name?.trim() || 'Imported Collection';
  const rootCollection = createCollection({
    workspaceId,
    parentId: null,
    name: rootName,
    description: descriptionText(parsed.info.description),
  });
  summary.collections++;

  const rootVars = mapVariables(parsed.variable);
  if (rootVars.length > 0) updateCollection(rootCollection!.id, { variables: rootVars });

  const ctx: ImportCtx = { workspaceId, summary, pmScripts: 0, inheritedAuthApplied: 0 };

  if (hasScript(parsed.event)) {
    summary.warnings.push('Collection-level scripts are not supported and were skipped.');
  }

  // Walk items. Requests without their own `auth` inherit the nearest ancestor's.
  const rootAuth = parsed.auth ? mapAuth(parsed.auth, summary) : null;
  importItems(parsed.item ?? [], rootCollection!.id, rootAuth, ctx);

  if (ctx.pmScripts > 0) {
    summary.warnings.push(
      `${ctx.pmScripts} Postman script${ctx.pmScripts === 1 ? '' : 's'} imported and active (pm.* API supported).`,
    );
  }
  if (ctx.inheritedAuthApplied > 0) {
    summary.warnings.push(
      `Collection/folder auth was applied directly to ${ctx.inheritedAuthApplied} request${ctx.inheritedAuthApplied === 1 ? '' : 's'} (Volt has no inherited auth).`,
    );
  }

  return { success: true, summary, rootCollectionId: rootCollection!.id };
}

function importItems(
  items: PostmanItem[],
  parentCollectionId: string,
  inheritedAuth: unknown | null,
  ctx: ImportCtx,
) {
  let reqIndex = 0;
  let folderIndex = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (Array.isArray(item.item)) {
      // Folder
      const folder = createCollection({
        workspaceId: ctx.workspaceId,
        parentId: parentCollectionId,
        name: item.name?.trim() || 'Untitled Folder',
        description: descriptionText(item.description),
      });
      ctx.summary.collections++;
      const vars = mapVariables(item.variable);
      updateCollection(folder!.id, { sortOrder: folderIndex++, ...(vars.length ? { variables: vars } : {}) });
      if (hasScript(item.event)) {
        ctx.summary.warnings.push(`Folder "${item.name}" has scripts — folder-level scripts are not supported.`);
      }
      const folderAuth = item.auth ? mapAuth(item.auth, ctx.summary) : null;
      importItems(item.item, folder!.id, folderAuth ?? inheritedAuth, ctx);
    } else if (item.request !== undefined) {
      importRequest(item, parentCollectionId, inheritedAuth, reqIndex++, ctx);
    }
  }
}

function importRequest(
  item: PostmanItem,
  parentCollectionId: string,
  inheritedAuth: unknown | null,
  sortOrder: number,
  ctx: ImportCtx,
) {
  // v2.0 allows the whole request to be a URL string.
  const r: PostmanRequest = typeof item.request === 'string' ? { url: item.request } : (item.request ?? {});

  // Scripts
  let preRequestScript = '';
  let postResponseScript = '';
  for (const ev of item.event ?? []) {
    const text = execText(ev?.script?.exec);
    if (!text.trim()) continue;
    const converted = convertScript(text, ev.listen === 'test' ? POST_MARKER : PRE_MARKER, ctx);
    if (ev.listen === 'prerequest') preRequestScript = converted;
    else if (ev.listen === 'test') postResponseScript = converted;
  }

  // Headers (v2.0 allows a raw "Key: value\n…" string)
  const headers = parseHeaders(r.header).map((h, i) => ({
    id: rowId('h', i),
    key: h.key ?? '',
    value: h.value ?? '',
    enabled: h.disabled !== true,
    ...(descriptionText(h.description) ? { description: descriptionText(h.description) } : {}),
  }));

  // URL + query params. The query string is lifted into the Params table so
  // it doesn't get sent twice (Volt appends queryParams to the URL on send).
  const { url, params, pathVars } = mapUrl(r.url);
  const queryParams = params.map((q, i) => ({
    id: rowId('q', i),
    key: q.key,
    value: q.value,
    enabled: q.enabled,
    ...(q.description ? { description: q.description } : {}),
  }));
  const pathVariables = pathVars.map((p, i) => ({
    id: rowId('pv', i),
    key: p.key,
    value: p.value,
    enabled: p.enabled,
    ...(p.description ? { description: p.description } : {}),
  }));

  // Body
  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value;
  const { bodyType, body } = mapBody(r.body, contentType);

  // Auth: own auth wins; `inherit`/absent → nearest ancestor's auth.
  let auth: unknown;
  if (r.auth && r.auth.type && r.auth.type !== 'inherit') {
    auth = mapAuth(r.auth, ctx.summary);
  } else if (inheritedAuth) {
    auth = inheritedAuth;
    ctx.inheritedAuthApplied++;
  } else {
    auth = { type: 'none' };
  }

  let method = (r.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    ctx.summary.warnings.push(`"${item.name}": method ${method} is not supported — imported as GET.`);
    method = 'GET';
  }

  createRequest({
    workspaceId: ctx.workspaceId,
    collectionId: parentCollectionId,
    name: item.name?.trim() || 'Untitled Request',
    method,
    url,
    headers,
    queryParams,
    // `pathVariables` is part of the shared ApiRequest schema; the DB layer
    // persists it once it has the column (cast keeps this compiling until then).
    pathVariables,
    bodyType,
    body,
    auth,
    preRequestScript,
    postResponseScript,
    description: descriptionText(r.description) || descriptionText(item.description),
    examples: mapExamples(item.response, method, url),
    sortOrder,
  } as Parameters<typeof createRequest>[0]);
  ctx.summary.requests++;
}

// ─────────────────────────────────────────────────────────
// Field mappers
// ─────────────────────────────────────────────────────────

function descriptionText(d: PostmanDescription | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return typeof d.content === 'string' ? d.content : '';
}

function hasScript(events?: PostmanEvent[]): boolean {
  return (events ?? []).some((e) => execText(e?.script?.exec).trim().length > 0);
}

function execText(exec?: string[] | string): string {
  if (!exec) return '';
  return Array.isArray(exec) ? exec.join('\n') : String(exec);
}

/**
 * Postman scripts run as-is: the sandbox provides a Postman-compatible `pm`
 * API. Two legacy shapes are unwrapped so older exports still round-trip:
 * scripts an older Volt build exported commented-out behind a marker, and
 * scripts an older Volt build imported commented-out.
 */
function convertScript(text: string, voltMarker: string, ctx: ImportCtx): string {
  const lines = text.split('\n');
  const uncomment = (ls: string[]) => ls.map((l) => (l.startsWith('// ') ? l.slice(3) : l === '//' ? '' : l)).join('\n');
  if (lines[0] === voltMarker) return uncomment(lines.slice(1));
  if (lines[0] === PM_MARKER) return uncomment(lines.slice(lines[1] === PM_MARKER_2 ? 2 : 1));
  ctx.pmScripts++;
  return text;
}

function parseHeaders(h?: PostmanHeader[] | string): PostmanHeader[] {
  if (!h) return [];
  if (Array.isArray(h)) return h.filter((x) => x && typeof x === 'object');
  return h
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const idx = line.indexOf(':');
      return idx > 0
        ? { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
        : { key: line.trim(), value: '' };
    });
}

function mapVariables(vars?: PostmanVariable[]): Array<{ key: string; value: string; secretRef: null }> {
  return (vars ?? [])
    .filter((v) => v && typeof v.key === 'string' && v.key.length > 0 && v.disabled !== true)
    .map((v) => ({ key: v.key as string, value: stringValue(v.value), secretRef: null }));
}

function stringValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

interface MappedParam {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

function mapUrl(u?: string | PostmanUrl): { url: string; params: MappedParam[]; pathVars: MappedParam[] } {
  if (!u) return { url: '', params: [], pathVars: [] };
  if (typeof u === 'string') return { ...splitUrlQuery(u), pathVars: pathVarsFromUrl(u, []) };
  const pathVars = pathVarsFromUrl(
    u.raw ?? (Array.isArray(u.path) ? '/' + u.path.map((p) => (typeof p === 'string' ? p : (p?.value ?? ''))).join('/') : ''),
    u.variable ?? [],
  );

  let raw = u.raw;
  if (!raw) {
    const protocol = u.protocol ? `${u.protocol}://` : '';
    const host = Array.isArray(u.host) ? u.host.join('.') : (u.host ?? '');
    const port = u.port ? `:${u.port}` : '';
    const segs = Array.isArray(u.path)
      ? u.path.map((p) => (typeof p === 'string' ? p : (p?.value ?? '')))
      : u.path
        ? [String(u.path).replace(/^\//, '')]
        : [];
    raw = `${protocol}${host}${port}${segs.length ? '/' + segs.join('/') : ''}`;
    if (u.hash) raw += `#${u.hash}`;
  }

  const split = splitUrlQuery(raw);
  if (Array.isArray(u.query)) {
    // The structured list is authoritative: it carries disabled rows that `raw` omits.
    const params = u.query
      .filter((q) => q && typeof q === 'object')
      .map((q) => ({
        key: q.key ?? '',
        value: q.value ?? '',
        enabled: q.disabled !== true,
        ...(descriptionText(q.description) ? { description: descriptionText(q.description) } : {}),
      }))
      .filter((q) => q.key || q.value);
    return { url: split.url, params, pathVars };
  }
  return { ...split, pathVars };
}

/**
 * Path variables: every `:name` segment in the URL, with values from Postman's
 * `url.variable[]` when present (Postman keeps the two in sync; we do the same).
 */
function pathVarsFromUrl(url: string, declared: PostmanVariable[]): MappedParam[] {
  const base = url.split(/[?#]/)[0] ?? '';
  const names = [...base.matchAll(/(?:^|\/):([A-Za-z_][\w-]*)/g)].map((m) => m[1]!);
  const byKey = new Map<string, PostmanVariable>();
  for (const v of declared) if (v && typeof v.key === 'string') byKey.set(v.key, v);
  const out: MappedParam[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const v = byKey.get(name);
    out.push({
      key: name,
      value: stringValue(v?.value),
      enabled: v?.disabled !== true,
      ...(v && descriptionText((v as { description?: PostmanDescription }).description)
        ? { description: descriptionText((v as { description?: PostmanDescription }).description) }
        : {}),
    });
  }
  // Declared variables that aren't in the URL (rare) — keep them so nothing is lost.
  for (const v of declared) {
    if (v && typeof v.key === 'string' && v.key && !seen.has(v.key)) {
      out.push({ key: v.key, value: stringValue(v.value), enabled: v.disabled !== true });
    }
  }
  return out;
}

/** Pull `?a=1&b=2` off a URL into param rows. Values are decoded; Volt re-encodes on send. */
function splitUrlQuery(url: string): { url: string; params: MappedParam[] } {
  const q = url.indexOf('?');
  if (q < 0) return { url, params: [] };
  const hash = url.indexOf('#', q);
  const query = hash >= 0 ? url.slice(q + 1, hash) : url.slice(q + 1);
  const base = url.slice(0, q) + (hash >= 0 ? url.slice(hash) : '');
  const dec = (v: string) => {
    try {
      return decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      return v;
    }
  };
  const params = query
    .split('&')
    .filter((kv) => kv.length > 0)
    .map((kv) => {
      const eq = kv.indexOf('=');
      return eq < 0
        ? { key: dec(kv), value: '', enabled: true }
        : { key: dec(kv.slice(0, eq)), value: dec(kv.slice(eq + 1)), enabled: true };
    });
  return { url: base, params };
}

function rawLanguage(lang: string | undefined, contentType: string | undefined): string {
  const l = (lang ?? '').toLowerCase();
  if (RAW_LANGUAGES.includes(l)) return l;
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('javascript')) return 'javascript';
  return 'text';
}

function mapBody(b: PostmanBody | null | undefined, contentType?: string): { bodyType: string; body: unknown } {
  const none = { bodyType: 'none', body: { type: 'none' } };
  if (!b || !b.mode || b.disabled) return none;
  switch (b.mode) {
    case 'raw':
      return {
        bodyType: 'raw',
        body: { type: 'raw', language: rawLanguage(b.options?.raw?.language, contentType), content: b.raw ?? '' },
      };
    case 'formdata':
      return {
        bodyType: 'form',
        body: {
          type: 'form',
          fields: (b.formdata ?? [])
            .filter((f) => f && typeof f === 'object')
            .map((f, i) => {
              const isFile = f.type === 'file';
              const src = Array.isArray(f.src) ? (f.src[0] ?? '') : (f.src ?? '');
              return {
                id: rowId('f', i),
                key: f.key ?? '',
                kind: isFile ? ('file' as const) : ('text' as const),
                value: isFile ? src : stringValue(f.value),
                enabled: f.disabled !== true,
              };
            }),
        },
      };
    case 'urlencoded':
      return {
        bodyType: 'urlencoded',
        body: {
          type: 'urlencoded',
          fields: (b.urlencoded ?? [])
            .filter((f) => f && typeof f === 'object')
            .map((f, i) => ({
              id: rowId('u', i),
              key: f.key ?? '',
              value: stringValue(f.value),
              enabled: f.disabled !== true,
            })),
        },
      };
    case 'file':
      return {
        bodyType: 'binary',
        body: { type: 'binary', filePath: b.file?.src ?? '' },
      };
    case 'graphql':
      return {
        bodyType: 'graphql',
        body: {
          type: 'graphql',
          query: b.graphql?.query ?? '',
          variables: stringValue(b.graphql?.variables),
        },
      };
    default:
      return none;
  }
}

/** Postman auth params are `[{key,value}]` in v2.1 and `{key: value}` in v2.0. */
function authParams(a: PostmanAuth, type: string): Record<string, string> {
  const raw = a[type] as PostmanAuthParams | undefined;
  const map: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) if (item && typeof item.key === 'string') map[item.key] = stringValue(item.value);
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) map[k] = stringValue(v);
  }
  return map;
}

function mapAuth(a: PostmanAuth | null | undefined, summary: ImportSummary): unknown {
  if (!a || !a.type || a.type === 'noauth' || a.type === 'inherit') return { type: 'none' };
  switch (a.type) {
    case 'bearer': {
      const m = authParams(a, 'bearer');
      return { type: 'bearer', token: m.token ?? '' };
    }
    case 'basic': {
      const m = authParams(a, 'basic');
      return { type: 'basic', username: m.username ?? '', password: m.password ?? '' };
    }
    case 'apikey': {
      const m = authParams(a, 'apikey');
      return {
        type: 'apiKey',
        key: m.key ?? '',
        value: m.value ?? '',
        placement: (m.in === 'query' ? 'query' : 'header') as 'header' | 'query',
      };
    }
    case 'oauth2': {
      const m = authParams(a, 'oauth2');
      const grantType = (m.grant_type ?? 'authorization_code').toLowerCase();
      const grant =
        grantType === 'client_credentials'
          ? 'client_credentials'
          : grantType === 'password_credentials' || grantType === 'password'
            ? 'password'
            : 'authorization_code';
      if (grantType === 'implicit') {
        summary.warnings.push('OAuth 2.0 implicit grant is not supported — imported as authorization code.');
      }
      return {
        type: 'oauth2',
        grant,
        tokenUrl: m.accessTokenUrl ?? '',
        ...(m.authUrl ? { authUrl: m.authUrl } : {}),
        ...(m.redirect_uri ? { redirectUri: m.redirect_uri } : {}),
        clientId: m.clientId ?? '',
        clientSecret: m.clientSecret ?? '',
        ...(m.scope ? { scope: m.scope } : {}),
        ...(m.username ? { username: m.username } : {}),
        ...(m.password ? { password: m.password } : {}),
        headerPrefix: m.headerPrefix || 'Bearer',
        tokenCacheKey: `oauth_${Math.random().toString(36).slice(2, 10)}`,
      };
    }
    default:
      summary.warnings.push(`Auth type "${a.type}" is not supported — set to none.`);
      return { type: 'none' };
  }
}

function mapExamples(responses: PostmanResponse[] | undefined, method: string, url: string): unknown[] {
  if (!Array.isArray(responses)) return [];
  const out: unknown[] = [];
  for (const [i, ex] of responses.entries()) {
    if (!ex || typeof ex !== 'object') continue;
    const orig = ex.originalRequest;
    const origUrl = orig ? mapUrl(orig.url) : null;
    const origBody = orig ? mapBody(orig.body) : null;
    const headers = parseHeaders(typeof ex.header === 'string' || Array.isArray(ex.header) ? ex.header : undefined);
    const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? null;
    const bodyText = typeof ex.body === 'string' ? ex.body : null;
    const code = typeof ex.code === 'number' ? ex.code : Number(ex.code) || 0;
    out.push({
      id: rowId('ex', i),
      name: (ex.name ?? '').trim() || `Example ${i + 1}`,
      createdAt: Date.now(),
      request: {
        method: (orig?.method ?? method).toUpperCase(),
        url: origUrl ? origUrl.url : url,
        headers: parseHeaders(orig?.header).map((h) => ({ key: h.key, value: h.value ?? '', enabled: h.disabled !== true })),
        queryParams: origUrl ? origUrl.params.map((q) => ({ key: q.key, value: q.value, enabled: q.enabled })) : [],
        bodyType: origBody?.bodyType ?? 'none',
        body: origBody?.body ?? { type: 'none' },
        auth: { type: 'none' },
      },
      response: {
        ok: true,
        statusCode: code,
        statusText: ex.status ?? '',
        headers: headers.map((h) => [h.key, h.value ?? '']),
        contentType,
        bodyText,
        bodySizeBytes: bodyText ? Buffer.byteLength(bodyText, 'utf-8') : 0,
        durationMs: 0,
        previewLanguage: ex._postman_previewlanguage,
      },
    });
  }
  return out;
}

function importEnvironment(
  workspaceId: string,
  env: PostmanEnvironmentExport,
  summary: ImportSummary,
) {
  const created = createEnvironment({
    workspaceId,
    name: env.name?.trim() || 'Imported Environment',
  });
  const values = Array.isArray(env.values) ? env.values.filter((v) => v && typeof v.key === 'string' && v.key) : [];
  const enabled = values.filter((v) => v.enabled !== false);
  updateEnvironment(created!.id, {
    variables: enabled.map((v) => ({ key: v.key, value: stringValue(v.value), secretRef: null })),
  });
  summary.environments++;
  const skipped = values.length - enabled.length;
  if (skipped > 0) {
    summary.warnings.push(`${skipped} disabled variable${skipped === 1 ? '' : 's'} in "${env.name}" skipped.`);
  }
}

function isPostmanCollection(o: unknown): o is PostmanCollection {
  if (typeof o !== 'object' || o === null) return false;
  const obj = o as { info?: { schema?: string; name?: string }; item?: unknown };
  if (!obj.info || typeof obj.info !== 'object') return false;
  return (
    (typeof obj.info.schema === 'string' && /collection/i.test(obj.info.schema)) ||
    (typeof obj.info.name === 'string' && Array.isArray(obj.item))
  );
}

function isPostmanEnvironment(o: unknown): o is PostmanEnvironmentExport {
  if (typeof o !== 'object' || o === null) return false;
  const obj = o as { name?: unknown; values?: unknown; info?: unknown };
  return typeof obj.name === 'string' && Array.isArray(obj.values) && !obj.info;
}
