// HTTP execution engine.
//
// Built on undici (Node.js's modern fetch implementation). Captures detailed
// timing breakdown per phase (DNS / TCP / TLS / TTFB / download), supports
// streaming, and honors AbortController for cancellation.
//
// Variable substitution happens BEFORE this layer (in send-request.ts).
// This module just takes a ResolvedRequest and produces a SendRequestOutput.

import { Agent, request as undiciRequest } from 'undici';
import { RESPONSE_BODY_MAX_BYTES, type ResolvedRequest, type SendRequestOutput } from '@volt/shared';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { STATUS_CODES } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

import { getAutoHeaders } from '../db/queries';

// In-flight requests, keyed by inFlightId. Cancellable via AbortController.
const inFlight = new Map<string, AbortController>();

// Shared agent — connection pooling improves perf for repeat requests to same host.
let _agent: Agent | null = null;
let _insecureAgent: Agent | null = null;
function getAgent(ignoreTlsErrors: boolean): Agent {
  if (ignoreTlsErrors) {
    // Separate pool for TLS-error-tolerant mode. Cached (not per-request) so
    // we don't leak an Agent + its sockets on every "ignore TLS" send.
    if (!_insecureAgent) {
      _insecureAgent = new Agent({
        keepAliveTimeout: 30_000,
        keepAliveMaxTimeout: 60_000,
        connect: { timeout: 30_000, rejectUnauthorized: false },
      });
    }
    return _insecureAgent;
  }
  if (!_agent) {
    _agent = new Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      connect: { timeout: 30_000 },
    });
  }
  return _agent;
}

export async function executeRequest(
  inFlightId: string,
  req: ResolvedRequest,
): Promise<SendRequestOutput> {
  const controller = new AbortController();
  inFlight.set(inFlightId, controller);

  const t0 = performance.now();
  const timing = {
    dnsMs: null as number | null,
    tcpMs: null as number | null,
    tlsMs: null as number | null,
    ttfbMs: null as number | null,
    downloadMs: null as number | null,
    totalMs: 0,
  };

  // Timeout handling — wraps abort signal. 0 = no timeout (Postman semantics).
  const timeoutId =
    req.timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(new DOMException('Request timeout', 'TimeoutError'));
        }, req.timeoutMs)
      : null;

  try {
    const url = normalizeUrl(req.url);
    // Build body based on type
    const { body, contentType } = serializeBody(req);

    // Merge content-type into headers if applicable and not already set
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      // undici throws on hop-by-hop / framing headers (and on a Content-Length
      // that doesn't match the body it computes). Postman manages these
      // itself too, so drop them instead of failing the whole request.
      if (FORBIDDEN_REQUEST_HEADERS.has(k.trim().toLowerCase())) continue;
      if (k.trim().toLowerCase() === 'connection' && !/^(close|keep-alive)$/i.test(v.trim())) continue;
      headers[k.trim()] = v;
    }
    if (contentType && !headerHas(headers, 'content-type')) {
      headers['Content-Type'] = contentType;
    }
    // Merge enabled auto-headers — user-defined entries (already in `headers`)
    // win on case-insensitive name match.
    for (const h of getAutoHeaders()) {
      if (!h.enabled || !h.key) continue;
      if (headerHas(headers, h.key)) continue;
      const value = resolveAutoValue(h.key, h.value, url);
      if (value !== null) headers[h.key] = value;
    }

    // Mark TTFB time after we get the first byte of the response.
    let ttfbMark: number | null = null;

    const response = await undiciRequest(url, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      maxRedirections: req.followRedirects ? 10 : 0,
      dispatcher: getAgent(req.ignoreTlsErrors),
      throwOnError: false,
    });

    ttfbMark = performance.now();
    timing.ttfbMs = Math.round(ttfbMark - t0);

    // Collect headers
    const responseHeaders: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(response.headers)) {
      if (Array.isArray(v)) {
        v.forEach((vv) => responseHeaders.push([k, vv]));
      } else if (typeof v === 'string') {
        responseHeaders.push([k, v]);
      }
    }

    const contentTypeHeader = pickHeader(responseHeaders, 'content-type') ?? null;

    // Stream body, with size cap. If it exceeds RESPONSE_BODY_MAX_BYTES,
    // write the rest to a tempfile and return the path.
    const raw = await consumeBody(response.body as unknown as Readable);
    // Transparently decompress gzip / deflate / br bodies. undici's low-level
    // `request()` does NOT do this for us (unlike fetch), so without this step
    // any server honoring our `Accept-Encoding` auto-header would hand the UI
    // a blob of compressed bytes that renders as mojibake.
    const contentEncoding = pickHeader(responseHeaders, 'content-encoding') ?? null;
    const { bodyBuffer, bodyTempFile, bodySize } = await decodeBody(raw, contentEncoding);
    const downloadEnd = performance.now();
    timing.downloadMs = Math.round(downloadEnd - ttfbMark);
    timing.totalMs = Math.round(downloadEnd - t0);

    return {
      ok: true,
      statusCode: response.statusCode,
      // undici doesn't expose the wire reason phrase; use the standard one.
      statusText: STATUS_CODES[response.statusCode] ?? '',
      headers: responseHeaders,
      bodyBase64: bodyBuffer ? bodyBuffer.toString('base64') : null,
      bodyTempFile,
      bodyContentType: contentTypeHeader,
      bodySizeBytes: bodySize,
      timing,
    };
  } catch (err) {
    timing.totalMs = Math.round(performance.now() - t0);
    const { code, message } = classifyError(err);
    return {
      ok: false,
      errorCode: code,
      errorMessage: message,
      timing,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    inFlight.delete(inFlightId);
  }
}

