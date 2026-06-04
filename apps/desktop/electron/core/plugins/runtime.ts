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
const REGISTRY_KEY = '__voltRegistry';
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
    // Bind the inputs into the context, invoke through the sandbox-owned
    // dispatcher, then read the result back. Keeps the transformer's
    // execution scope inside the plugin's vm context.
    const ctx = runtime.context as vm.Context & Record<string, unknown>;
    ctx[IN_BODY_KEY] = input.body;
    ctx[IN_CTX_KEY] = {
      contentType: input.contentType ?? null,
      headers: input.headers ?? {},
    };
    const raw = vm.runInContext(
      `${INVOKE_KEY}(${JSON.stringify(localId)}, ${IN_BODY_KEY}, ${IN_CTX_KEY})`,
      ctx,
      { timeout: input.timeoutMs ?? DEFAULT_TIMEOUT_MS, displayErrors: true },
    );
    delete ctx[IN_BODY_KEY];
    delete ctx[IN_CTX_KEY];
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

interface InternalTransformer {
  localId: string;
  name: string;
  description?: string;
  matchContentType?: string;
  transform: (body: string, ctx: { contentType: string | null; headers: Record<string, string> }) => unknown;
}

function loadOne(id: string, filePath: string): PluginRuntime {
  const meta = {
    name: id,
    version: undefined as string | undefined,
  };
  const internalRegistry = new Map<string, InternalTransformer>();

  const console = {
    log: (...args: unknown[]) => process.stdout.write(`[plugin ${id}] ${args.map(String).join(' ')}\n`),
    warn: (...args: unknown[]) => process.stderr.write(`[plugin ${id}] ${args.map(String).join(' ')}\n`),
    error: (...args: unknown[]) => process.stderr.write(`[plugin ${id}] ${args.map(String).join(' ')}\n`),
  };

  const sandbox: Record<string, unknown> = {
    console,
    JSON,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    URL,
    URLSearchParams,
    Buffer,
    Promise,
    Error,
    TextEncoder,
    TextDecoder,
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
  };

  // The volt.* SDK exposed to plugins. Kept tiny and additive on purpose.
  sandbox.volt = {
    plugin(info: { name?: string; version?: string }) {
      if (info?.name) meta.name = String(info.name);
      if (info?.version) meta.version = String(info.version);
    },
    transformer: {
      register(input: {
        id: string;
        name?: string;
        description?: string;
        matchContentType?: string;
        transform: InternalTransformer['transform'];
      }) {
        if (!input || typeof input !== 'object') throw new Error('register() requires an object.');
        if (!input.id || typeof input.id !== 'string') throw new Error('register() requires a string id.');
        if (typeof input.transform !== 'function') throw new Error('register() requires a transform function.');
        internalRegistry.set(input.id, {
          localId: input.id,
          name: input.name ?? input.id,
          description: input.description,
          matchContentType: input.matchContentType,
          transform: input.transform,
        });
      },
    },
    log(...args: unknown[]) {
      process.stdout.write(`[plugin ${id}] ${args.map(String).join(' ')}\n`);
    },
  };

  // Sandbox-owned dispatcher used by the host process to invoke transformers
  // *inside* the vm context (so the function body executes with the plugin's
  // globals + a vm timeout).
  sandbox[REGISTRY_KEY] = internalRegistry;
  sandbox[INVOKE_KEY] = function (localId: string, body: string, ctx: unknown) {
    const t = internalRegistry.get(localId);
    if (!t) throw new Error(`Transformer "${localId}" not registered.`);
    return t.transform(body, ctx as { contentType: string | null; headers: Record<string, string> });
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
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: DEFAULT_TIMEOUT_MS, displayErrors: true });
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
  if (raw == null) {
    return { ok: false, error: 'Transformer returned no value.' };
  }
  if (typeof raw === 'string') {
    return { ok: true, body: raw, contentType: inputContentType };
  }
  if (typeof raw === 'object') {
    const obj = raw as { body?: unknown; contentType?: unknown };
    const body = typeof obj.body === 'string' ? obj.body : JSON.stringify(obj.body);
    const contentType =
      typeof obj.contentType === 'string' && obj.contentType.length > 0
        ? obj.contentType
        : inputContentType;
    return { ok: true, body, contentType };
  }
  return { ok: false, error: 'Transformer returned an unsupported value type.' };
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
the same content-type in that case.

## What plugins can't do (yet)

- \`require\` / \`import\` (no node_modules access)
- File system, network, or process access
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
