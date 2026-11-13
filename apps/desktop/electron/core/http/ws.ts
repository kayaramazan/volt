// Minimal WebSocket engine. Uses undici's built-in WebSocket (no extra dep).
//
// IPC contract:
//   ws:open    → returns { connectionId }; main holds the live socket
//   ws:send    → send text frame
//   ws:close   → close connection
// Server → client messages are emitted as `volt:event` { kind: 'ws:message' | 'ws:state' }
// to the renderer so the request editor can append them to its log.

import { WebSocket } from 'undici';
import { BrowserWindow } from 'electron';

interface Conn {
  ws: WebSocket;
  url: string;
}

const conns = new Map<string, Conn>();

function emit(payload: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('volt:event', payload);
  }
}

export interface WsOpenOptions {
  /** Extra handshake headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Sec-WebSocket-Protocol values offered to the server. */
  protocols?: string[];
}

export function wsOpen(
  url: string,
  opts: WsOpenOptions = {},
): { connectionId: string; ok: boolean; error?: string } {
  const trimmed = url.trim();
  if (!/^wss?:\/\//i.test(trimmed)) return { connectionId: '', ok: false, error: 'URL must start with ws:// or wss://' };
  const id = `ws_${Math.random().toString(36).slice(2, 12)}`;
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(opts.headers ?? {})) if (k.trim()) headers[k.trim()] = v;
    const protocols = (opts.protocols ?? []).map((p) => p.trim()).filter(Boolean);
    const ws = new WebSocket(trimmed, {
      ...(protocols.length > 0 ? { protocols } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });
    // undici defaults to 'blob' for binary frames; we want raw bytes so the
    // renderer can show a readable preview instead of "[object Blob]".
    ws.binaryType = 'arraybuffer';
    conns.set(id, { ws, url: trimmed });

    ws.addEventListener('open', () => {
      emit({ kind: 'ws:state', connectionId: id, state: 'open', protocol: ws.protocol || undefined });
    });
    ws.addEventListener('close', (ev: { code?: number; reason?: string; wasClean?: boolean }) => {
      if (!conns.has(id)) return; // already reported (synthetic close above)
      emit({
        kind: 'ws:state',
        connectionId: id,
        state: 'closed',
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
      });
      conns.delete(id);
    });
    ws.addEventListener('error', (ev: unknown) => {
      // undici fires an ErrorEvent carrying the underlying Error. Surface its
      // message so the renderer can tell the user *why* (ECONNREFUSED, bad
      // handshake status, TLS failure, …) instead of a bare "error".
      const errEv = ev as { error?: { message?: string }; message?: string } | undefined;
      const reason = errEv?.error?.message || errEv?.message || 'WebSocket error';
      emit({ kind: 'ws:state', connectionId: id, state: 'error', reason });
      // When the handshake itself fails (refused, non-101, bad subprotocol)
      // undici never fires 'close' and readyState stays CONNECTING. Synthesize
      // the close so the renderer settles and the entry doesn't leak.
      setTimeout(() => {
        if (conns.get(id)?.ws !== ws || ws.readyState !== 0) return;
        conns.delete(id);
        emit({ kind: 'ws:state', connectionId: id, state: 'closed', code: 1006, reason, wasClean: false });
      }, 50);
    });
    ws.addEventListener('message', (ev: { data: unknown }) => {
      const data = ev.data;
      let text: string;
      let binary = false;
      if (typeof data === 'string') {
        text = data;
      } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        binary = true;
        text = describeBinary(data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array((data as ArrayBufferView).buffer, (data as ArrayBufferView).byteOffset, (data as ArrayBufferView).byteLength));
      } else {
        text = String(data);
      }
      emit({
        kind: 'ws:message',
        connectionId: id,
        direction: 'in',
        timestamp: Date.now(),
        text,
        binary,
      });
    });

    return { connectionId: id, ok: true };
  } catch (e) {
    conns.delete(id);
    return { connectionId: id, ok: false, error: (e as Error).message };
  }
}

/** Binary frames: show as UTF-8 text when the bytes decode cleanly, else a
 *  base64 preview with the byte count so the user can still inspect it. */
function describeBinary(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!/[\u0000-\u0008\u000E-\u001F]/.test(text)) return text;
  } catch {
    /* not valid UTF-8 */
  }
  const b64 = Buffer.from(bytes).toString('base64');
  const preview = b64.length > 4096 ? `${b64.slice(0, 4096)}…` : b64;
  return `<binary ${bytes.byteLength} bytes, base64> ${preview}`;
}

export function wsSend(connectionId: string, text: string): { ok: boolean; error?: string } {
  const c = conns.get(connectionId);
  if (!c) return { ok: false, error: 'Connection not found' };
  // WebSocket.readyState: 0 CONNECTING, 1 OPEN, 2 CLOSING, 3 CLOSED.
  if (c.ws.readyState !== 1) {
    return { ok: false, error: c.ws.readyState === 0 ? 'Connection is still opening' : 'Connection is closed' };
  }
  try {
    c.ws.send(text);
    emit({
      kind: 'ws:message',
      connectionId,
      direction: 'out',
      timestamp: Date.now(),
      text,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function wsClose(connectionId: string, code?: number, reason?: string): { ok: boolean } {
  const c = conns.get(connectionId);
  if (c) {
    try {
      // Only 1000 and 3000–4999 are legal from the client side; anything else
      // makes undici throw and the socket would stay open.
      const legal = code === 1000 || (code != null && code >= 3000 && code <= 4999);
      if (legal) c.ws.close(code, reason ?? '');
      else c.ws.close();
    } catch {
      /* ignore */
    }
    // Leave the entry in place: the 'close' listener removes it once the
    // closing handshake finishes, and emits the final code/reason.
  }
  return { ok: true };
}
