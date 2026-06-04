// Sends a resolved request via undici and returns a structured result.

import { request as undiciRequest } from 'undici';

import type { ResolvedRequest } from './resolve';

export interface SendResultOk {
  ok: true;
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  contentType: string | null;
  durationMs: number;
}
export interface SendResultErr {
  ok: false;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
}
export type SendResult = SendResultOk | SendResultErr;

export async function sendRequest(req: ResolvedRequest): Promise<SendResult> {
  const start = Date.now();
  try {
    const url = req.url;
    const headers: Record<string, string> = { ...req.headers };
    let body: string | undefined;
    if (req.body.type === 'raw') {
      body = req.body.content;
      // Auto-default content-type for raw bodies if the caller didn't set one.
      const hasCT = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
      if (!hasCT && body.length > 0) headers['content-type'] = 'application/json';
    }

    const res = await undiciRequest(url, {
      method: req.method as never,
      headers,
      body,
      headersTimeout: req.timeoutMs,
      bodyTimeout: req.timeoutMs,
    });
    const buf = Buffer.from(await res.body.arrayBuffer());
    const flatHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      flatHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    }
    const contentType = flatHeaders['content-type'] ?? null;
    return {
      ok: true,
      statusCode: res.statusCode,
      headers: flatHeaders,
      body: buf,
      contentType,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return {
      ok: false,
      errorCode: err.code ?? 'ERR',
      errorMessage: err.message ?? String(e),
      durationMs: Date.now() - start,
    };
  }
}
