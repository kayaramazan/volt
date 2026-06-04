// Parses Set-Cookie response headers into structured rows for the
// response viewer's Cookies tab. Manual parser — no npm dep. The format is
// RFC 6265-ish; we tolerate variations real servers emit (lowercase attr
// names, missing quotes around Expires, etc.).

export type SameSite = 'Strict' | 'Lax' | 'None';

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  /** Raw value of the Expires attribute (rendered as-is). */
  expires?: string;
  maxAge?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: SameSite;
}

export function parseCookies(headers: [string, string][] | undefined): ParsedCookie[] {
  if (!headers) return [];
  const out: ParsedCookie[] = [];
  for (const [k, v] of headers) {
    if (k.toLowerCase() !== 'set-cookie') continue;
    const parsed = parseOne(v);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseOne(raw: string): ParsedCookie | null {
  const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const head = parts[0]!;
  const eq = head.indexOf('=');
  if (eq < 0) return null;
  const name = head.slice(0, eq).trim();
  const value = head.slice(eq + 1).trim();
  if (!name) return null;

  const cookie: ParsedCookie = { name, value, httpOnly: false, secure: false };
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i]!;
    const sep = seg.indexOf('=');
    const attr = (sep < 0 ? seg : seg.slice(0, sep)).trim().toLowerCase();
    const attrVal = sep < 0 ? '' : seg.slice(sep + 1).trim();
    switch (attr) {
      case 'domain':
        cookie.domain = attrVal;
        break;
      case 'path':
        cookie.path = attrVal;
        break;
      case 'expires':
        cookie.expires = attrVal;
        break;
      case 'max-age': {
        const n = Number(attrVal);
        if (Number.isFinite(n)) cookie.maxAge = n;
        break;
      }
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'samesite': {
        const s = attrVal.toLowerCase();
        if (s === 'strict') cookie.sameSite = 'Strict';
        else if (s === 'lax') cookie.sameSite = 'Lax';
        else if (s === 'none') cookie.sameSite = 'None';
        break;
      }
      default:
        break;
    }
  }
  return cookie;
}
