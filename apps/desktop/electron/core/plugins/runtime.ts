// Plugin runtime — loads user-supplied .js files from the plugins folder,
// evaluates them in isolated vm contexts, and exposes the transformers they
// register so the renderer can apply them to response bodies.
//
// Security model matches the existing pre/post script runner: each plugin
// runs in its own `vm.createContext` sandbox with a curated `volt.*` API
// plus a handful of safe globals. No `require`, no `import`, no fs/network
// access from inside a plugin. Transformer invocation always happens
// *inside* the plugin's context with a configurable timeout.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { app } from 'electron';

const PLUGINS_DIR_NAME = 'plugins';
const INVOKE_KEY = '__voltInvokeTransformer';
const IN_BODY_KEY = '__voltInBody';
const IN_CTX_KEY = '__voltInCtx';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface TransformerInfo {
  id: string;            // qualified: "<pluginId>:<localId>"
  pluginId: string;
  localId: string;       // as registered by the plugin
  name: string;
  description?: string;
  matchContentType?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version?: string;
  filePath: string;
  error: string | null;
  transformers: TransformerInfo[];
}

interface PluginRuntime {
  info: PluginInfo;
  context: vm.Context | null;
}

const runtimes = new Map<string, PluginRuntime>();

export function pluginsDir(): string {
  return path.join(app.getPath('userData'), PLUGINS_DIR_NAME);
}

export function listPlugins(): PluginInfo[] {
  return [...runtimes.values()].map((r) => r.info).sort((a, b) => a.name.localeCompare(b.name));
}

export function listTransformers(): TransformerInfo[] {
  const out: TransformerInfo[] = [];
  for (const r of runtimes.values()) {
    if (r.info.error) continue;
    out.push(...r.info.transformers);
  }
  return out;
}

/** Discover .js files under the plugins folder and (re)load them all.
 *  Idempotent — clears previously-loaded plugins first. */
export function loadAllPlugins(): { loaded: number; errored: number; dir: string } {
  runtimes.clear();
  const dir = pluginsDir();
  ensureDirWithReadme(dir);
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'));
  let loaded = 0;
  let errored = 0;
  for (const e of entries) {
    const filePath = path.join(dir, e.name);
    const id = e.name.replace(/\.js$/, '');
    const runtime = loadOne(id, filePath);
    runtimes.set(id, runtime);
    if (runtime.info.error) errored++;
    else loaded++;
  }
  return { loaded, errored, dir };
}

export interface ApplyTransformerInput {
  transformerId: string;
  body: string;
  contentType: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type ApplyTransformerResult =
  | { ok: true; body: string; contentType: string | null }
  | { ok: false; error: string };

export function applyTransformer(input: ApplyTransformerInput): ApplyTransformerResult {
  const sepIdx = input.transformerId.indexOf(':');
  if (sepIdx < 0) return { ok: false, error: `Invalid transformer id "${input.transformerId}".` };
  const pluginId = input.transformerId.slice(0, sepIdx);
  const localId = input.transformerId.slice(sepIdx + 1);

  const runtime = runtimes.get(pluginId);
  if (!runtime || !runtime.context) {
    return { ok: false, error: `Plugin "${pluginId}" not loaded.` };
  }
  if (runtime.info.error) {
    return { ok: false, error: `Plugin "${pluginId}" failed to load: ${runtime.info.error}` };
  }
  if (!runtime.info.transformers.some((t) => t.localId === localId)) {
    return { ok: false, error: `Transformer "${localId}" not found in plugin "${pluginId}".` };
  }

  try {
    // Bind the inputs into the context as primitives (a host object would
    // hand the plugin a path to the host realm via `.constructor`), invoke
    // through the sandbox-owned dispatcher under the vm timeout, and read
    // back a JSON string the dispatcher normalised inside the sandbox.
    const ctx = runtime.context as vm.Context & Record<string, unknown>;
    ctx[IN_BODY_KEY] = input.body;
    ctx[IN_CTX_KEY] = JSON.stringify({
      contentType: input.contentType ?? null,
      headers: input.headers ?? {},
    });
    let raw: unknown;
    try {
      raw = vm.runInContext(
        `${INVOKE_KEY}(${JSON.stringify(localId)}, ${IN_BODY_KEY}, ${IN_CTX_KEY})`,
        ctx,
        { timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS, displayErrors: true },
      );
    } finally {
      delete ctx[IN_BODY_KEY];
      delete ctx[IN_CTX_KEY];
    }
    return normalizeResult(raw, input.contentType);
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? String(e) };
  }
}

/** Open the plugins folder in the OS file manager.
 *  Returns the absolute path the caller can also show in the UI. */
