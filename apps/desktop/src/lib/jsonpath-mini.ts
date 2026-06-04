// Tiny dotted JSONPath: supports `data.user.name`, `items[0]`, `items[2].id`.
// Returns undefined for any missing segment. Not full JSONPath — just what
// chain-step "extract" needs.

export function selectPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  // Normalize: a.b[0].c → ["a","b","0","c"]
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\./, '')
    .split('.');
  for (const raw of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(raw);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[raw];
    } else {
      return undefined;
    }
  }
  return cur;
}
