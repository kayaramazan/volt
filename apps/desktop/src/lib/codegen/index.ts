// Code generators — translate a resolved request into a snippet in various
// languages/libraries. Pure functions, no IO. The output is meant to be a
// drop-in for the user: include the URL, method, headers, body, and (when
// applicable) the basic auth helper.
//
// Input shape mirrors the resolver's `ResolvedRequest`:
//   - url:   fully resolved (variables already substituted)
//   - headers: flat record (case-insensitive keys)
//   - body:  one of the body discriminated unions
//
// We deliberately don't import shared types here so this stays a leaf module
// renderers can use without dragging in the IPC contract layer.

export type GenBody =
  | { type: 'none' }
  | { type: 'raw'; content: string; language?: string }
  | { type: 'urlencoded'; content: string }
  | { type: 'form'; fields: Array<{ key: string; kind: 'text' | 'file'; value: string }> }
  | { type: 'binary'; filePath: string }
  | { type: 'graphql'; query: string; variables?: string; operationName?: string };

export interface GenRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: GenBody;
}

export type Language =
  | 'curl'
  | 'fetch'
  | 'node-fetch'
  | 'axios'
  | 'python'
  | 'go'
  | 'java'
  | 'php'
  | 'ruby';

export interface LanguageMeta {
  id: Language;
  label: string;
  /** CodeMirror language id for syntax highlight ('shell' | 'javascript' | 'python' | 'go' | 'java' | 'php' | 'ruby'). */
  hl: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { id: 'curl', label: 'cURL', hl: 'shell' },
  { id: 'fetch', label: 'JavaScript · fetch', hl: 'javascript' },
  { id: 'node-fetch', label: 'Node.js · fetch', hl: 'javascript' },
  { id: 'axios', label: 'JavaScript · axios', hl: 'javascript' },
  { id: 'python', label: 'Python · requests', hl: 'python' },
  { id: 'go', label: 'Go · net/http', hl: 'go' },
  { id: 'java', label: 'Java · OkHttp', hl: 'java' },
  { id: 'php', label: 'PHP · curl', hl: 'php' },
  { id: 'ruby', label: 'Ruby · Net::HTTP', hl: 'ruby' },
];

