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
// Not yet supported (warnings emitted): file uploads via -F, certificate flags.

import { createRequest } from '../db/queries';
import type { ImportSummary } from './postman';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: string | null;
  basicAuth?: { username: string; password: string };
  warnings: string[];
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
    id: `h-${i}-${Math.random().toString(36).slice(2)}`,
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  // Detect content-type for body language
  const contentType = parsed.headers
    .find((h) => h.key.toLowerCase() === 'content-type')
    ?.value.toLowerCase();
  let bodyType = 'none';
  let body: unknown = { type: 'none' };
  if (parsed.body != null && parsed.body.length > 0) {
    if (contentType?.includes('json')) {
      bodyType = 'raw';
      body = { type: 'raw', language: 'json', content: parsed.body };
    } else if (contentType?.includes('xml')) {
      bodyType = 'raw';
      body = { type: 'raw', language: 'xml', content: parsed.body };
    } else if (contentType?.includes('urlencoded')) {
      bodyType = 'raw';
      body = { type: 'raw', language: 'text', content: parsed.body };
    } else {
      bodyType = 'raw';
      body = { type: 'raw', language: 'text', content: parsed.body };
    }
  }

  // Auth
  let auth: unknown = { type: 'none' };
  if (parsed.basicAuth) {
    auth = { type: 'basic', ...parsed.basicAuth };
  } else {
    const authHeader = parsed.headers.find((h) => h.key.toLowerCase() === 'authorization');
    if (authHeader?.value.startsWith('Bearer ')) {
      auth = { type: 'bearer', token: authHeader.value.slice(7) };
      // Remove from explicit headers (auth handles it)
      const idx = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
      if (idx >= 0) headers.splice(idx, 1);
    }
  }

  // Derive a name from URL pathname
  let name = 'Imported request';
  try {
    const u = new URL(parsed.url);
    name = `${parsed.method} ${u.pathname || '/'}`;
  } catch {
    /* leave default */
  }

  const created = createRequest({
    workspaceId,
    collectionId,
    name,
    method: parsed.method,
    url: parsed.url,
    headers,
    queryParams: [],
    bodyType,
    body,
    auth,
  });
  summary.requests++;
  return { success: true, summary, requestId: created!.id };
}

/**
 * Tokenize a curl command, respecting quotes and backslash line continuations.
 */
function parseCurl(commandText: string): ParsedCurl {
  // Normalize line continuations
  const normalized = commandText
    .replace(/\\\r?\n/g, ' ')  // backslash-newline → space
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = tokenize(normalized);
  if (tokens.length === 0 || tokens[0] !== 'curl') {
    throw new Error('Input does not start with `curl`.');
  }
  tokens.shift(); // remove 'curl'

  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: [],
    body: null,
    warnings: [],
  };
  let methodExplicit = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;

    if (tok === '-X' || tok === '--request') {
      result.method = (tokens[++i] ?? 'GET').toUpperCase();
      methodExplicit = true;
      continue;
    }

    if (tok === '-H' || tok === '--header') {
      const val = tokens[++i];
      if (!val) continue;
      const idx = val.indexOf(':');
      if (idx > 0) {
        result.headers.push({
          key: val.slice(0, idx).trim(),
          value: val.slice(idx + 1).trim(),
        });
      }
      continue;
    }

    if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      const val = tokens[++i];
      if (val !== undefined) result.body = (result.body ?? '') + val;
      if (!methodExplicit) result.method = 'POST';
      continue;
    }

    if (tok === '--data-urlencode') {
      const val = tokens[++i];
      if (val !== undefined) {
        // form key=value → urlencode value
        const eq = val.indexOf('=');
        if (eq > 0) {
          const k = val.slice(0, eq);
          const v = encodeURIComponent(val.slice(eq + 1));
          result.body = (result.body ?? '') + (result.body ? '&' : '') + `${k}=${v}`;
        } else {
          result.body = (result.body ?? '') + encodeURIComponent(val);
        }
      }
      if (!methodExplicit) result.method = 'POST';
      continue;
    }

    if (tok === '-u' || tok === '--user') {
      const val = tokens[++i];
      if (val) {
        const sep = val.indexOf(':');
        result.basicAuth =
          sep > 0
            ? { username: val.slice(0, sep), password: val.slice(sep + 1) }
            : { username: val, password: '' };
      }
      continue;
    }

    if (tok === '-b' || tok === '--cookie') {
      const val = tokens[++i];
      if (val !== undefined) result.headers.push({ key: 'Cookie', value: val });
      continue;
    }

    if (tok === '-A' || tok === '--user-agent') {
      const val = tokens[++i];
      if (val !== undefined) result.headers.push({ key: 'User-Agent', value: val });
      continue;
    }

    if (tok === '-F' || tok === '--form') {
      result.warnings.push('-F (multipart form) is not yet imported — convert to body manually.');
      i++; // skip value
      continue;
    }

    if (
      tok === '-k' ||
      tok === '--insecure' ||
      tok === '-L' ||
      tok === '--location' ||
      tok === '--compressed' ||
      tok === '-s' ||
      tok === '--silent' ||
      tok === '-v' ||
      tok === '--verbose'
    ) {
      // Flags without args — ignore
      continue;
    }

    if (tok.startsWith('-')) {
      result.warnings.push(`Unsupported flag ignored: ${tok}`);
      // If next token isn't a flag, it might be the flag's value — skip it
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('-')) i++;
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

  return result;
}

/**
 * Split a string into tokens, respecting single + double quotes and $'...'.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (c === ' ') {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = '';
      }
      i++;
      continue;
    }
    if (c === "'") {
      // Single-quoted string: read until next '
      i++;
      const end = input.indexOf("'", i);
      if (end === -1) {
        buf += input.slice(i);
        break;
      }
      buf += input.slice(i, end);
      i = end + 1;
      continue;
    }
    if (c === '"') {
      // Double-quoted string: read until next " (no escape handling for simplicity)
      i++;
      let end = i;
      while (end < input.length) {
        if (input[end] === '\\' && end + 1 < input.length) {
          end += 2;
          continue;
        }
        if (input[end] === '"') break;
        end++;
      }
      // Process simple escapes: \" → " ; \\ → \
      buf += input.slice(i, end).replace(/\\(["\\])/g, '$1');
      i = end + 1;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.length > 0) tokens.push(buf);
  return tokens;
}