export function cancelRequest(inFlightId: string): boolean {
  const controller = inFlight.get(inFlightId);
  if (!controller) return false;
  controller.abort();
  inFlight.delete(inFlightId);
  return true;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function serializeBody(req: ResolvedRequest): {
  body: string | Buffer | Readable | null;
  contentType: string | null;
} {
  const body = req.body;
  switch (body.type) {
    case 'none':
      return { body: null, contentType: null };
    case 'raw':
      return { body: body.content, contentType: null };  // user controls Content-Type via headers
    case 'form': {
      // multipart/form-data — undici handles via FormData
      // But for simplicity (and to support file paths), we build manually with a boundary.
      const boundary = `----VoltFormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const parts: Buffer[] = [];
      for (const field of body.fields) {
        const name = escapeFormDataName(field.key);
        if (field.kind === 'text') {
          parts.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${field.value}\r\n`,
            ),
          );
        } else {
          // file
          if (!field.value) {
            throw new Error(`No file selected for form field "${field.key}".`);
          }
          if (!fs.existsSync(field.value)) {
            throw new Error(`File not found: ${field.value}`);
          }
          const fileBuf = fs.readFileSync(field.value);
          const filename = escapeFormDataName(path.basename(field.value));
          parts.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mimeTypeForPath(field.value)}\r\n\r\n`,
            ),
          );
          parts.push(fileBuf);
          parts.push(Buffer.from('\r\n'));
        }
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      return {
        body: Buffer.concat(parts),
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    }
    case 'urlencoded':
      return {
        body: body.content,
        contentType: 'application/x-www-form-urlencoded',
      };
    case 'binary': {
      if (!body.filePath) {
        throw new Error('No file selected for the binary body.');
      }
      if (!fs.existsSync(body.filePath)) {
        throw new Error(`File not found: ${body.filePath}`);
      }
      // Read into memory rather than streaming: a stream body can't be
      // replayed, so undici would silently stop following redirects, and a
      // Buffer lets it send a proper Content-Length.
      return {
        body: fs.readFileSync(body.filePath),
        contentType: mimeTypeForPath(body.filePath),
      };
    }
    case 'graphql': {
      // GraphQL is just HTTP under the hood — POST a JSON envelope with
      // `query`, optional `variables`, optional `operationName`.
      let vars: unknown = undefined;
      const raw = (body as { variables?: string }).variables ?? '';
      if (raw.trim()) {
        try {
          vars = JSON.parse(raw);
        } catch {
          throw new Error('GraphQL variables must be valid JSON.');
        }
      }
      const payload: Record<string, unknown> = {
        query: (body as { query?: string }).query ?? '',
      };
      if (vars !== undefined) payload.variables = vars;
      if ((body as { operationName?: string }).operationName) {
        payload.operationName = (body as { operationName?: string }).operationName;
      }
      return { body: JSON.stringify(payload), contentType: 'application/json' };
    }
  }
}

async function consumeBody(stream: Readable): Promise<{
  bodyBuffer: Buffer | null;
  bodyTempFile: string | null;
  bodySize: number;
}> {
  const chunks: Buffer[] = [];
  let total = 0;
  let exceededLimit = false;
  let tempFileStream: fs.WriteStream | null = null;
  let tempFilePath: string | null = null;

  for await (const raw of stream) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string);
    total += chunk.length;

    if (!exceededLimit && total > RESPONSE_BODY_MAX_BYTES) {
      // Switch to tempfile mode: flush what we have plus this chunk to disk.
      exceededLimit = true;
      tempFilePath = newTempResponsePath();
      tempFileStream = fs.createWriteStream(tempFilePath);
      for (const c of chunks) tempFileStream.write(c);
      chunks.length = 0;
      tempFileStream.write(chunk);
    } else if (exceededLimit) {
      tempFileStream!.write(chunk);
    } else {
      chunks.push(chunk);
    }
  }

  if (tempFileStream) {
    await new Promise<void>((resolve, reject) => {
      tempFileStream!.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
    return { bodyBuffer: null, bodyTempFile: tempFilePath, bodySize: total };
  }
  return { bodyBuffer: Buffer.concat(chunks), bodyTempFile: null, bodySize: total };
}

type CapturedBody = {
  bodyBuffer: Buffer | null;
  bodyTempFile: string | null;
  bodySize: number;
};

/**
 * Parse a Content-Encoding header into the list of codings that must be
 * undone, in the order they must be applied (reverse of header order —
 * `Content-Encoding: gzip, br` means br was applied last, so decode br first).
 * Unknown / identity codings are dropped; if any unsupported coding is present
 * we return null so the caller leaves the body untouched.
 */
function parseContentEncoding(header: string | null): string[] | null {
  if (!header) return [];
  const codings = header
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c && c !== 'identity');
  for (const c of codings) {
    if (c !== 'gzip' && c !== 'x-gzip' && c !== 'deflate' && c !== 'br') return null;
  }
  return codings.reverse();
}

// Tolerate truncated streams (server closed early / cut-off download) the
// way browsers do: flush what decoded instead of throwing on a missing
// trailer, so the user still sees the readable prefix.
const ZLIB_OPTS: zlib.ZlibOptions = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
const BROTLI_OPTS: zlib.BrotliOptions = { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH };

function makeDecoder(
  coding: string,
  rawDeflate = false,
): zlib.Gunzip | zlib.Inflate | zlib.InflateRaw | zlib.BrotliDecompress {
  switch (coding) {
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip(ZLIB_OPTS);
    case 'deflate':
      return rawDeflate ? zlib.createInflateRaw(ZLIB_OPTS) : zlib.createInflate(ZLIB_OPTS);
    case 'br':
      return zlib.createBrotliDecompress(BROTLI_OPTS);
    default:
      throw new Error(`Unsupported content-encoding: ${coding}`);
  }
}

function decodeBufferSync(buf: Buffer, coding: string): Buffer {
  switch (coding) {
    case 'gzip':
    case 'x-gzip':
      return zlib.gunzipSync(buf, ZLIB_OPTS);
    case 'deflate':
      // Some servers send raw DEFLATE without the zlib wrapper; try both.
      try {
        return zlib.inflateSync(buf, ZLIB_OPTS);
      } catch {
        return zlib.inflateRawSync(buf, ZLIB_OPTS);
      }
    case 'br':
      return zlib.brotliDecompressSync(buf, BROTLI_OPTS);
    default:
      throw new Error(`Unsupported content-encoding: ${coding}`);
  }
}

/** Stream-decode a spilled body file through the coding chain into a new temp file. */
async function decodeFile(inPath: string, codings: string[], rawDeflate: boolean): Promise<string> {
  const outPath = newTempResponsePath();
  try {
    const transforms = codings.map((c) => makeDecoder(c, rawDeflate));
    await pipeline([fs.createReadStream(inPath), ...transforms, fs.createWriteStream(outPath)]);
    return outPath;
  } catch (err) {
    try {
      fs.unlinkSync(outPath);
    } catch {
      /* best effort */
    }
    throw err;
  }
}

/**
 * Undo Content-Encoding on a captured body. On any failure (truncated
 * stream, server lying about the encoding, …) the original bytes are
 * returned so the user still sees *something* rather than an error.
 */
async function decodeBody(raw: CapturedBody, contentEncoding: string | null): Promise<CapturedBody> {
  const codings = parseContentEncoding(contentEncoding);
  if (!codings || codings.length === 0) return raw;

  // Empty bodies (204, HEAD, …) carry nothing to decode.
  if (raw.bodySize === 0) return raw;

  try {
    if (raw.bodyBuffer) {
      let out = raw.bodyBuffer;
      for (const c of codings) out = decodeBufferSync(out, c);
      // Decompressed payload may exceed the in-memory cap; spill to disk so
      // the renderer isn't asked to hold a huge base64 string.
      if (out.length > RESPONSE_BODY_MAX_BYTES) {
        const tempFilePath = newTempResponsePath();
        fs.writeFileSync(tempFilePath, out);
        return { bodyBuffer: null, bodyTempFile: tempFilePath, bodySize: out.length };
      }
      return { bodyBuffer: out, bodyTempFile: null, bodySize: out.length };
    }

    if (raw.bodyTempFile) {
      let outPath: string;
      try {
        outPath = await decodeFile(raw.bodyTempFile, codings, false);
      } catch (err) {
        // Same raw-DEFLATE fallback as the in-memory path.
        if (!codings.includes('deflate')) throw err;
        outPath = await decodeFile(raw.bodyTempFile, codings, true);
      }
      const size = fs.statSync(outPath).size;
      try {
        fs.unlinkSync(raw.bodyTempFile);
      } catch {
        /* best effort */
      }
      return { bodyBuffer: null, bodyTempFile: outPath, bodySize: size };
    }
  } catch (err) {
    console.warn(`[http] failed to decode content-encoding "${contentEncoding}", returning raw bytes:`, err);
  }
  return raw;
}

function newTempResponsePath(): string {
  const tempDir = path.join(app.getPath('userData'), 'temp-responses');
  fs.mkdirSync(tempDir, { recursive: true });
  return path.join(tempDir, `response-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
}