export function generate(lang: Language, input: GenRequest): string {
  const req = normalize(input);
  switch (lang) {
    case 'curl':
      return toCurl(req);
    case 'fetch':
      return toFetch(req, 'browser');
    case 'node-fetch':
      return toFetch(req, 'node');
    case 'axios':
      return toAxios(req);
    case 'python':
      return toPython(req);
    case 'go':
      return toGo(req);
    case 'java':
      return toJava(req);
    case 'php':
      return toPhp(req);
    case 'ruby':
      return toRuby(req);
  }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Fold body kinds the per-language generators don't know about into ones they
 * do: GraphQL becomes the JSON envelope the engine actually sends; anything
 * unrecognised (e.g. a gRPC body) is treated as no body.
 */
function normalize(req: GenRequest): GenRequest {
  const body = req.body as { type?: string } | null | undefined;
  if (!body || typeof body !== 'object') return { ...req, body: { type: 'none' } };
  if (body.type === 'graphql') {
    const g = req.body as Extract<GenBody, { type: 'graphql' }>;
    let variables: unknown = undefined;
    if (g.variables && g.variables.trim()) {
      try {
        variables = JSON.parse(g.variables);
      } catch {
        variables = g.variables;
      }
    }
    const envelope: Record<string, unknown> = { query: g.query };
    if (variables !== undefined) envelope.variables = variables;
    if (g.operationName) envelope.operationName = g.operationName;
    const headers = { ...req.headers };
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
    return { ...req, headers, body: { type: 'raw', language: 'json', content: JSON.stringify(envelope, null, 2) } };
  }
  if (!['none', 'raw', 'urlencoded', 'form', 'binary'].includes(body.type ?? '')) {
    return { ...req, body: { type: 'none' } };
  }
  return req;
}

function sortedHeaders(req: GenRequest): Array<[string, string]> {
  return Object.entries(req.headers).sort(([a], [b]) => a.localeCompare(b));
}

/** JSON-escape a string for embedding in a JS/JSON literal (no outer quotes). */
function jsString(s: string): string {
  return JSON.stringify(s);
}

/** Single-quote-escape a string for shell. Wraps in single quotes; safely escapes embedded single quotes. */
function shellSingle(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function rawBodyContent(req: GenRequest): string | null {
  if (req.body.type === 'raw') return req.body.content;
  if (req.body.type === 'urlencoded') return req.body.content;
  return null;
}

function isJsonBody(req: GenRequest): boolean {
  if (req.body.type !== 'raw') return false;
  const lang = req.body.language?.toLowerCase();
  if (lang === 'json') return true;
  const ct = Object.entries(req.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
  return !!ct && /json/i.test(ct);
}

// ─────────────────────────────────────────────────────────
// curl
// ─────────────────────────────────────────────────────────

function toCurl(req: GenRequest): string {
  const lines: string[] = [];
  // method is implicit on GET; emit -X otherwise so the snippet reads explicitly.
  const m = req.method.toUpperCase();
  lines.push(`curl ${shellSingle(req.url)} \\`);
  if (m !== 'GET') lines.push(`  --request ${m} \\`);
  for (const [k, v] of sortedHeaders(req)) {
    lines.push(`  --header ${shellSingle(`${k}: ${v}`)} \\`);
  }
  switch (req.body.type) {
    case 'raw':
    case 'urlencoded':
      if (req.body.type === 'raw' || req.body.type === 'urlencoded') {
        lines.push(`  --data-raw ${shellSingle(rawBodyContent(req) ?? '')} \\`);
      }
      break;
    case 'form':
      for (const f of req.body.fields) {
        if (f.kind === 'file') {
          lines.push(`  --form ${shellSingle(`${f.key}=@${f.value}`)} \\`);
        } else if (/^[@<]/.test(f.value) || f.value.includes(';')) {
          // curl would treat a leading @/< as a file and `;` as an option separator.
          lines.push(`  --form-string ${shellSingle(`${f.key}=${f.value}`)} \\`);
        } else {
          lines.push(`  --form ${shellSingle(`${f.key}=${f.value}`)} \\`);
        }
      }
      break;
    case 'binary':
      lines.push(`  --data-binary ${shellSingle(`@${req.body.filePath}`)} \\`);
      break;
    case 'none':
      break;
  }
  // Strip trailing " \" from the last line.
  return lines.join('\n').replace(/ \\$/, '');
}

// ─────────────────────────────────────────────────────────
// JavaScript fetch (browser or Node 18+)
// ─────────────────────────────────────────────────────────

function toFetch(req: GenRequest, mode: 'browser' | 'node'): string {
  const m = req.method.toUpperCase();
  const opts: string[] = [];
  opts.push(`  method: ${jsString(m)},`);
  const hdrs = sortedHeaders(req);
  if (hdrs.length) {
    const inner = hdrs.map(([k, v]) => `    ${jsString(k)}: ${jsString(v)},`).join('\n');
    opts.push(`  headers: {\n${inner}\n  },`);
  }
  const bodyExpr = fetchBodyExpr(req);
  if (bodyExpr) opts.push(`  body: ${bodyExpr},`);

  const prefix = mode === 'node' ? `// Node 18+ has fetch built in.\n` : '';
  return `${prefix}const response = await fetch(${jsString(req.url)}, {
${opts.join('\n')}
});
const data = await response.text();
console.log(response.status, data);`;
}

function fetchBodyExpr(req: GenRequest): string | null {
  switch (req.body.type) {
    case 'none':
      return null;
    case 'raw':
    case 'urlencoded':
      return jsString(rawBodyContent(req) ?? '');
    case 'form': {
      const lines = ['(() => {', '    const fd = new FormData();'];
      for (const f of req.body.fields) {
        if (f.kind === 'file') {
          lines.push(`    // ${jsString(f.key)}: file at ${jsString(f.value)} — read as Blob/File before fd.append`);
        } else {
          lines.push(`    fd.append(${jsString(f.key)}, ${jsString(f.value)});`);
        }
      }
      lines.push('    return fd;', '  })()');
      return lines.join('\n');
    }
    case 'binary':
      return `undefined /* read ${jsString(req.body.filePath)} as a Blob/Buffer and pass it here */`;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────
// axios
// ─────────────────────────────────────────────────────────

function toAxios(req: GenRequest): string {
  const m = req.method.toLowerCase();
  const lines: string[] = [];
  lines.push(`import axios from 'axios';`);
  lines.push('');
  const config: string[] = [];
  config.push(`  method: ${jsString(m)},`);
  config.push(`  url: ${jsString(req.url)},`);
  const hdrs = sortedHeaders(req);
  if (hdrs.length) {
    config.push(
      `  headers: {\n${hdrs.map(([k, v]) => `    ${jsString(k)}: ${jsString(v)},`).join('\n')}\n  },`,
    );
  }
  const body = req.body;
  if (body.type === 'raw' || body.type === 'urlencoded') {
    if (isJsonBody(req)) {
      // axios serializes JSON when given an object — prettier than passing a string.
      config.push(`  data: ${tryParseJson(rawBodyContent(req) ?? '')},`);
    } else {
      config.push(`  data: ${jsString(rawBodyContent(req) ?? '')},`);
    }
  } else if (body.type === 'form') {
    const fd = ['(() => {', '    const fd = new FormData();'];
    for (const f of body.fields) {
      if (f.kind === 'file') {
        fd.push(`    // ${jsString(f.key)}: file at ${jsString(f.value)}`);
      } else {
        fd.push(`    fd.append(${jsString(f.key)}, ${jsString(f.value)});`);
      }
    }
    fd.push('    return fd;', '  })()');
    config.push(`  data: ${fd.join('\n')},`);
  } else if (body.type === 'binary') {
    config.push(`  data: undefined /* read ${jsString(body.filePath)} as a stream/Buffer and pass it here */,`);
  }

  lines.push(`const response = await axios({`);
  lines.push(config.join('\n'));
  lines.push(`});`);
  lines.push('console.log(response.status, response.data);');
  return lines.join('\n');
}

function tryParseJson(s: string): string {
  try {
    const parsed = JSON.parse(s);
    return JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ');
  } catch {
    return jsString(s);
  }
}

// ─────────────────────────────────────────────────────────
// Python · requests
// ─────────────────────────────────────────────────────────

function toPython(req: GenRequest): string {
  const lines: string[] = [];
  lines.push('import requests');
  lines.push('');
  lines.push(`url = ${pyString(req.url)}`);
  const hdrs = sortedHeaders(req);
  if (hdrs.length) {
    const inner = hdrs.map(([k, v]) => `    ${pyString(k)}: ${pyString(v)},`).join('\n');
    lines.push(`headers = {\n${inner}\n}`);
  } else {
    lines.push('headers = {}');
  }

  const body = req.body;
  const args: string[] = [`url`, `headers=headers`];
  if (body.type === 'raw' || body.type === 'urlencoded') {
    if (isJsonBody(req)) {
      lines.push(`payload = ${pyJson(rawBodyContent(req) ?? '')}`);
      args.push('json=payload');
    } else {
      lines.push(`payload = ${pyString(rawBodyContent(req) ?? '')}`);
      args.push('data=payload');
    }
  } else if (body.type === 'form') {
    const data: string[] = [];
    const files: string[] = [];
    for (const f of body.fields) {
      if (f.kind === 'file') {
        files.push(`    ${pyString(f.key)}: open(${pyString(f.value)}, 'rb'),`);
      } else {
        data.push(`    ${pyString(f.key)}: ${pyString(f.value)},`);
      }
    }
    if (data.length) {
      lines.push(`data = {\n${data.join('\n')}\n}`);
      args.push('data=data');
    }
    if (files.length) {
      lines.push(`files = {\n${files.join('\n')}\n}`);
      args.push('files=files');
    }
  } else if (body.type === 'binary') {
    lines.push(`with open(${pyString(body.filePath)}, 'rb') as f:`);
    lines.push(`    data = f.read()`);
    args.push('data=data');
  }
  lines.push('');
  lines.push(`response = requests.${req.method.toLowerCase()}(${args.join(', ')})`);
  lines.push('print(response.status_code, response.text)');
  return lines.join('\n');
}

function pyString(s: string): string {
  return JSON.stringify(s); // double-quoted JSON-escaped is valid Python
}
function pyJson(s: string): string {
  try {
    return pyLiteral(JSON.parse(s), 0);
  } catch {
    return pyString(s);
  }
}

/** Render a JSON value as a Python literal (true/false/null → True/False/None). */
function pyLiteral(v: unknown, depth: number): string {
  const pad = '    '.repeat(depth + 1);
  const end = '    '.repeat(depth);
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return pyString(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[\n${v.map((x) => pad + pyLiteral(x, depth + 1)).join(',\n')}\n${end}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return `{\n${entries.map(([k, x]) => `${pad}${pyString(k)}: ${pyLiteral(x, depth + 1)}`).join(',\n')}\n${end}}`;
}

// ─────────────────────────────────────────────────────────
// Go · net/http
// ─────────────────────────────────────────────────────────

function toGo(req: GenRequest): string {
  const m = req.method.toUpperCase();
  const lines: string[] = [];
  lines.push('package main');
  lines.push('');
  const body = req.body;
  const useStrings = body.type === 'raw' || body.type === 'urlencoded';
  const useForm = body.type === 'form';
  const useFile = body.type === 'binary' || (useForm && body.fields.some((f) => f.kind === 'file'));
  lines.push('import (');
  if (useForm) lines.push('\t"bytes"');
  lines.push('\t"fmt"');
  lines.push('\t"io"');
  if (useForm) lines.push('\t"mime/multipart"');
  lines.push('\t"net/http"');
  if (useFile) lines.push('\t"os"');
  if (useStrings) lines.push('\t"strings"');
  lines.push(')');
  lines.push('');
  lines.push('func main() {');
  if (useStrings) {
    lines.push(`\tpayload := strings.NewReader(${goString(rawBodyContent(req) ?? '')})`);
    lines.push(`\treq, _ := http.NewRequest("${m}", ${goString(req.url)}, payload)`);
  } else if (body.type === 'form') {
    lines.push('\tvar buf bytes.Buffer');
    lines.push('\tmw := multipart.NewWriter(&buf)');
    for (const f of body.fields) {
      if (f.kind === 'file') {
        lines.push(`\tif file, err := os.Open(${goString(f.value)}); err == nil {`);
        lines.push(`\t\tpart, _ := mw.CreateFormFile(${goString(f.key)}, ${goString(f.value.split(/[\\/]/).pop() ?? f.value)})`);
        lines.push('\t\tio.Copy(part, file)');
        lines.push('\t\tfile.Close()');
        lines.push('\t}');
      } else {
        lines.push(`\tmw.WriteField(${goString(f.key)}, ${goString(f.value)})`);
      }
    }
    lines.push('\tmw.Close()');
    lines.push(`\treq, _ := http.NewRequest("${m}", ${goString(req.url)}, &buf)`);
    lines.push('\treq.Header.Set("Content-Type", mw.FormDataContentType())');
  } else if (body.type === 'binary') {
    lines.push(`\tfile, err := os.Open(${goString(body.filePath)})`);
    lines.push('\tif err != nil {');
    lines.push('\t\tfmt.Println(err)');
    lines.push('\t\treturn');
    lines.push('\t}');
    lines.push('\tdefer file.Close()');
    lines.push(`\treq, _ := http.NewRequest("${m}", ${goString(req.url)}, file)`);
  } else {
    lines.push(`\treq, _ := http.NewRequest("${m}", ${goString(req.url)}, nil)`);
  }
  for (const [k, v] of sortedHeaders(req)) {
    if (useForm && k.toLowerCase() === 'content-type') continue; // multipart boundary is set above
    lines.push(`\treq.Header.Set(${goString(k)}, ${goString(v)})`);
  }
  lines.push('\tres, err := http.DefaultClient.Do(req)');
  lines.push('\tif err != nil {');
  lines.push('\t\tfmt.Println(err)');
  lines.push('\t\treturn');
  lines.push('\t}');
  lines.push('\tdefer res.Body.Close()');
  lines.push('\tbody, _ := io.ReadAll(res.Body)');
  lines.push('\tfmt.Println(res.StatusCode, string(body))');
  lines.push('}');
  return lines.join('\n');
}

function goString(s: string): string {
  // Use Go raw string when no backtick is present for cleaner output.
  if (!s.includes('`')) return '`' + s + '`';
  return JSON.stringify(s);
}

// ─────────────────────────────────────────────────────────
// Java · OkHttp
// ─────────────────────────────────────────────────────────

function toJava(req: GenRequest): string {
  const m = req.method.toUpperCase();
  const lines: string[] = [];
  lines.push('import okhttp3.*;');
  lines.push('');
  lines.push('OkHttpClient client = new OkHttpClient();');
  lines.push('');
  const body = req.body;
  let bodyExpr = 'null';
  if (body.type === 'raw' || body.type === 'urlencoded') {
    const ct =
      Object.entries(req.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ??
      (body.type === 'urlencoded' ? 'application/x-www-form-urlencoded' : 'text/plain');
    lines.push(`MediaType MEDIA = MediaType.parse(${jsString(ct)});`);
    lines.push(`RequestBody body = RequestBody.create(${jsString(rawBodyContent(req) ?? '')}, MEDIA);`);
    bodyExpr = 'body';
  } else if (body.type === 'form') {
    lines.push('MultipartBody.Builder mb = new MultipartBody.Builder().setType(MultipartBody.FORM);');
    for (const f of body.fields) {
      if (f.kind === 'file') {
        lines.push(
          `mb.addFormDataPart(${jsString(f.key)}, ${jsString(f.value)}, RequestBody.create(new java.io.File(${jsString(f.value)}), MediaType.parse("application/octet-stream")));`,
        );
      } else {
        lines.push(`mb.addFormDataPart(${jsString(f.key)}, ${jsString(f.value)});`);
      }
    }
    lines.push('RequestBody body = mb.build();');
    bodyExpr = 'body';
  } else if (body.type === 'binary') {
    lines.push(`RequestBody body = RequestBody.create(new java.io.File(${jsString(body.filePath)}), MediaType.parse("application/octet-stream"));`);
    bodyExpr = 'body';
  }
  // OkHttp rejects a null body on POST/PUT/PATCH ("method X must have a request body").
  if (bodyExpr === 'null' && (m === 'POST' || m === 'PUT' || m === 'PATCH')) {
    lines.push('RequestBody body = RequestBody.create(new byte[0], null);');
    bodyExpr = 'body';
  }
  lines.push('Request.Builder rb = new Request.Builder()');
  lines.push(`  .url(${jsString(req.url)})`);
  // OkHttp's .method() handles all verbs uniformly when given a body (null for GET/HEAD)
  lines.push(`  .method(${jsString(m)}, ${bodyExpr})`);
  for (const [k, v] of sortedHeaders(req)) {
    lines.push(`  .addHeader(${jsString(k)}, ${jsString(v)})`);
  }
  lines.push('  ;');
  lines.push('Response response = client.newCall(rb.build()).execute();');
  lines.push('System.out.println(response.code() + " " + response.body().string());');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// PHP · curl
// ─────────────────────────────────────────────────────────

function toPhp(req: GenRequest): string {
  const lines: string[] = ['<?php', ''];
  lines.push('$ch = curl_init();');
  lines.push('curl_setopt_array($ch, [');
  lines.push(`  CURLOPT_URL => ${phpString(req.url)},`);
  lines.push(`  CURLOPT_CUSTOMREQUEST => ${phpString(req.method.toUpperCase())},`);
  lines.push('  CURLOPT_RETURNTRANSFER => true,');
  const hdrs = sortedHeaders(req);
  if (hdrs.length) {
    const inner = hdrs.map(([k, v]) => `    ${phpString(`${k}: ${v}`)},`).join('\n');
    lines.push(`  CURLOPT_HTTPHEADER => [\n${inner}\n  ],`);
  }
  const body = req.body;
  if (body.type === 'raw' || body.type === 'urlencoded') {
    lines.push(`  CURLOPT_POSTFIELDS => ${phpString(rawBodyContent(req) ?? '')},`);
  } else if (body.type === 'form') {
    const inner = body.fields
      .map((f) =>
        f.kind === 'file'
          ? `    ${phpString(f.key)} => new CURLFile(${phpString(f.value)}),`
          : `    ${phpString(f.key)} => ${phpString(f.value)},`,
      )
      .join('\n');
    lines.push(`  CURLOPT_POSTFIELDS => [\n${inner}\n  ],`);
  } else if (body.type === 'binary') {
    lines.push(`  CURLOPT_POSTFIELDS => file_get_contents(${phpString(body.filePath)}),`);
  }
  lines.push(']);');
  lines.push('$response = curl_exec($ch);');
  lines.push('$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);');
  lines.push('curl_close($ch);');
  lines.push('echo $status . "\\n" . $response;');
  return lines.join('\n');
}

function phpString(s: string): string {
  // Use single-quoted PHP strings; escape `\` and `'`.
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// ─────────────────────────────────────────────────────────
// Ruby · Net::HTTP
// ─────────────────────────────────────────────────────────

function toRuby(req: GenRequest): string {
  const m = req.method.toUpperCase();
  const lines: string[] = [];
  lines.push("require 'net/http'");
  lines.push("require 'uri'");
  lines.push('');
  lines.push(`url = URI(${rubyString(req.url)})`);
  lines.push('http = Net::HTTP.new(url.host, url.port)');
  lines.push("http.use_ssl = url.scheme == 'https'");
  lines.push('');
  const klassMap: Record<string, string> = {
    GET: 'Get',
    POST: 'Post',
    PUT: 'Put',
    PATCH: 'Patch',
    DELETE: 'Delete',
    HEAD: 'Head',
    OPTIONS: 'Options',
  };
  const klass = klassMap[m] ?? 'Get';
  lines.push(`request = Net::HTTP::${klass}.new(url)`);
  for (const [k, v] of sortedHeaders(req)) {
    lines.push(`request[${rubyString(k)}] = ${rubyString(v)}`);
  }
  const body = req.body;
  if (body.type === 'raw' || body.type === 'urlencoded') {
    lines.push(`request.body = ${rubyString(rawBodyContent(req) ?? '')}`);
  } else if (body.type === 'form') {
    const inner = body.fields
      .map((f) =>
        f.kind === 'file'
          ? `  [${rubyString(f.key)}, File.open(${rubyString(f.value)}, 'rb')]`
          : `  [${rubyString(f.key)}, ${rubyString(f.value)}]`,
      )
      .join(',\n');
    lines.push(`request.set_form([\n${inner}\n], 'multipart/form-data')`);
  } else if (body.type === 'binary') {
    lines.push(`request.body = File.binread(${rubyString(body.filePath)})`);
  }
  lines.push('');
  lines.push('response = http.request(request)');
  lines.push('puts response.code, response.body');
  return lines.join('\n');
}

function rubyString(s: string): string {
  // Double-quoted JSON-escaped is valid Ruby, except `#{…}` interpolates — escape the `#`.
  return JSON.stringify(s).replace(/#(?=[{$@])/g, '\\#');
}