export function ensurePluginsFolder(): string {
  const dir = pluginsDir();
  ensureDirWithReadme(dir);
  return dir;
}

// ─────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────

// Metadata only — the transform function itself stays inside the sandbox's
// own registry and is only ever invoked through the in-context dispatcher.
interface InternalTransformer {
  localId: string;
  name: string;
  description?: string;
  matchContentType?: string;
}

// Everything the plugin can touch is created *inside* its vm context by this
// script. The host only hands over `bridge`, a closure-held object whose
// methods take and return primitives (strings/numbers), so plugin code never
// gets a reference to a host-realm function or object — those would expose
// the host `Function` constructor via `.constructor` and with it `process`,
// `require`, fs and the network. Intrinsics (JSON, Math, Date, Promise, …)
// are the context's own.
const SANDBOX_SETUP = String.raw`
(function (bridge, INVOKE_KEY) {
  'use strict';
  // Capture intrinsics now; plugin code may overwrite the globals later.
  const U8 = Uint8Array;
  const Str = String;
  const fromCharCode = String.fromCharCode;
  const JSONparse = JSON.parse;
  const JSONstringify = JSON.stringify;
  const MapCtor = Map;
  const defineProperty = Object.defineProperty;
  const freeze = Object.freeze;
  const registry = new MapCtor();

  const toStr = (v) => (typeof v === 'string' ? v : Str(v));
  const safeJson = (a) => {
    if (typeof a === 'string') return a;
    try { const s = JSONstringify(a); return s === undefined ? Str(a) : s; } catch (e) { return Str(a); }
  };
  const fmt = (args) => { let out = ''; for (let i = 0; i < args.length; i++) out += (i ? ' ' : '') + safeJson(args[i]); return out; };

  // bytes <-> "binary string" (one char per byte): the only shape that
  // crosses the bridge, because strings are primitives.
  const binStr = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return s;
  };
  const fromBinStr = (s) => { const b = new U8(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
  const bytesOf = (input, enc) => {
    if (input instanceof U8) return input;
    if (typeof input === 'string') return fromBinStr(bridge.encode(input, enc ? toStr(enc) : 'utf8'));
    if (input && typeof input === 'object' && typeof input.length === 'number') return U8.from(input);
    if (input && typeof input === 'object' && input.buffer instanceof ArrayBuffer) return new U8(input.buffer, input.byteOffset || 0, input.byteLength);
    throw new TypeError('Unsupported input: expected a string, array or Uint8Array.');
  };

  // Minimal Buffer shim covering the documented usage
  // (Buffer.from(x, enc).toString(enc), length, slice, iteration, toJSON).
  class Buffer {
    constructor(bytes) { this._bytes = bytes; }
    static from(input, enc) { return new Buffer(bytesOf(input, enc)); }
    static isBuffer(v) { return v instanceof Buffer; }
    static byteLength(input, enc) { return bytesOf(input, enc).length; }
    static concat(list) { let n = 0; for (const b of list) n += b.length; const out = new U8(n); let o = 0; for (const b of list) { out.set(b._bytes, o); o += b.length; } return new Buffer(out); }
    get length() { return this._bytes.length; }
    get byteLength() { return this._bytes.length; }
    toString(enc) { return bridge.decode(binStr(this._bytes), enc ? toStr(enc) : 'utf8'); }
    toJSON() { return { type: 'Buffer', data: Array.from(this._bytes) }; }
    slice(a, b) { return new Buffer(this._bytes.slice(a, b)); }
    subarray(a, b) { return new Buffer(this._bytes.subarray(a, b)); }
    equals(o) { if (!(o instanceof Buffer) || o.length !== this.length) return false; for (let i = 0; i < this.length; i++) if (o._bytes[i] !== this._bytes[i]) return false; return true; }
    [Symbol.iterator]() { return this._bytes[Symbol.iterator](); }
  }
  class TextEncoder {
    get encoding() { return 'utf-8'; }
    encode(s) { return bytesOf(toStr(s == null ? '' : s), 'utf8'); }
  }
  class TextDecoder {
    constructor(label) { this.encoding = label ? toStr(label) : 'utf-8'; }
    decode(input) { return bridge.decode(binStr(input == null ? new U8(0) : bytesOf(input)), this.encoding); }
  }
  const atob = (s) => bridge.encode(toStr(s), 'base64');
  const btoa = (s) => bridge.decode(toStr(s), 'base64');

  const mkLog = (level) => function () { bridge.log(level, fmt(arguments)); };
  const console = freeze({ log: mkLog('log'), info: mkLog('log'), debug: mkLog('log'), warn: mkLog('warn'), error: mkLog('error') });

  const volt = freeze({
    plugin(info) {
      if (!info || typeof info !== 'object') return;
      bridge.setMeta(info.name != null ? toStr(info.name) : undefined, info.version != null ? toStr(info.version) : undefined);
    },
    transformer: freeze({
      register(input) {
        if (!input || typeof input !== 'object') throw new Error('register() requires an object.');
        if (!input.id || typeof input.id !== 'string') throw new Error('register() requires a string id.');
        if (typeof input.transform !== 'function') throw new Error('register() requires a transform function.');
        registry.set(input.id, input.transform);
        bridge.register(
          input.id,
          input.name != null ? toStr(input.name) : input.id,
          input.description != null ? toStr(input.description) : undefined,
          input.matchContentType != null ? toStr(input.matchContentType) : undefined,
        );
      },
    }),
    log: mkLog('log'),
  });

  // Host → sandbox dispatcher. Runs the transformer and normalises its
  // result to a JSON string *here*, under the vm timeout, so a getter or a
  // huge object can't stall the host once control returns.
  const invoke = function (localId, body, ctxJson) {
    const transform = registry.get(localId);
    if (!transform) throw new Error('Transformer "' + localId + '" not registered.');
    const r = transform(body, JSONparse(ctxJson));
    if (r == null) return JSONstringify({ error: 'Transformer returned no value.' });
    if (r && typeof r.then === 'function') return JSONstringify({ error: 'Transformers must be synchronous (a Promise was returned).' });
    if (typeof r === 'string') return JSONstringify({ body: r });
    if (typeof r === 'object') {
      const b = r.body;
      if (b === undefined) return JSONstringify({ error: 'Transformer returned an object without a "body".' });
      const body = typeof b === 'string' ? b : (b instanceof Buffer ? b.toString('utf8') : JSONstringify(b));
      const ct = typeof r.contentType === 'string' && r.contentType.length > 0 ? r.contentType : undefined;
      return JSONstringify({ body: body === undefined ? '' : body, contentType: ct });
    }
    return JSONstringify({ error: 'Transformer returned an unsupported value type.' });
  };

  const expose = (name, value) => defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: false });
  expose('console', console);
  expose('volt', volt);
  expose('Buffer', Buffer);
  expose('TextEncoder', TextEncoder);
  expose('TextDecoder', TextDecoder);
  expose('atob', atob);
  expose('btoa', btoa);
  // Not overridable: the host calls this by name after the plugin ran.
  defineProperty(globalThis, INVOKE_KEY, { value: invoke, writable: false, configurable: false, enumerable: false });
})
`;

