// Export a Volt collection (or whole workspace) to a Markdown document.
//
// The output is a single self-contained .md file — useful for sharing with
// teammates, sticking in a repo, or feeding into a static-site generator.
//
// Structure:
//   # <Root collection / workspace name>
//   <description, if any>
//
//   ## Variables  (if root has any)
//   | key | value |
//
//   ## <Subcollection name>
//   <subcollection description>
//
//   ### `METHOD` /path  — Request name
//   <request description>
//
//   **URL**
//   `https://api.example.com/...`
//
//   **Headers**
//   | key | value |
//
//   **Body** (only if body type != 'none')
//   ```language
//   ...
//   ```
//
//   **Examples** (only if request has saved examples)
//   #### Example name
//   <code block with response body>

import {
  listCollections,
  listRequests,
} from '../db/queries';

interface CollectionRow {
  id: string;
  parentId: string | null;
  name: string;
  description?: string;
  variables?: Array<{ key: string; value: string }>;
  sortOrder?: number;
}

interface RequestRow {
  id: string;
  collectionId: string | null;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled?: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled?: boolean }>;
  bodyType: string;
  body: Record<string, unknown>;
  auth: Record<string, unknown>;
  description?: string;
  examples?: Array<{
    id: string;
    name: string;
    request?: Record<string, unknown>;
    response?: Record<string, unknown> | null;
  }>;
  sortOrder?: number;
}

