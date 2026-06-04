// Curated list of HTTP request headers used for autocomplete in the headers
// editor. Includes IANA-standard headers plus widely-used non-standard ones
// (X-* family, common CORS, security, and client-hint headers).
//
// Sorted: standard first (alphabetical), then commonly-used non-standard.

export const COMMON_HTTP_HEADERS: string[] = [
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Accept-Datetime',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Language',
  'Content-Length',
  'Content-Location',
  'Content-MD5',
  'Content-Range',
  'Content-Type',
  'Cookie',
  'Date',
  'DNT',
  'Expect',
  'Expires',
  'Forwarded',
  'From',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Last-Modified',
  'Max-Forwards',
  'Origin',
  'Pragma',
  'Prefer',
  'Proxy-Authorization',
  'Range',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'Upgrade-Insecure-Requests',
  'User-Agent',
  'Via',
  'Warning',
  // Common non-standard
  'X-Api-Key',
  'X-Auth-Token',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Forwarded-Proto',
  'X-Frame-Options',
  'X-Http-Method-Override',
  'X-Requested-With',
  'X-Real-IP',
  'X-Tenant-Id',
  'X-Trace-Id',
  'X-Correlation-Id',
];

/**
 * Filter the header list by a query prefix (case-insensitive). Exact matches
 * are dropped (the user has already typed the full header — nothing to suggest).
 * Returns up to `limit` items, prefix matches ranked before substring matches.
 */
export function suggestHeaders(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_HTTP_HEADERS.slice(0, limit);
  const prefix: string[] = [];
  const substr: string[] = [];
  for (const h of COMMON_HTTP_HEADERS) {
    const lh = h.toLowerCase();
    if (lh === q) continue; // exact match — already typed
    if (lh.startsWith(q)) prefix.push(h);
    else if (lh.includes(q)) substr.push(h);
  }
  return [...prefix, ...substr].slice(0, limit);
}
