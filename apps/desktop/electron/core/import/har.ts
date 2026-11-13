// HAR (HTTP Archive) import — spec: http://www.softwareishard.com/blog/har-12-spec/
//
// HAR is what browser DevTools' "Save all as HAR" produces. Format is a
// single JSON object with `log.entries[]`; each entry's `request` is the
// outgoing request we'll turn into a Volt request, grouped under one folder.
//
// We filter out static-asset entries (images, fonts, CSS, etc.) since those
// are almost never useful to keep as Volt requests. The filter is conservative
// — it only drops things we're confident are noise (matched by both
// Content-Type *and* the resource extension).
//
// We map response types coming from the entry's `response.content.mimeType`
// when present (more reliable than the response Content-Type header that may
// be missing).

import path from 'node:path';

import { createCollection, createRequest } from '../db/queries';
import type { ImportSummary } from './postman';

interface HarFile {
  log: {
    version?: string;
    entries: HarEntry[];
  };
}

interface HarEntry {
  startedDateTime?: string;
  time?: number;
  request: HarRequest;
  response?: { content?: { mimeType?: string } };
}

interface HarRequest {
  method: string;
  url: string;
  httpVersion?: string;
  headers?: Array<{ name: string; value: string }>;
  queryString?: Array<{ name: string; value: string }>;
  postData?: {
    mimeType?: string;
    text?: string;
    params?: Array<{ name: string; value?: string; fileName?: string; contentType?: string }>;
  };
}

const SKIPPED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif',
  'css', 'scss', 'less',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg',
  'pdf',
  'map',
]);

const SKIPPED_MIME_PREFIXES = ['image/', 'font/', 'video/', 'audio/'];
const SKIPPED_MIME = new Set([
  'text/css',
  'text/font',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-woff',
  'application/octet-stream-font',
]);

export function importHar(workspaceId: string, fileContent: string): {
  success: boolean;
  summary: ImportSummary;
  rootCollectionId?: string;
  error?: string;
} {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  let parsed: HarFile;
  try {
    parsed = JSON.parse(fileContent) as HarFile;
  } catch {
    return { success: false, summary, error: 'File is not valid JSON.' };
  }

  if (!parsed?.log?.entries || !Array.isArray(parsed.log.entries)) {
    return {
      success: false,
      summary,
      error: 'Not a valid HAR file — missing log.entries array.',
    };
  }

  const entries = parsed.log.entries;
  const total = entries.length;
  const kept = entries.filter((e) => !isStaticAsset(e));
  const filteredCount = total - kept.length;

  if (kept.length === 0) {
    summary.warnings.push(
      `Skipped ${filteredCount} static-asset entr${filteredCount === 1 ? 'y' : 'ies'}; nothing left to import.`,
    );
    return { success: true, summary };
  }

  // One root folder for the import — gives the user a clean undo target.
  const rootName = `HAR import ${new Date().toLocaleString()}`;
  const root = createCollection({
    workspaceId,
    parentId: null,
    name: rootName,
  });
  summary.collections++;

  for (const [i, entry] of kept.entries()) {
    const req = entry.request;
    const url = req.url;
    if (!url) continue;

    let pathname = '';
    try {
      pathname = new URL(url).pathname || '/';
    } catch {
      pathname = url.slice(0, 80);
    }
    const name = `${(req.method ?? 'GET').toUpperCase()} ${pathname}`;
    const { bodyType, body } = mapBody(req);
    const headers = (req.headers ?? [])
      // HAR includes pseudo-headers (`:method`, `:authority`, etc.) on HTTP/2
      // entries — those aren't sendable, skip them.
      .filter((h) => h && typeof h.name === 'string' && !h.name.startsWith(':'))
      .map((h, j) => ({ id: rowId('h', j), key: h.name, value: h.value ?? '', enabled: true }));

    // The URL in a HAR entry already carries the query string and
    // `queryString[]` repeats it. Volt appends queryParams on send, so keep
    // one copy: lift it into the Params table (editable) and strip the URL.
    const qIdx = url.indexOf('?');
    const hashIdx = url.indexOf('#');
    const baseUrl = qIdx >= 0 ? url.slice(0, qIdx) + (hashIdx > qIdx ? url.slice(hashIdx) : '') : url;
    const fromArray = (req.queryString ?? []).filter((q) => q && typeof q.name === 'string');
    const pairs =
      fromArray.length > 0
        ? fromArray.map((q) => ({ key: q.name, value: q.value ?? '' }))
        : qIdx >= 0
          ? parseQueryPairs(url.slice(qIdx + 1, hashIdx > qIdx ? hashIdx : undefined))
          : [];
    const queryParams = pairs.map((q, j) => ({
      id: rowId('q', j),
      key: q.key,
      value: q.value,
      enabled: true,
    }));

    // Bearer tokens are nicer to edit in the Auth tab than buried in headers.
    let auth: unknown = { type: 'none' };
    const authIdx = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
    if (authIdx >= 0 && /^bearer\s+/i.test(headers[authIdx]!.value)) {
      auth = { type: 'bearer', token: headers[authIdx]!.value.replace(/^bearer\s+/i, '') };
      headers.splice(authIdx, 1);
    }

    createRequest({
      workspaceId,
      collectionId: root!.id,
      name: name.length > 200 ? name.slice(0, 200) : name,
      method: normalizeMethod(req.method),
      url: baseUrl,
      headers,
      queryParams,
      bodyType,
      body,
      auth,
      sortOrder: i,
    });
    summary.requests++;
  }

  if (filteredCount > 0) {
    summary.warnings.push(
      `Filtered ${filteredCount} static-asset entr${filteredCount === 1 ? 'y' : 'ies'} (images, fonts, CSS, etc.).`,
    );
  }

  return { success: true, summary, rootCollectionId: root!.id };
}