const ENCODINGS = new Set<BufferEncoding>(['utf8', 'base64', 'base64url', 'hex', 'latin1', 'binary', 'ascii', 'utf16le', 'ucs2']);
function normEncoding(enc: string): BufferEncoding {
  const e = enc.toLowerCase().replace('-', '') as BufferEncoding;
  if (!ENCODINGS.has(e)) throw new TypeError(`Unsupported encoding "${enc}".`);
  return e;
}

function loadOne(id: string, filePath: string): PluginRuntime {
  const meta = {
    name: id,
    version: undefined as string | undefined,
  };
  const internalRegistry = new Map<string, InternalTransformer>();
  const tag = `[plugin ${id}]`;

  // Primitive-only bridge; see SANDBOX_SETUP.
  const bridge = {
    log(level: unknown, text: unknown) {
      const line = `${tag} ${String(text)}\n`;
      if (level === 'warn' || level === 'error') process.stderr.write(line);
      else process.stdout.write(line);
    },
    setMeta(name: unknown, version: unknown) {
      if (typeof name === 'string' && name) meta.name = name;
      if (typeof version === 'string' && version) meta.version = version;
    },
    register(localId: unknown, name: unknown, description: unknown, matchContentType: unknown) {
      if (typeof localId !== 'string') return;
      internalRegistry.set(localId, {
        localId,
        name: typeof name === 'string' ? name : localId,
        description: typeof description === 'string' ? description : undefined,
        matchContentType: typeof matchContentType === 'string' ? matchContentType : undefined,
      });
    },
    /** string in `enc` → binary string (one char per byte). */
    encode(text: unknown, enc: unknown): string {
      return Buffer.from(String(text), normEncoding(String(enc))).toString('latin1');
    },
    /** binary string → string in `enc`. */
    decode(bin: unknown, enc: unknown): string {
      return Buffer.from(String(bin), 'latin1').toString(normEncoding(String(enc)));
    },
  };

  const info: PluginInfo = {
    id,
    name: meta.name,
    version: meta.version,
    filePath,
    error: null,
    transformers: [],
  };

  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    // Null prototype: the contextified object lives in the host realm, so a
    // plain `{}` would expose host `Object` (and thus `Function`) through
    // `this.constructor` at the top level of the plugin script.
    const sandbox: Record<string, unknown> = Object.create(null);
    vm.createContext(sandbox, { name: `volt-plugin:${id}` });
    const install = vm.runInContext(SANDBOX_SETUP, sandbox, { timeout: DEFAULT_TIMEOUT_MS }) as (
      b: typeof bridge,
      key: string,
    ) => void;
    install(bridge, INVOKE_KEY);
    vm.runInContext(code, sandbox, { timeout: DEFAULT_TIMEOUT_MS, displayErrors: true, filename: filePath });
    info.name = meta.name;
    info.version = meta.version;
    info.transformers = [...internalRegistry.values()].map((t) => ({
      id: `${id}:${t.localId}`,
      pluginId: id,
      localId: t.localId,
      name: t.name,
      description: t.description,
      matchContentType: t.matchContentType,
    }));
    return { info, context: sandbox as vm.Context };
  } catch (e) {
    info.error = (e as Error).message ?? String(e);
    return { info, context: null };
  }
}

