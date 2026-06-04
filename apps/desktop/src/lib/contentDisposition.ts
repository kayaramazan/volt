// Picks a sensible default save filename for a response body. Prefers the
// server's Content-Disposition `filename=`/`filename*=` parameter, falling
// back to `response.<ext>` derived from the content type.

const TYPE_TO_EXT: Record<string, string> = {
  'application/json': 'json',
  'application/ld+json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
};

export function filenameFromHeaders(headers: [string, string][] | undefined): string | null {
  if (!headers) return null;
  for (const [k, v] of headers) {
    if (k.toLowerCase() !== 'content-disposition') continue;
    // RFC 5987 filename*=UTF-8''…  takes precedence over plain filename=.
    const starred = /filename\*\s*=\s*([^;]+)/i.exec(v);
    if (starred?.[1]) {
      const raw = starred[1].trim();
      // Format: charset'lang'percent-encoded
      const dq = raw.split("'");
      if (dq.length === 3) {
        try {
          return decodeURIComponent(dq[2]!);
        } catch {
          // Fall through to plain.
        }
      }
    }
    const plain = /filename\s*=\s*("([^"]+)"|([^;]+))/i.exec(v);
    if (plain) {
      const name = (plain[2] ?? plain[3] ?? '').trim();
      if (name) return name;
    }
  }
  return null;
}

export function extensionForContentType(contentType: string | null | undefined): string {
  if (!contentType) return 'bin';
  const base = contentType.split(';')[0]!.trim().toLowerCase();
  return TYPE_TO_EXT[base] ?? 'bin';
}

export function suggestFilename(
  headers: [string, string][] | undefined,
  contentType: string | null | undefined,
): string {
  const fromHeader = filenameFromHeaders(headers);
  if (fromHeader) return fromHeader;
  return `response.${extensionForContentType(contentType)}`;
}
