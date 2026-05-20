// Preload script — runs in renderer context but with limited Node access.
//
// Exposes a single object `window.volt` containing:
//   - one method per IPC channel (auto-generated from the contracts registry)
//   - an `on()` method to subscribe to one-way main→renderer events
//
// Security:
//   - contextIsolation = true (preload's globals can't leak to web content)
//   - nodeIntegration = false (no `require` in renderer)
//   - sandbox = true (process is sandboxed by Chromium)
//
// We DO NOT pass ipcRenderer itself to the renderer — only invoke() wrappers,
// keyed by allowed channel names. This prevents the renderer from invoking
// arbitrary channels.

import { contextBridge, ipcRenderer } from 'electron';
// Import from the explicit subpath. The root `@volt/shared` re-exports via
// `__exportStar(require(...))` which Rollup can't statically analyze in the
// preload bundle. The `/ipc` subpath resolves to a single compiled file with
// explicit exports, so the bundler picks them up cleanly.
import { IPC, type IpcChannel } from '@volt/shared/ipc';

// Build the typed API object: one method per channel.
const api: Record<string, (input: unknown) => Promise<unknown>> = {};

for (const channel of Object.keys(IPC) as IpcChannel[]) {
  // Convert "request:send" to camelCased path "request.send" for the JS API,
  // OR keep colon-separated and let TS infer. We'll keep colon-separated:
  // window.volt['request:send'](input)
  api[channel] = (input: unknown) => ipcRenderer.invoke(channel, input);
}

// One-way events from main → renderer
type EventListener = (event: unknown) => void;
const listeners = new Set<EventListener>();

ipcRenderer.on('volt:event', (_event, payload: unknown) => {
  for (const l of listeners) {
    try {
      l(payload);
    } catch (e) {
      console.error('event listener error:', e);
    }
  }
});

const volt = {
  ...api,
  on(listener: EventListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

contextBridge.exposeInMainWorld('volt', volt);

// Also expose channel list for debugging
contextBridge.exposeInMainWorld('voltMeta', {
  channels: Object.keys(IPC),
  buildVersion: process.env.npm_package_version ?? 'dev',
});