function normalizeResult(
  raw: unknown,
  inputContentType: string | null,
): ApplyTransformerResult {
  // The sandbox dispatcher always returns a JSON string: {body, contentType?} | {error}.
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Transformer dispatcher returned an unexpected value.' };
  }
  let parsed: { body?: unknown; contentType?: unknown; error?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { ok: false, error: 'Transformer result could not be decoded.' };
  }
  if (typeof parsed.error === 'string') return { ok: false, error: parsed.error };
  if (typeof parsed.body !== 'string') return { ok: false, error: 'Transformer returned no body.' };
  const contentType =
    typeof parsed.contentType === 'string' && parsed.contentType.length > 0
      ? parsed.contentType
      : inputContentType;
  return { ok: true, body: parsed.body, contentType };
}

function ensureDirWithReadme(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, README_CONTENTS, 'utf-8');
  }
  const example = path.join(dir, 'example.js');
  if (!fs.existsSync(example)) {
    fs.writeFileSync(example, EXAMPLE_PLUGIN, 'utf-8');
  }
}

const README_CONTENTS = `# Volt plugins

Drop \`.js\` files in this folder. Each file becomes a Volt plugin: it runs
in its own sandboxed \`vm\` context with a small \`volt.*\` API.

The plugin id is the filename without \`.js\`. Filenames starting with an
underscore are ignored, so you can keep helper files like \`_lib.js\` around.

## Available APIs

\`\`\`js
volt.plugin({ name: 'My plugin', version: '1.0.0' });

volt.transformer.register({
  id: 'pretty-base64',
  name: 'Decode base64',
  description: 'Decode a base64-encoded body as UTF-8 text.',
  matchContentType: 'application/octet-stream',
  transform(body, ctx) {
    return {
      body: Buffer.from(body, 'base64').toString('utf-8'),
      contentType: 'text/plain',
    };
  },
});

volt.log('hello from the plugin');
\`\`\`

You can also return a plain string from \`transform\` — the response keeps
the same content-type in that case. \`transform\` must be synchronous.

Available globals: the JavaScript built-ins (\`JSON\`, \`Math\`, \`Date\`, …),
\`console\`, \`atob\` / \`btoa\`, \`TextEncoder\` / \`TextDecoder\`, and a small
\`Buffer\` (\`Buffer.from(input, encoding)\`, \`.toString(encoding)\`, \`.length\`,
\`.slice\`) supporting utf8, base64, base64url, hex, latin1 and utf16le.

## What plugins can't do (yet)

- \`require\` / \`import\` (no node_modules access)
- File system, network, or process access
- Async work (\`transform\` must return synchronously)
- Register UI panels — coming in a future build

After editing a plugin file, click **Reload plugins** in the Plugins panel
(or restart Volt) to pick up changes.
`;

const EXAMPLE_PLUGIN = `// example.js — a sample Volt plugin that pretty-prints JSON responses.
// Open this folder via Settings → Plugins → Open plugins folder…

volt.plugin({ name: 'Pretty JSON', version: '0.1.0' });

volt.transformer.register({
  id: 'pretty-json',
  name: 'Pretty JSON (4-space indent)',
  description: 'Re-indents application/json bodies with 4 spaces.',
  matchContentType: 'application/json',
  transform(body) {
    try {
      const obj = JSON.parse(body);
      return { body: JSON.stringify(obj, null, 4), contentType: 'application/json' };
    } catch (e) {
      // If the body isn't valid JSON, leave it alone — returning the original
      // string keeps the same content-type.
      return body;
    }
  },
});
`;
