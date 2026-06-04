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

export function wsOpen(url: string): { connectionId: string; ok: boolean; error?: string } {
  if (!/^wss?:\/\//i.test(url)) return { connectionId: '', ok: false, error: 'URL must start with ws:// or wss://' };
  const id = `ws_${Math.random().toString(36).slice(2, 12)}`;
  try {
    const ws = new WebSocket(url);
    conns.set(id, { ws, url });

    ws.addEventListener('open', () => {
      emit({ kind: 'ws:state', connectionId: id, state: 'open' });
    });
    ws.addEventListener('close', (ev: { code?: number; reason?: string }) => {
      emit({
        kind: 'ws:state',
        connectionId: id,
        state: 'closed',
        code: ev.code,
        reason: ev.reason,
      });
      conns.delete(id);
    });
    ws.addEventListener('error', () => {
      emit({ kind: 'ws:state', connectionId: id, state: 'error' });
    });
    ws.addEventListener('message', (ev: { data: unknown }) => {
      const data = ev.data;
      let text: string;
      if (typeof data === 'string') text = data;
      else if (data instanceof ArrayBuffer) text = `<binary ${data.byteLength}B>`;
      else text = String(data);
      emit({
        kind: 'ws:message',
        connectionId: id,
        direction: 'in',
        timestamp: Date.now(),
        text,
      });
    });

    return { connectionId: id, ok: true };
  } catch (e) {
    return { connectionId: id, ok: false, error: (e as Error).message };
  }
}

export function wsSend(connectionId: string, text: string): { ok: boolean; error?: string } {
  const c = conns.get(connectionId);
  if (!c) return { ok: false, error: 'Connection not found' };
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

export function wsClose(connectionId: string): { ok: boolean } {
  const c = conns.get(connectionId);
  if (c) {
    try {
      c.ws.close();
    } catch {
      /* ignore */
    }
    conns.delete(connectionId);
  }
  return { ok: true };
}
