// Pure helpers for {{variable}} handling in the renderer: the shared regex,
// Postman-style dynamic variables ({{$guid}}, {{$timestamp}}, …), scope
// precedence, and substitution. No React / CodeMirror imports so this can be
// used from anywhere (RequestEditor, ChainModal, overlays, tests).
//
// Scope precedence (Postman parity, highest wins):
//   environment > collection (deepest first) > globals
// Disabled variables (enabled === false) are skipped entirely.

import type { VarInfo } from './variables-context';

/** Matches `{{name}}` / `{{ name }}` / `{{$dynamic}}`. Group 1 is the name. */
export const VAR_REGEX = /\{\{\s*(\$?[\w.-]+)\s*\}\}/g;

export interface VariableLike {
  key: string;
  value: string;
  enabled?: boolean;
  secret?: boolean;
}

// ─────────────────────────────────────────────────────────
// Dynamic variables (subset of Postman's `$`-prefixed set)
// ─────────────────────────────────────────────────────────

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
const LAST_NAMES = ['Smith', 'Jones', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Clark', 'Lewis', 'Walker', 'Young'];
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];
const COLORS = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'black', 'white', 'cyan', 'magenta'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function alnum(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randInt(0, chars.length - 1)];
  return s;
}

const DYNAMIC: Record<string, () => string> = {
  $guid: uuid,
  $randomUUID: uuid,
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $isoTimestamp: () => new Date().toISOString(),
  $randomInt: () => String(randInt(0, 1000)),
  $randomAlphaNumeric: () => alnum(1),
  $randomBoolean: () => String(Math.random() < 0.5),
  $randomFirstName: () => pick(FIRST_NAMES),
  $randomLastName: () => pick(LAST_NAMES),
  $randomFullName: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  $randomEmail: () => `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}@example.com`,
  $randomUserName: () => `${pick(FIRST_NAMES)}_${pick(LAST_NAMES)}`.toLowerCase(),
  $randomWord: () => pick(WORDS),
  $randomWords: () => `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}`,
  $randomColor: () => pick(COLORS),
  $randomHexColor: () => '#' + randInt(0, 0xffffff).toString(16).padStart(6, '0'),
  $randomIP: () => `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
  $randomIPV6: () =>
    Array.from({ length: 8 }, () => randInt(0, 0xffff).toString(16).padStart(4, '0')).join(':'),
  $randomPort: () => String(randInt(1024, 65535)),
  $randomPrice: () => (Math.random() * 1000).toFixed(2),
  $randomPhoneNumber: () => `${randInt(200, 999)}-${randInt(200, 999)}-${randInt(1000, 9999)}`,
  $randomCity: () => pick(['Berlin', 'Istanbul', 'London', 'Paris', 'Tokyo', 'Toronto', 'Sydney']),
  $randomCountry: () => pick(['Germany', 'Turkey', 'United Kingdom', 'France', 'Japan', 'Canada']),
  $randomUrl: () => `https://${pick(WORDS)}.example.com`,
  $randomDomainName: () => `${pick(WORDS)}.example.com`,
  $randomPassword: () => alnum(16),
  $randomDateRecent: () => new Date(Date.now() - randInt(0, 86_400_000)).toISOString(),
  $randomDatePast: () => new Date(Date.now() - randInt(86_400_000, 365 * 86_400_000)).toISOString(),
  $randomDateFuture: () => new Date(Date.now() + randInt(86_400_000, 365 * 86_400_000)).toISOString(),
  $randomLoremWord: () => pick(['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur']),
  $randomLoremSentence: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
};

export function isDynamicVariable(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(DYNAMIC, name);
}

/** Returns a fresh value for a `$dynamic` name, or undefined if unknown. */
export function resolveDynamicVariable(name: string): string | undefined {
  const fn = Object.prototype.hasOwnProperty.call(DYNAMIC, name) ? DYNAMIC[name] : undefined;
  return fn ? fn() : undefined;
}

export const DYNAMIC_VARIABLE_NAMES: readonly string[] = Object.keys(DYNAMIC);

// ─────────────────────────────────────────────────────────
// Scope merging
// ─────────────────────────────────────────────────────────

export interface ScopeEnv {
  id: string;
  name: string;
  variables?: VariableLike[];
}
export interface ScopeCollection {
  id: string;
  name?: string;
  variables?: VariableLike[];
}

/**
 * Merge globals + collection chain + environment into a name → VarInfo map.
 * `chain` is ordered direct-parent first (as `collectColChain` returns it);
 * deeper collections override shallower ones. The environment overrides
 * everything (Postman: env > collection > global).
 */
export function buildVariableMap(
  globals: Record<string, unknown> | null | undefined,
  env: ScopeEnv | null | undefined,
  chain: ScopeCollection[],
): Map<string, VarInfo> {
  const m = new Map<string, VarInfo>();
  for (const [k, v] of Object.entries(globals ?? {})) {
    if (v == null || !k) continue;
    m.set(k, {
      value: typeof v === 'string' ? v : JSON.stringify(v),
      scope: 'globals',
      scopeId: null,
      scopeName: 'Globals',
    });
  }
  for (const c of [...chain].reverse()) {
    for (const v of c.variables ?? []) {
      if (v.enabled === false || !v.key) continue;
      m.set(v.key, {
        value: v.value,
        scope: 'collection',
        scopeId: c.id,
        scopeName: c.name ?? 'Collection',
        secret: v.secret === true,
      });
    }
  }
  if (env) {
    for (const v of env.variables ?? []) {
      if (v.enabled === false || !v.key) continue;
      m.set(v.key, {
        value: v.value,
        scope: 'env',
        scopeId: env.id,
        scopeName: env.name,
        secret: v.secret === true,
      });
    }
  }
  return m;
}

// ─────────────────────────────────────────────────────────
// Substitution
// ─────────────────────────────────────────────────────────

type VarSource = Map<string, string> | Map<string, { value: string }> | Record<string, string>;

function lookup(vars: VarSource, name: string): string | undefined {
  if (vars instanceof Map) {
    const v = vars.get(name) as string | { value: string } | undefined;
    if (v === undefined) return undefined;
    return typeof v === 'string' ? v : v.value;
  }
  return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : undefined;
}

/**
 * Replace every `{{name}}` in `input`. User-defined variables win over
 * dynamic ones (so a user can shadow `$timestamp` if they really want to).
 * Unknown names resolve to '' and are collected in `unresolved` when given.
 */
export function substituteVariables(
  input: string,
  vars: VarSource,
  unresolved?: Set<string>,
): string {
  if (!input || !input.includes('{{')) return input;
  return input.replace(VAR_REGEX, (match, name: string) => {
    const v = lookup(vars, name);
    if (v !== undefined) return v;
    const dyn = resolveDynamicVariable(name);
    if (dyn !== undefined) return dyn;
    unresolved?.add(name);
    // Leave unknown placeholders intact, like Postman: the literal `{{name}}`
    // is sent, and a pre-request script that sets `name` can still fill it in
    // during the main process's second substitution pass.
    return match;
  });
}

/** True when `name` would resolve (user-defined in `vars`, or dynamic). */
export function isVariableResolved(name: string, vars: VarSource | null | undefined): boolean {
  if (vars && lookup(vars, name) !== undefined) return true;
  return isDynamicVariable(name);
}

/** Collect the distinct variable names referenced in a string. */
export function findVariableNames(input: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(VAR_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) out.add(m[1]!);
  return Array.from(out);
}