export function exportDocs(
  workspaceId: string,
  rootCollectionId: string | null,
): { content: string; filename: string } {
  const collections = listCollections(workspaceId) as unknown as CollectionRow[];
  const requests = listRequests(workspaceId) as unknown as RequestRow[];

  const included = rootCollectionId
    ? collectDescendants(rootCollectionId, collections)
    : null;
  const filteredCollections = included
    ? collections.filter((c) => included.has(c.id))
    : collections;
  const filteredRequests = included
    ? requests.filter((r) => r.collectionId && included.has(r.collectionId))
    : requests;

  const rootRow = rootCollectionId
    ? collections.find((c) => c.id === rootCollectionId)
    : null;
  const rootName = rootRow?.name ?? 'Volt Export';
  const rootDescription = rootRow?.description ?? '';
  const rootVariables = rootRow?.variables ?? [];

  const requestsIn = (collectionId: string | null): RequestRow[] => {
    return filteredRequests
      .filter((r) => (r.collectionId ?? null) === collectionId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  };
  const childrenOf = (parentId: string | null): CollectionRow[] => {
    return filteredCollections
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  };

  const lines: string[] = [];
  lines.push(`# ${rootName}`);
  lines.push('');
  if (rootDescription) {
    lines.push(rootDescription);
    lines.push('');
  }
  if (rootVariables.length) {
    lines.push('## Variables');
    lines.push('');
    lines.push(...variableTable(rootVariables));
    lines.push('');
  }

  // Render the root's direct requests, then recurse into sub-collections.
  // If we're exporting a specific root, requestsIn(rootRow.id) handles those.
  const rootScopeId = rootRow?.id ?? null;
  const rootScopeRequests = requestsIn(rootScopeId);
  if (rootScopeRequests.length) {
    lines.push('## Requests');
    lines.push('');
    for (const req of rootScopeRequests) {
      lines.push(...renderRequest(req, 3));
    }
  }

  for (const child of childrenOf(rootScopeId)) {
    renderCollection(child, 2, lines, childrenOf, requestsIn);
  }

  const safeName = rootName.replace(/[^a-z0-9-_]+/gi, '_');
  return {
    content: lines.join('\n'),
    filename: `${safeName}.md`,
  };
}

function renderCollection(
  coll: CollectionRow,
  depth: number,
  lines: string[],
  childrenOf: (parentId: string | null) => CollectionRow[],
  requestsIn: (collectionId: string | null) => RequestRow[],
) {
  const heading = '#'.repeat(Math.min(depth, 6));
  lines.push(`${heading} ${coll.name}`);
  lines.push('');
  if (coll.description) {
    lines.push(coll.description);
    lines.push('');
  }
  if (coll.variables?.length) {
    lines.push(...variableTable(coll.variables));
    lines.push('');
  }
  for (const req of requestsIn(coll.id)) {
    lines.push(...renderRequest(req, depth + 1));
  }
  for (const child of childrenOf(coll.id)) {
    renderCollection(child, depth + 1, lines, childrenOf, requestsIn);
  }
}

function renderRequest(req: RequestRow, depth: number): string[] {
  const heading = '#'.repeat(Math.min(depth, 6));
  const lines: string[] = [];
  lines.push(`${heading} \`${req.method.toUpperCase()}\` ${escapeMd(req.name)}`);
  lines.push('');
  if (req.description) {
    lines.push(req.description);
    lines.push('');
  }
  lines.push('**URL**');
  lines.push('');
  lines.push('```');
  lines.push(req.url);
  lines.push('```');
  lines.push('');

  const headers = (req.headers ?? []).filter((h) => h.enabled !== false && h.key);
  if (headers.length) {
    lines.push('**Headers**');
    lines.push('');
    lines.push('| Header | Value |');
    lines.push('| --- | --- |');
    for (const h of headers) {
      lines.push(`| ${escapeCell(h.key)} | ${escapeCell(h.value)} |`);
    }
    lines.push('');
  }

  const queryParams = (req.queryParams ?? []).filter((q) => q.enabled !== false && q.key);
  if (queryParams.length) {
    lines.push('**Query parameters**');
    lines.push('');
    lines.push('| Key | Value |');
    lines.push('| --- | --- |');
    for (const q of queryParams) {
      lines.push(`| ${escapeCell(q.key)} | ${escapeCell(q.value)} |`);
    }
    lines.push('');
  }

  if (req.bodyType !== 'none') {
    lines.push('**Body**');
    lines.push('');
    lines.push(...bodyBlock(req));
    lines.push('');
  }

  if (req.examples?.length) {
    lines.push('**Examples**');
    lines.push('');
    for (const ex of req.examples) {
      const exHeading = '#'.repeat(Math.min(depth + 1, 6));
      lines.push(`${exHeading} ${escapeMd(ex.name)}`);
      lines.push('');
      const resp = ex.response;
      if (resp && (resp as { ok?: boolean }).ok === true) {
        const status = (resp as { statusCode?: number }).statusCode;
        const ms = (resp as { durationMs?: number }).durationMs;
        const size = (resp as { bodySizeBytes?: number }).bodySizeBytes;
        const ct = (resp as { contentType?: string | null }).contentType;
        const text = (resp as { bodyText?: string | null }).bodyText;
        lines.push(
          `*Status:* \`${status ?? '?'}\` · *Duration:* ${ms ?? 0}ms · *Size:* ${size ?? 0} bytes`,
        );
        lines.push('');
        if (text) {
          lines.push('```' + fenceLangFromMime(ct ?? ''));
          lines.push(text);
          lines.push('```');
          lines.push('');
        }
      } else if (resp) {
        const code = (resp as { errorCode?: string }).errorCode;
        const message = (resp as { errorMessage?: string }).errorMessage;
        lines.push(`*Error:* \`${code ?? 'failed'}\` ${message ? '— ' + message : ''}`);
        lines.push('');
      } else {
        lines.push('*(No response captured.)*');
        lines.push('');
      }
    }
  }
  return lines;
}

function bodyBlock(req: RequestRow): string[] {
  const b = req.body ?? {};
  switch (req.bodyType) {
    case 'raw': {
      const lang = (b.language as string | undefined) ?? '';
      const fence = '```' + lang;
      return [fence, (b.content as string) ?? '', '```'];
    }
    case 'urlencoded': {
      const fields = b.fields as Array<{ key: string; value: string; enabled?: boolean }> | undefined;
      if (!fields) return ['```', (b.content as string) ?? '', '```'];
      const out: string[] = ['| Field | Value |', '| --- | --- |'];
      for (const f of fields) {
        if (f.enabled === false) continue;
        out.push(`| ${escapeCell(f.key)} | ${escapeCell(f.value)} |`);
      }
      return out;
    }
    case 'graphql': {
      const out = ['```graphql', (b.query as string) ?? '', '```'];
      const vars = (b.variables as string | undefined)?.trim();
      if (vars) out.push('', '**Variables**', '', '```json', vars, '```');
      return out;
    }
    case 'form': {
      const fields =
        (b.fields as Array<{ key: string; kind: 'text' | 'file'; value: string }> | undefined) ??
        [];
      const out: string[] = ['| Field | Type | Value |', '| --- | --- | --- |'];
      for (const f of fields) {
        out.push(`| ${escapeCell(f.key)} | ${f.kind} | ${escapeCell(f.value)} |`);
      }
      return out;
    }
    case 'binary':
      return ['```', `Binary file: ${(b.filePath as string) ?? ''}`, '```'];
    default:
      return [];
  }
}

function variableTable(vars: Array<{ key: string; value: string }>): string[] {
  if (!vars.length) return [];
  const lines = ['| Variable | Value |', '| --- | --- |'];
  for (const v of vars) {
    lines.push(`| \`${escapeCell(v.key)}\` | ${escapeCell(v.value)} |`);
  }
  return lines;
}

function fenceLangFromMime(mime: string): string {
  if (/json/i.test(mime)) return 'json';
  if (/xml/i.test(mime)) return 'xml';
  if (/html/i.test(mime)) return 'html';
  if (/javascript|ecmascript/i.test(mime)) return 'javascript';
  return '';
}

function escapeMd(s: string): string {
  return s.replace(/([\\`*_{}[\]()#+\-!|])/g, '\\$1');
}
function escapeCell(s: string): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function collectDescendants(rootId: string, all: CollectionRow[]): Set<string> {
  const out = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        added = true;
      }
    }
  }
  return out;
}
