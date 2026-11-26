// Hands request:send results back to MCP `send_request` calls.
//
// MCP sends a saved request through the renderer (same path as the desktop
// widget: env, collection vars, globals, OAuth, send settings, scripts). The
// renderer only reports ok/error back, so the request:send IPC handler drops
// the full response here and the waiting MCP call picks it up.

const waiting = new Map<string, number>();
const captured = new Map<string, unknown>();

/** Start capturing the next request:send output for `requestId`. */
export function beginCapture(requestId: string) {
  waiting.set(requestId, (waiting.get(requestId) ?? 0) + 1);
}

/** Stop capturing and return what was captured (if anything). */
export function endCapture(requestId: string): unknown {
  const n = (waiting.get(requestId) ?? 1) - 1;
  if (n <= 0) waiting.delete(requestId);
  else waiting.set(requestId, n);
  const out = captured.get(requestId);
  captured.delete(requestId);
  return out;
}

/** Called by request:send after every send. No-op unless MCP is waiting. */
export function deliverSendOutput(requestId: string | null | undefined, output: unknown) {
  if (requestId && waiting.has(requestId)) captured.set(requestId, output);
}
