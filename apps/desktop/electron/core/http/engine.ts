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
import path from 'node:path';
import { Readable } from 'node:stream';

import { getAutoHeaders } from '../db/queries';

// In-flight requests, keyed by inFlightId. Cancellable via AbortController.
const inFlight = new Map<string, AbortController>();

// Shared agent — connection pooling improves perf for repeat requests to same host.
let _agent: Agent | null = null;
function getAgent(ignoreTlsErrors: boolean): Agent {
  if (ignoreTlsErrors) {
    // Per-request agent for TLS-error-tolerant mode
    return new Agent({
      connect: { rejectUnauthorized: false },
    });
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

  // Timeout handling — wraps abort signal
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Request timeout', 'TimeoutError'));
  }, req.timeoutMs > 0 ? req.timeoutMs : 60_000);

  try {
    // Build body based on type
    const { body, contentType } = serializeBody(req);

    // Merge content-type into headers if applicable and not already set
    const headers: Record<string, string> = { ...req.headers };
    if (contentType && !headerHas(headers, 'content-type')) {
      headers['Content-Type'] = contentType;
    }
    // Merge enabled auto-headers — user-defined entries (already in `headers`)
    // win on case-insensitive name match.
    for (const h of getAutoHeaders()) {
      if (!h.enabled || !h.key) continue;
      if (headerHas(headers, h.key)) continue;
      const value = resolveAutoValue(h.key, h.value, req.url);
      if (value !== null) headers[h.key] = value;
    }

    // Mark TTFB time after we get the first byte of the response.
    let ttfbMark: number | null = null;

    const response = await undiciRequest(req.url, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      maxRedirections: req.followRedirects ? 5 : 0,
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
    const { bodyBuffer, bodyTempFile, bodySize } = await consumeBody(response.body as unknown as Readable);
    const downloadEnd = performance.now();
    timing.downloadMs = Math.round(downloadEnd - ttfbMark);
    timing.totalMs = Math.round(downloadEnd - t0);

    return {
      ok: true,
      statusCode: response.statusCode,
      statusText: '',  // undici doesn't expose reason phrase directly
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
    clearTimeout(timeoutId);
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
        if (field.kind === 'text') {
          parts.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${field.key}"\r\n\r\n${field.value}\r\n`,
            ),
          );
        } else {
          // file
          if (!fs.existsSync(field.value)) {
            throw new Error(`File not found: ${field.value}`);
          }
          const fileBuf = fs.readFileSync(field.value);
          const filename = path.basename(field.value);
          parts.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${field.key}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
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
      if (!fs.existsSync(body.filePath)) {
        throw new Error(`File not found: ${body.filePath}`);
      }
      return {
        body: fs.createReadStream(body.filePath),
        contentType: 'application/octet-stream',
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
      const tempDir = path.join(app.getPath('userData'), 'temp-responses');
      fs.mkdirSync(tempDir, { recursive: true });
      tempFilePath = path.join(tempDir, `response-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
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

function pickHeader(headers: [string, string][], name: string): string | undefined {
  const lower = name.toLowerCase();
  return headers.find(([k]) => k.toLowerCase() === lower)?.[1];
}

function headerHas(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
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
    if (code === 'ENOTFOUND') {
      return { code, message: 'DNS lookup failed — host not found.' };
    }
    if (code === 'ECONNREFUSED') {
      return { code, message: 'Connection refused.' };
    }
    if (code === 'ECONNRESET') {
      return { code, message: 'Connection reset by remote host.' };
    }
    if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return { code: code ?? 'TLS_ERROR', message: `TLS error: ${err.message}` };
    }
    return { code: code ?? 'REQUEST_FAILED', message: err.message };
  }
  return { code: 'REQUEST_FAILED', message: String(err) };
}
