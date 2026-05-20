// Thin wrapper around window.volt — gives us a typed surface to import from
// hooks/components without having to repeat `window.volt[...]` everywhere.
//
// We re-export it as `voltApi` so TypeScript can infer parameter types from
// the IPC contracts (declared in src/window-volt.d.ts).

export const voltApi = window.volt;

/**
 * Subscribe to one-way main→renderer events and run a callback on each.
 * Returns an unsubscribe function. Designed for useEffect-style use.
 */
export function onVoltEvent(cb: (event: Parameters<Parameters<typeof voltApi.on>[0]>[0]) => void) {
  return voltApi.on(cb);
}
