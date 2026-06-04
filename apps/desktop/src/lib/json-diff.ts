// Recursive JSON diff. Produces a flat list of changes, each with a JSON path
// (e.g. "data.user.id") and a kind: added / removed / changed.
//
// Conservative semantics:
//   - Same primitive value → no change.
//   - Both arrays → diff by index. Lengths can differ; missing slots produce
//     added/removed entries.
//   - Both objects → diff by union of keys.
//   - Type mismatch (e.g. string vs object) → single "changed" entry.

export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  left?: unknown;
  right?: unknown;
}

export function diffJson(left: unknown, right: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk('', left, right, out);
  return out;
}

function walk(path: string, l: unknown, r: unknown, out: DiffEntry[]) {
  if (Object.is(l, r)) return;

  const lt = typeOf(l);
  const rt = typeOf(r);

  if (lt === 'undefined' && rt !== 'undefined') {
    out.push({ path: path || '$', kind: 'added', right: r });
    return;
  }
  if (lt !== 'undefined' && rt === 'undefined') {
    out.push({ path: path || '$', kind: 'removed', left: l });
    return;
  }
  if (lt !== rt) {
    out.push({ path: path || '$', kind: 'changed', left: l, right: r });
    return;
  }

  if (lt === 'array') {
    const la = l as unknown[];
    const ra = r as unknown[];
    const len = Math.max(la.length, ra.length);
    for (let i = 0; i < len; i++) {
      walk(`${path}[${i}]`, la[i], ra[i], out);
    }
    return;
  }

  if (lt === 'object') {
    const lo = l as Record<string, unknown>;
    const ro = r as Record<string, unknown>;
    const keys = new Set([...Object.keys(lo), ...Object.keys(ro)]);
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      walk(childPath, lo[k], ro[k], out);
    }
    return;
  }

  // Primitives that aren't strictly equal.
  out.push({ path: path || '$', kind: 'changed', left: l, right: r });
}

function typeOf(v: unknown): 'undefined' | 'null' | 'array' | 'object' | 'primitive' {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return 'primitive';
}

export function formatValue(v: unknown): string {
  if (v === undefined) return '—';
  if (typeof v === 'string') return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