function pickHeader(headers: [string, string][], name: string): string | undefined {
  const lower = name.toLowerCase();
  return headers.find(([k]) => k.toLowerCase() === lower)?.[1];
}

function headerHas(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

// Headers undici refuses (or recomputes itself) — see undici's processHeader.
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'expect',
]);

/**
 * Postman-style leniency: trim whitespace and default to http:// when the
 * user typed `localhost:3000/x` or `example.com` without a scheme.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

/** Per WHATWG multipart/form-data serialization: escape quotes and newlines in names. */
function escapeFormDataName(name: string): string {
  return name.replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22');
}

const EXT_MIME: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  js: 'application/javascript',
  css: 'text/css',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
};

function mimeTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/**
 * Resolve an auto-header value. Static values pass through; the sentinel
 * `<auto>` is computed per-header name (Host from URL, Volt-Token = UUID).
 * Returns null to suppress (e.g. Host with unparseable URL).
 */
function resolveAutoValue(name: string, template: string, url: string): string | null {
  if (template !== '<auto>') return template;
  const lower = name.toLowerCase();
  if (lower === 'host') {
    try {
      const u = new URL(url);
      return u.host; // host == hostname[:port]
    } catch {
      return null;
    }
  }
  if (lower === 'volt-token') return randomUUID();
  // Unknown <auto> placeholder — leave it as a fresh uuid as a useful default
  // rather than failing the request.
  return randomUUID();
}

