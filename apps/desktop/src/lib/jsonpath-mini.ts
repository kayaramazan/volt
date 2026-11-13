// Tiny dotted JSONPath: supports `data.user.name`, `items[0]`, `items[2].id`,
// the Postman-style `$.data.token` / `$['content-type']` forms and negative
// array indexes (`items[-1]`). Returns undefined for any missing segment. Not
// full JSONPath — just what chain-step "extract" needs.

export function selectPath(value: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '$') return value;
  const parts = tokenize(trimmed);
  if (!parts) return undefined;
  let cur: unknown = value;
  for (const raw of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(raw);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx < 0 ? cur.length + idx : idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[raw];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** `$.a.b[0]['c-d']` → ["a","b","0","c-d"]; null when the path is malformed. */
function tokenize(path: string): string[] | null {
  const out: string[] = [];
  let i = path.startsWith('$') ? 1 : 0;
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      i++;
      continue;
    }
    if (ch === '[') {
      const close = path.indexOf(']', i);
      if (close < 0) return null;
      let inner = path.slice(i + 1, close).trim();
      if (
        (inner.startsWith("'") && inner.endsWith("'")) ||
        (inner.startsWith('"') && inner.endsWith('"'))
      ) {
        inner = inner.slice(1, -1);
      }
      out.push(inner);
      i = close + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== '.' && path[j] !== '[') j++;
    out.push(path.slice(i, j));
    i = j;
  }
  return out;
}
