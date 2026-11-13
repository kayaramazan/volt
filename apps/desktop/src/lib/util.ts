// Common utilities shared across the renderer.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware className merger. Resolves conflicts so the last
 * conflicting class wins: cn("p-4", "p-2") === "p-2".
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a HTTP status code with class for color: 2xx green, 3xx blue,
 * 4xx orange, 5xx red.
 */
export function statusColorClass(status: number | null | undefined): string {
  if (status == null) return 'text-text-muted';
  if (status >= 200 && status < 300) return 'text-success';
  if (status >= 300 && status < 400) return 'text-sky-400';
  if (status >= 400 && status < 500) return 'text-warning';
  if (status >= 500) return 'text-error';
  return 'text-text-muted';
}

/**
 * Color a HTTP method with method-appropriate class.
 */
export function methodColorClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-success';
    case 'POST':
      return 'text-warning';
    case 'PUT':
      return 'text-sky-400';
    case 'PATCH':
      return 'text-purple-400';
    case 'DELETE':
      return 'text-error';
    case 'HEAD':
    case 'OPTIONS':
      return 'text-text-muted';
    default:
      return 'text-text';
  }
}

/**
 * Format bytes as a human-readable string (1.2 MB, 845 KB).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Format a duration in ms as a human string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format a timestamp as "HH:MM:SS" for today, "MMM DD HH:MM" otherwise.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate a stable client-side ID for ephemeral row entries before sync.
 * Backend will produce its own UUID; we just need uniqueness in-session.
 */
export function rowId(prefix = 'row'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Debounce — used heavily in the URL bar / search inputs.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Decode a base64 string to a string for display. For binary content,
 * we'll show a placeholder instead.
 */
export function tryDecodeBase64(
  base64: string | null,
  contentType: string | null,
): { text: string | null; isBinary: boolean } {
  if (!base64) return { text: null, isBinary: false };
  const mime = mimeOf(contentType);
  if (mime && isBinaryContentType(mime)) {
    return { text: null, isBinary: true };
  }
  let bytes: Uint8Array;
  try {
    // atob is available in Electron renderer. It yields a Latin-1 "binary
    // string" — one char per byte — so we must NOT display it directly or
    // every non-ASCII UTF-8 body renders as mojibake.
    const bin = atob(base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return { text: null, isBinary: true };
  }
  const knownText = Boolean(mime && isTextContentType(mime));
  // Unknown / missing content-type: sniff. A NUL byte early on is a reliable
  // "this is not text" signal (UTF-8 text never contains one).
  if (!knownText) {
    const probe = bytes.subarray(0, 1024);
    for (let i = 0; i < probe.length; i++) {
      if (probe[i] === 0) return { text: null, isBinary: true };
    }
  }
  return { text: decodeBytes(bytes, charsetOf(contentType)), isBinary: false };
}

/** `text/html; charset=utf-8` → `text/html` (lowercased), or null. */
export function mimeOf(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  const base = contentType.split(';')[0]!.trim().toLowerCase();
  return base || null;
}

/** charset parameter from a Content-Type header, or null. */
export function charsetOf(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  const m = /;\s*charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType);
  return m?.[1]?.toLowerCase() ?? null;
}

function decodeBytes(bytes: Uint8Array, charset: string | null): string {
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // Unknown label — fall back to UTF-8 below.
    }
  }
  // Non-fatal so a stray invalid sequence shows as U+FFFD, not an error.
  return new TextDecoder('utf-8').decode(bytes);
}

function isTextContentType(mime: string): boolean {
  return (
    mime.startsWith('text/') ||
    mime.startsWith('message/') ||
    mime.endsWith('+json') ||
    mime.endsWith('+xml') ||
    mime.includes('json') ||
    // Not a bare includes('xml'): "application/vnd.openxmlformats-…" is an xlsx.
    mime === 'application/xml' ||
    mime === 'application/xml-dtd' ||
    mime === 'application/xslt+xml' ||
    mime.includes('javascript') ||
    mime.includes('ecmascript') ||
    mime.includes('html') ||
    mime.includes('css') ||
    mime.includes('yaml') ||
    mime.includes('toml') ||
    mime === 'application/x-www-form-urlencoded' ||
    mime === 'application/graphql' ||
    mime === 'application/sql' ||
    mime === 'application/x-sh' ||
    mime === 'application/x-httpd-php' ||
    mime === 'application/x-ndjson' ||
    mime === 'application/jwt'
  );
}

