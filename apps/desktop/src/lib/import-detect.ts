// Heuristic detector for the import sources Volt accepts: postman, insomnia,
// openapi, har, curl. Filename is a hint; the truth is the content.

export type ImportSource = 'postman' | 'insomnia' | 'openapi' | 'har' | 'curl';

export interface Detection {
  source: ImportSource;
  label: string;
  /** A one-line explanation for the user — e.g. "Recognized by info.schema". */
  hint: string;
}

export function detectImportFormat(content: string, filename?: string): Detection | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // cURL is the only non-JSON/YAML thing we care about — sniff first.
  if (/^curl(\s|\b)/i.test(trimmed)) {
    return { source: 'curl', label: 'cURL command', hint: 'Recognized by the leading `curl` token.' };
  }

  // OpenAPI YAML — distinct because YAML can be ambiguous with text. We only
  // accept it when the top-level `openapi:` or `swagger:` line is present.
  if (isLikelyYaml(filename) && /^\s*(openapi|swagger)\s*:/im.test(trimmed)) {
    return { source: 'openapi', label: 'OpenAPI (YAML)', hint: 'Recognized by the openapi/swagger key.' };
  }

  // Everything else we expect to parse as JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Postman v2.1: { info: { schema: '…getpostman.com…' }, item: [...] }
  if (
    obj.info &&
    typeof obj.info === 'object' &&
    typeof (obj.info as { schema?: unknown }).schema === 'string' &&
    /getpostman\.com/i.test((obj.info as { schema: string }).schema)
  ) {
    return {
      source: 'postman',
      label: 'Postman Collection v2.1',
      hint: 'Recognized by info.schema.',
    };
  }

  // Insomnia v4: { _type: 'export', __export_format: 4, resources: [...] }
  if (obj._type === 'export' && Array.isArray(obj.resources)) {
    return {
      source: 'insomnia',
      label: 'Insomnia v4 export',
      hint: 'Recognized by _type: "export".',
    };
  }

  // OpenAPI JSON: { openapi: '3.x' } or { swagger: '2.0' }
  if (typeof obj.openapi === 'string' || typeof obj.swagger === 'string') {
    return {
      source: 'openapi',
      label: 'OpenAPI (JSON)',
      hint: 'Recognized by openapi/swagger field.',
    };
  }

  // HAR: { log: { entries: [...] } }
  if (
    obj.log &&
    typeof obj.log === 'object' &&
    Array.isArray((obj.log as { entries?: unknown }).entries)
  ) {
    return { source: 'har', label: 'HAR (HTTP Archive)', hint: 'Recognized by log.entries.' };
  }

  return null;
}

function isLikelyYaml(filename: string | undefined): boolean {
  if (!filename) return true; // unknown extension — still try
  const lower = filename.toLowerCase();
  return lower.endsWith('.yaml') || lower.endsWith('.yml') || !lower.endsWith('.json');
}