function classifyError(err: unknown): { code: string; message: string } {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return { code: 'REQUEST_TIMEOUT', message: 'The request timed out.' };
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { code: 'REQUEST_CANCELLED', message: 'The request was cancelled.' };
  }
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'UND_ERR_ABORTED') {
      return { code: 'REQUEST_CANCELLED', message: 'The request was cancelled.' };
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return { code, message: 'DNS lookup failed — host not found.' };
    }
    if (code === 'ECONNREFUSED') {
      return { code, message: 'Connection refused.' };
    }
    if (code === 'ECONNRESET') {
      return { code, message: 'Connection reset by remote host.' };
    }
    if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT') {
      return { code, message: 'Connection timed out — the host did not respond.' };
    }
    if (code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT') {
      return { code, message: 'The server stopped responding mid-request.' };
    }
    if (code === 'ERR_INVALID_URL' || /invalid url/i.test(err.message)) {
      return { code: 'INVALID_URL', message: `Invalid URL: ${err.message}` };
    }
    if (
      code &&
      (code.startsWith('CERT_') ||
        code.startsWith('ERR_TLS_') ||
        code.startsWith('UNABLE_TO_') ||
        code.startsWith('SELF_SIGNED') ||
        code.startsWith('DEPTH_ZERO') ||
        code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
        code === 'EPROTO')
    ) {
      return {
        code,
        message: `TLS error: ${err.message}. Turn off "Verify TLS certificates" in the request Settings tab to send anyway.`,
      };
    }
    return { code: code ?? 'REQUEST_FAILED', message: err.message };
  }
  return { code: 'REQUEST_FAILED', message: String(err) };
}