function isBinaryContentType(mime: string): boolean {
  if (isTextContentType(mime)) return false;
  return (
    mime.startsWith('image/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    mime.startsWith('font/') ||
    mime.startsWith('multipart/') ||
    mime === 'application/octet-stream' ||
    mime === 'application/pdf' ||
    mime === 'application/zip' ||
    mime === 'application/gzip' ||
    mime === 'application/x-tar' ||
    mime === 'application/wasm' ||
    mime === 'application/x-protobuf' ||
    mime === 'application/protobuf' ||
    mime === 'application/msgpack' ||
    mime === 'application/x-msgpack' ||
    mime.startsWith('application/vnd.')
  );
}

/**
 * Pretty-print JSON without round-tripping through JSON.parse/stringify, so
 * big integers (snowflake ids, 64-bit counters) and number formatting
 * survive exactly as the server sent them. Returns null if the text isn't
 * valid JSON (caller shows the raw body instead).
 */
export function prettyPrintJson(text: string, indent = 2): string | null {
  try {
    JSON.parse(text);
  } catch {
    return null;
  }
  const pad = ' '.repeat(indent);
  let out = '';
  let depth = 0;
  let inString = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i]!;
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    switch (ch) {
      case '"':
        inString = true;
        out += ch;
        break;
      case '{':
      case '[': {
        // Peek past whitespace for an immediately-closing bracket → `{}` / `[]`.
        let j = i + 1;
        while (j < n && /\s/.test(text[j]!)) j++;
        const closer = ch === '{' ? '}' : ']';
        if (text[j] === closer) {
          out += ch + closer;
          i = j;
        } else {
          depth++;
          out += ch + '\n' + pad.repeat(depth);
        }
        break;
      }
      case '}':
      case ']':
        depth = Math.max(0, depth - 1);
        out += '\n' + pad.repeat(depth) + ch;
        break;
      case ',':
        out += ',\n' + pad.repeat(depth);
        break;
      case ':':
        out += ': ';
        break;
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/**
 * Lightweight XML / SVG pretty-printer. Keeps `<a>text</a>` on one line,
 * passes comments / CDATA / declarations through untouched. Not a validator —
 * malformed markup is re-indented best-effort rather than rejected.
 */
export function prettyPrintXml(xml: string, indent = 2): string {
  const tokens = xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g);
  if (!tokens) return xml;
  type Line = { kind: 'open' | 'close' | 'self' | 'text' | 'merged'; s: string; depth: number };
  const lines: Line[] = [];
  let depth = 0;
  for (const raw of tokens) {
    let kind: Line['kind'];
    let s = raw;
    if (raw.startsWith('</')) kind = 'close';
    else if (raw.startsWith('<?') || raw.startsWith('<!')) kind = 'self';
    else if (raw.startsWith('<')) kind = /\/\s*>$/.test(raw) ? 'self' : 'open';
    else {
      s = raw.trim();
      if (!s) continue;
      kind = 'text';
    }
    if (kind === 'close') {
      depth = Math.max(0, depth - 1);
      const last = lines[lines.length - 1];
      const prev = lines[lines.length - 2];
      if (last && last.kind === 'open' && last.depth === depth) {
        last.kind = 'merged';
        last.s += s;
        continue;
      }
      if (last && last.kind === 'text' && prev && prev.kind === 'open' && prev.depth === depth) {
        lines.pop();
        prev.kind = 'merged';
        prev.s += last.s + s;
        continue;
      }
      lines.push({ kind, s, depth });
      continue;
    }
    lines.push({ kind, s, depth });
    if (kind === 'open') depth++;
  }
  const pad = ' '.repeat(indent);
  return lines.map((l) => pad.repeat(l.depth) + l.s).join('\n');
}
