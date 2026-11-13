// cURL command parser.
//
// Handles the common shapes that "Copy as cURL" in browser DevTools produces:
//   - method via -X or --request
//   - headers via -H or --header
//   - body via -d, --data, --data-raw, --data-binary, --data-urlencode
//   - basic auth via -u or --user
//   - cookies via -b or --cookie
//   - multi-line with backslash continuations
//
//   - multipart via -F / --form (text fields + @file uploads)
//   - $'...' ANSI-C quoting, "..." escapes, combined short flags (-sSL)
//   - -G / --get (data moves to the query string), -I / --head
//
// Not supported (warnings emitted): certificate flags, @file for -d, -K config.

import { createRequest } from '../db/queries';
import type { ImportSummary } from './postman';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  /** Pieces from -d/--data/--data-raw/--data-binary/--data-urlencode, in order. curl joins them with `&`. */
  data: string[];
  /** `--data-binary @file` — sent as-is from disk. */
  dataFile: string | null;
  /** -F / --form fields. */
  forms: Array<{ key: string; value: string; isFile: boolean }>;
  basicAuth?: { username: string; password: string };
  /** -G / --get: data goes into the query string instead of the body. */
  getMode: boolean;
  warnings: string[];
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function rowId(prefix: string, i: number) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2)}`;
}

/** Split `a=1&b=2` into decoded pairs. Tolerates malformed percent-escapes. */
function parsePairs(s: string): Array<{ key: string; value: string }> {
  const dec = (v: string) => {
    try {
      return decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      return v;
    }
  };
  return s
    .split('&')
    .filter((kv) => kv.length > 0)
    .map((kv) => {
      const eq = kv.indexOf('=');
      return eq < 0 ? { key: dec(kv), value: '' } : { key: dec(kv.slice(0, eq)), value: dec(kv.slice(eq + 1)) };
    });
}

/** Pull `?a=1&b=2` off a URL into param rows (Postman shows these in the Params table). */
function splitUrlQuery(url: string): { url: string; params: Array<{ key: string; value: string }> } {
  const q = url.indexOf('?');
  if (q < 0) return { url, params: [] };
  const hash = url.indexOf('#', q);
  const query = hash >= 0 ? url.slice(q + 1, hash) : url.slice(q + 1);
  const base = url.slice(0, q) + (hash >= 0 ? url.slice(hash) : '');
  return { url: base, params: parsePairs(query) };
}

export function importCurl(
  workspaceId: string,
  collectionId: string | null,
  commandText: string,
): { success: boolean; summary: ImportSummary; requestId?: string; error?: string } {
  const summary: ImportSummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  let parsed: ParsedCurl;
  try {
    parsed = parseCurl(commandText);
  } catch (e) {
    return { success: false, summary, error: (e as Error).message };
  }

  summary.warnings.push(...parsed.warnings);

  // Build request from parsed
  const headers = parsed.headers.map((h, i) => ({
    id: rowId('h', i),
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  // URL query string → Params table (so it's editable, like Postman does).
  const split = splitUrlQuery(parsed.url);
  const queryPairs = split.params;
  const joinedData = parsed.data.join('&');
  if (parsed.getMode && joinedData) queryPairs.push(...parsePairs(joinedData));
  const queryParams = queryPairs.map((q, i) => ({ id: rowId('q', i), key: q.key, value: q.value, enabled: true }));

  // Detect content-type for body language
  const contentType = parsed.headers
    .find((h) => h.key.toLowerCase() === 'content-type')
    ?.value.toLowerCase();
  let bodyType = 'none';
  let body: unknown = { type: 'none' };
  if (parsed.forms.length > 0) {
    bodyType = 'form';
    body = {
      type: 'form',
      fields: parsed.forms.map((f, i) => ({
        id: rowId('f', i),
        key: f.key,
        kind: f.isFile ? ('file' as const) : ('text' as const),
        value: f.value,
        enabled: true,
      })),
    };
    // curl sets the multipart boundary itself; a copied Content-Type would be stale.
    const ctIdx = headers.findIndex((h) => h.key.toLowerCase() === 'content-type');
    if (ctIdx >= 0 && contentType?.includes('multipart')) headers.splice(ctIdx, 1);
  } else if (parsed.dataFile) {
    bodyType = 'binary';
    body = { type: 'binary', filePath: parsed.dataFile };
  } else if (joinedData.length > 0 && !parsed.getMode) {
    // Without an explicit Content-Type, curl sends -d data as
    // application/x-www-form-urlencoded — mirror that when it looks like k=v pairs.
    const looksForm = !contentType && /^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(joinedData);
    if (contentType?.includes('urlencoded') || looksForm) {
      bodyType = 'urlencoded';
      body = {
        type: 'urlencoded',
        fields: parsePairs(joinedData).map((p, i) => ({ id: rowId('u', i), key: p.key, value: p.value, enabled: true })),
      };
    } else {
      const trimmed = joinedData.trim();
      const looksJson = /^[[{]/.test(trimmed) && /[\]}]$/.test(trimmed);
      const language = contentType?.includes('json')
        ? 'json'
        : contentType?.includes('xml')
          ? 'xml'
          : contentType?.includes('html')
            ? 'html'
            : contentType?.includes('javascript')
              ? 'javascript'
              : !contentType && looksJson
                ? 'json'
                : 'text';
      bodyType = 'raw';
      body = { type: 'raw', language, content: joinedData };
    }
  }

  // Auth
  let auth: unknown = { type: 'none' };
  const authIdx = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
  const authHeader = authIdx >= 0 ? headers[authIdx]!.value : '';
  if (parsed.basicAuth) {
    auth = { type: 'basic', ...parsed.basicAuth };
  } else if (/^bearer\s+/i.test(authHeader)) {
    auth = { type: 'bearer', token: authHeader.replace(/^bearer\s+/i, '') };
    headers.splice(authIdx, 1); // auth handles it
  } else if (/^basic\s+/i.test(authHeader)) {
    try {
      const decoded = Buffer.from(authHeader.replace(/^basic\s+/i, ''), 'base64').toString('utf-8');
      const sep = decoded.indexOf(':');
      // Only treat it as credentials when it decodes to printable `user:pass`.
      if (sep > 0 && !/[\u0000-\u0008\u000e-\u001f�]/.test(decoded)) {
        auth = { type: 'basic', username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
        headers.splice(authIdx, 1);
      }
    } catch {
      /* keep the raw header */
    }
  }

  // Method: explicit wins; otherwise curl's own defaults.
  let method = parsed.method;
  if (!ALLOWED_METHODS.includes(method)) {
    summary.warnings.push(`Method ${method} is not supported — imported as GET.`);
    method = 'GET';
  }

  // Derive a name from URL pathname
  let name = 'Imported request';
  try {
    const u = new URL(split.url);
    name = `${method} ${u.pathname || '/'}`;
  } catch {
    name = `${method} ${split.url}`.slice(0, 200);
  }

  const created = createRequest({
    workspaceId,
    collectionId,
    name,
    method,
    url: split.url,
    headers,
    queryParams,
    bodyType,
    body,
    auth,
  });
  summary.requests++;
  return { success: true, summary, requestId: created!.id };
}

/**
 * Walk the tokenized curl command and collect what we understand.
 */
function parseCurl(commandText: string): ParsedCurl {
  const tokens = tokenize(commandText.trim());
  // Tolerate a copied shell prompt (`$ curl …`) and Windows `curl.exe`.
  if (tokens[0] === '$') tokens.shift();
  if (tokens.length === 0 || !/^curl(\.exe)?$/i.test(tokens[0]!)) {
    throw new Error('Input does not start with `curl`.');
  }
  tokens.shift(); // remove 'curl'

  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: [],
    data: [],
    dataFile: null,
    forms: [],
    getMode: false,
    warnings: [],
  };
  let methodExplicit = false;
  let headMode = false;
  let hasBody = false;

  // Short flags that take a value and may have it glued on (-HFoo, -XPOST, -ufoo:bar).
  const SHORT_WITH_VALUE = new Set(['-X', '-H', '-d', '-F', '-u', '-b', '-A', '-o', '-e', '-x', '-m', '-T', '-c', '-w', '-D', '-r', '-U', '-E', '-K', '-z', '-C']);
  // Boolean short flags that may be combined (-sSL).
  const SHORT_BOOL = 'sSkLvifgNq#Il4j';
  const LONG_BOOL = new Set([
    '--compressed', '--insecure', '--location', '--silent', '--show-error', '--verbose', '--include',
    '--fail', '--fail-with-body', '--globoff', '--no-buffer', '--disable', '--http1.0', '--http1.1',
    '--http2', '--http2-prior-knowledge', '--http3', '--tlsv1', '--tlsv1.0', '--tlsv1.1', '--tlsv1.2',
    '--tlsv1.3', '--sslv2', '--sslv3', '--ipv4', '--ipv6', '--no-keepalive', '--no-progress-meter',
    '--progress-bar', '--junk-session-cookies', '--location-trusted', '--disable-eprt', '--tcp-nodelay',
    '--retry-all-errors', '--retry-connrefused', '--basic', '--digest', '--ntlm', '--negotiate', '--anyauth',
    '--path-as-is', '--post301', '--post302', '--post303', '--raw', '--remote-name', '--remote-header-name',
    '--styled-output', '--trace-time', '--ssl', '--ssl-reqd', '--cert-status', '--doh-insecure', '--http0.9',
  ]);
  // Long flags that take a value we ignore.
  const LONG_WITH_VALUE = new Set([
    '--output', '--referer', '--proxy', '--max-time', '--connect-timeout', '--cacert', '--capath', '--cert',
    '--cert-type', '--key', '--key-type', '--upload-file', '--retry', '--retry-delay', '--retry-max-time',
    '--cookie-jar', '--proto', '--ciphers', '--resolve', '--interface', '--max-redirs', '--write-out',
    '--dump-header', '--limit-rate', '--range', '--time-cond', '--proxy-user', '--config', '--continue-at',
    '--keepalive-time', '--local-port', '--max-filesize', '--noproxy', '--pass', '--pinnedpubkey', '--speed-limit',
    '--speed-time', '--stderr', '--trace', '--trace-ascii', '--unix-socket', '--abstract-unix-socket', '--url-query',
    '--variable', '--expand-url', '--oauth2-bearer', '--aws-sigv4', '--hsts', '--alt-svc', '--etag-save', '--etag-compare',
    '--happy-eyeballs-timeout-ms', '--output-dir', '--create-file-mode', '--dns-servers', '--doh-url', '--ech',
  ]);

  const pushHeader = (val: string | undefined) => {
    if (val === undefined) return;
    if (val.startsWith('@')) {
      result.warnings.push(`Headers from file (${val}) are not imported.`);
      return;
    }
    const idx = val.indexOf(':');
    if (idx > 0) {
      result.headers.push({ key: val.slice(0, idx).trim(), value: val.slice(idx + 1).trim() });
    } else if (val.endsWith(';')) {
      // curl's syntax for a header with an empty value: `-H 'X-Empty;'`
      result.headers.push({ key: val.slice(0, -1).trim(), value: '' });
    } else if (val.trim()) {
      result.warnings.push(`Ignored malformed header: ${val}`);
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i]!;
    let glued: string | undefined;

    // `--` ends option parsing — everything after is positional.
    if (tok === '--') {
      for (const rest of tokens.slice(i + 1)) if (!result.url) result.url = rest;
      break;
    }

    // Split glued short-option values: -XPOST → -X POST
    if (/^-[a-zA-Z]/.test(tok) && !tok.startsWith('--') && tok.length > 2) {
      const flag = tok.slice(0, 2);
      if (SHORT_WITH_VALUE.has(flag)) {
        glued = tok.slice(2);
        tok = flag;
      } else if ([...tok.slice(1)].every((c) => SHORT_BOOL.includes(c))) {
        // Combined boolean flags: -sSL
        if (tok.includes('I')) headMode = true;
        if (tok.includes('G')) result.getMode = true;
        continue;
      }
    }
    const next = (): string | undefined => (glued !== undefined ? glued : tokens[++i]);

    if (tok === '-X' || tok === '--request') {
      result.method = (next() ?? 'GET').toUpperCase();
      methodExplicit = true;
      continue;
    }
    if (tok === '--url') {
      const val = next();
      if (val !== undefined) result.url = val;
      continue;
    }
    if (tok === '-H' || tok === '--header') {
      pushHeader(next());
      continue;
    }
    if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-ascii') {
      const val = next();
      if (val !== undefined) {
        if (tok !== '--data-raw' && val.startsWith('@')) {
          result.warnings.push(`${tok} ${val}: file contents are not imported — paste the body manually.`);
        } else {
          // --data strips newlines (curl does); --data-raw keeps them.
          result.data.push(tok === '--data-raw' ? val : val.replace(/\r?\n/g, ''));
        }
      }
      hasBody = true;
      continue;
    }
    if (tok === '--data-binary') {
      const val = next();
      if (val !== undefined) {
        if (val.startsWith('@')) result.dataFile = val.slice(1);
        else result.data.push(val);
      }
      hasBody = true;
      continue;
    }
    if (tok === '--data-urlencode') {
      const val = next();
      if (val !== undefined) {
        // Forms: `content`, `=content`, `name=content`, `@file`, `name@file`
        const eq = val.indexOf('=');
        const at = val.indexOf('@');
        if (eq === 0) result.data.push(encodeURIComponent(val.slice(1)));
        else if (eq > 0) result.data.push(`${val.slice(0, eq)}=${encodeURIComponent(val.slice(eq + 1))}`);
        else if (at >= 0) result.warnings.push(`--data-urlencode ${val}: file contents are not imported.`);
        else result.data.push(encodeURIComponent(val));
      }
      hasBody = true;
      continue;
    }
    if (tok === '-F' || tok === '--form' || tok === '--form-string') {
      const val = next();
      if (val !== undefined) {
        const eq = val.indexOf('=');
        const key = eq >= 0 ? val.slice(0, eq) : val;
        let value = eq >= 0 ? val.slice(eq + 1) : '';
        let isFile = false;
        if (tok !== '--form-string' && (value.startsWith('@') || value.startsWith('<'))) {
          // `@file` uploads the file; `<file` sends its contents as text. Both need the path.
          isFile = value.startsWith('@');
          value = value.slice(1);
          // Strip curl's `;type=…` / `;filename=…` suffixes (not quoted-aware; good enough for copied commands).
          const semi = value.indexOf(';');
          if (semi >= 0) value = value.slice(0, semi);
          if (!isFile) result.warnings.push(`-F ${key}=<file: file contents are not imported — value set to the path.`);
        }
        result.forms.push({ key, value, isFile });
      }
      hasBody = true;
      continue;
    }
    if (tok === '-u' || tok === '--user') {
      const val = next();
      if (val) {
        const sep = val.indexOf(':');
        result.basicAuth =
          sep >= 0
            ? { username: val.slice(0, sep), password: val.slice(sep + 1) }
            : { username: val, password: '' };
      }
      continue;
    }
    if (tok === '-b' || tok === '--cookie') {
      const val = next();
      if (val !== undefined) {
        if (val.includes('=')) result.headers.push({ key: 'Cookie', value: val });
        else result.warnings.push(`Cookie file (${val}) is not imported.`);
      }
      continue;
    }
    if (tok === '-A' || tok === '--user-agent') {
      const val = next();
      if (val !== undefined) result.headers.push({ key: 'User-Agent', value: val });
      continue;
    }
    if (tok === '-e' || tok === '--referer') {
      const val = next();
      if (val !== undefined) result.headers.push({ key: 'Referer', value: val.replace(/;auto$/, '') });
      continue;
    }
    if (tok === '--oauth2-bearer') {
      const val = next();
      if (val !== undefined) result.headers.push({ key: 'Authorization', value: `Bearer ${val}` });
      continue;
    }
    if (tok === '-G' || tok === '--get') {
      result.getMode = true;
      continue;
    }
    if (tok === '-I' || tok === '--head') {
      headMode = true;
      continue;
    }
    if (tok === '--compressed') {
      if (!result.headers.some((h) => h.key.toLowerCase() === 'accept-encoding')) {
        result.headers.push({ key: 'Accept-Encoding', value: 'gzip, deflate, br' });
      }
      continue;
    }
    if (tok.length === 2 && tok.startsWith('-') && SHORT_BOOL.includes(tok[1]!)) continue;
    if (LONG_BOOL.has(tok)) continue;
    if (tok.startsWith('--no-')) continue;

    if (SHORT_WITH_VALUE.has(tok) || LONG_WITH_VALUE.has(tok)) {
      next(); // consume + ignore the value
      continue;
    }

    if (tok.startsWith('-') && tok.length > 1) {
      result.warnings.push(`Unsupported flag ignored: ${tok}`);
      // If next token isn't a flag, it might be the flag's value — skip it
      const peek = tokens[i + 1];
      if (glued === undefined && peek !== undefined && !peek.startsWith('-') && result.url) i++;
      continue;
    }

    // Positional → URL
    if (!result.url) {
      result.url = tok;
    } else {
      result.warnings.push(`Unexpected positional argument: ${tok}`);
    }
  }

  if (!result.url) throw new Error('No URL found in curl command.');
  // curl accepts scheme-less URLs and defaults to http.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(result.url) && !result.url.startsWith('{{')) {
    result.url = 'http://' + result.url;
  }

  if (!methodExplicit) {
    if (headMode) result.method = 'HEAD';
    else if (hasBody && !result.getMode) result.method = 'POST';
  }

  return result;
}

/**
 * Split a shell command into words. Handles '…', "…" (with \" \\ \$ \` escapes),
 * $'…' ANSI-C quoting, backslash escapes outside quotes, and backslash-newline
 * continuations (also `^`-newline from Windows cmd copies).
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let inWord = false;
  let i = 0;
  const n = input.length;

  const ansiEscape = (): string => {
    // called with input[i] === '\\' inside $'…'
    const c = input[i + 1];
    const simple: Record<string, string> = {
      n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v',
      '\\': '\\', "'": "'", '"': '"', '?': '?',
    };
    if (c === undefined) {
      i += 1;
      return '\\';
    }
    if (c in simple) {
      i += 2;
      return simple[c]!;
    }
    if (c === 'x') {
      const m = /^[0-9a-fA-F]{1,2}/.exec(input.slice(i + 2));
      if (m) {
        i += 2 + m[0].length;
        return String.fromCharCode(parseInt(m[0], 16));
      }
    }
    if (c === 'u' || c === 'U') {
      const m = new RegExp(`^[0-9a-fA-F]{1,${c === 'u' ? 4 : 8}}`).exec(input.slice(i + 2));
      if (m) {
        i += 2 + m[0].length;
        return String.fromCodePoint(parseInt(m[0], 16));
      }
    }
    if (/[0-7]/.test(c)) {
      const m = /^[0-7]{1,3}/.exec(input.slice(i + 1));
      i += 1 + m![0].length;
      return String.fromCharCode(parseInt(m![0], 8));
    }
    i += 2;
    return '\\' + c;
  };

  while (i < n) {
    const c = input[i]!;

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      if (inWord) {
        tokens.push(buf);
        buf = '';
        inWord = false;
      }
      i++;
      continue;
    }

    // Line continuation: backslash (or cmd's caret) followed by a newline.
    if ((c === '\\' || c === '^') && (input[i + 1] === '\n' || (input[i + 1] === '\r' && input[i + 2] === '\n'))) {
      i += input[i + 1] === '\r' ? 3 : 2;
      continue;
    }

    if (c === '\\') {
      // Escape outside quotes: next char literal.
      if (i + 1 < n) {
        buf += input[i + 1];
        i += 2;
      } else {
        i++;
      }
      inWord = true;
      continue;
    }

    if (c === '$' && input[i + 1] === "'") {
      // ANSI-C quoted string
      i += 2;
      while (i < n && input[i] !== "'") {
        if (input[i] === '\\') buf += ansiEscape();
        else buf += input[i++];
      }
      i++; // closing '
      inWord = true;
      continue;
    }

    if (c === "'") {
      i++;
      const end = input.indexOf("'", i);
      if (end === -1) {
        buf += input.slice(i);
        i = n;
      } else {
        buf += input.slice(i, end);
        i = end + 1;
      }
      inWord = true;
      continue;
    }

    if (c === '"' || (c === '$' && input[i + 1] === '"')) {
      i += c === '$' ? 2 : 1;
      while (i < n && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < n) {
          const nx = input[i + 1]!;
          if (nx === '\n') {
            i += 2; // continuation inside quotes
            continue;
          }
          if ('"\\$`'.includes(nx)) {
            buf += nx;
            i += 2;
            continue;
          }
          buf += '\\';
          i++;
          continue;
        }
        buf += input[i++];
      }
      i++; // closing "
      inWord = true;
      continue;
    }

    buf += c;
    inWord = true;
    i++;
  }
  if (inWord) tokens.push(buf);
  return tokens;
}