function isStaticAsset(entry: HarEntry): boolean {
  const url = entry.request?.url ?? '';
  let ext = '';
  try {
    const p = new URL(url).pathname;
    ext = path.extname(p).slice(1).toLowerCase();
  } catch {
    /* malformed URL — fall through to mime check */
  }
  if (ext && SKIPPED_EXTENSIONS.has(ext)) return true;

  const mime = (
    (entry.response?.content?.mimeType ?? '').toLowerCase().split(';')[0] ?? ''
  ).trim();
  if (mime) {
    if (SKIPPED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
    if (SKIPPED_MIME.has(mime)) return true;
  }
  return false;
}

function normalizeMethod(m: string): string {
  const u = (m ?? 'GET').toUpperCase();
  const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  return allowed.includes(u) ? u : 'GET';
}

function mapBody(req: HarRequest): { bodyType: string; body: unknown } {
  const post = req.postData;
  if (!post) return { bodyType: 'none', body: { type: 'none' } };

  const mime = ((post.mimeType ?? '').toLowerCase().split(';')[0] ?? '').trim();

  // multipart/form-data — HAR exposes params + filename for file fields
  if (mime.startsWith('multipart/form-data') && post.params) {
    return {
      bodyType: 'form',
      body: {
        type: 'form',
        fields: post.params.map((p, i) => ({
          id: `f-${i}-${Math.random().toString(36).slice(2)}`,
          key: p.name,
          kind: p.fileName ? ('file' as const) : ('text' as const),
          value: p.fileName ?? p.value ?? '',
          enabled: true,
        })),
      },
    };
  }

  // x-www-form-urlencoded — either params[] or text. Volt stores decoded
  // key/value rows and re-encodes on send.
  if (mime === 'application/x-www-form-urlencoded') {
    const pairs = post.text
      ? parseQueryPairs(post.text)
      : (post.params ?? []).map((p) => ({ key: p.name, value: safeDecode(p.value ?? '') }));
    return {
      bodyType: 'urlencoded',
      body: {
        type: 'urlencoded',
        fields: pairs.map((p, i) => ({ id: rowId('u', i), key: p.key, value: p.value, enabled: true })),
      },
    };
  }

  // Anything else with text → raw
  if (post.text) {
    const language = guessRawLanguage(mime);
    return {
      bodyType: 'raw',
      body: { type: 'raw', language, content: post.text },
    };
  }

  return { bodyType: 'none', body: { type: 'none' } };
}

function rowId(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2)}`;
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, ' '));
  } catch {
    return v;
  }
}

function parseQueryPairs(s: string): Array<{ key: string; value: string }> {
  return s
    .split('&')
    .filter((kv) => kv.length > 0)
    .map((kv) => {
      const eq = kv.indexOf('=');
      return eq < 0
        ? { key: safeDecode(kv), value: '' }
        : { key: safeDecode(kv.slice(0, eq)), value: safeDecode(kv.slice(eq + 1)) };
    });
}

function guessRawLanguage(mime: string): string {
  if (/json/i.test(mime)) return 'json';
  if (/xml/i.test(mime)) return 'xml';
  if (/html/i.test(mime)) return 'html';
  if (/javascript|ecmascript/i.test(mime)) return 'javascript';
  return 'text';
}
