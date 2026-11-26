// Shared import dispatch used by the import:source IPC channel and the local
// MCP server. Reads the file (if given), picks the importer for `source`, and
// maps importer failures to a friendly `{ success: false, errorMessage }`.

import fs from 'node:fs';

import { getWorkspace } from '../db/queries';
import { importPostman } from './postman';
import { importInsomnia } from './insomnia';
import { importOpenAPI } from './openapi';
import { importCurl } from './curl';
import { importHar } from './har';

export type ImportSource = 'postman' | 'insomnia' | 'openapi' | 'curl' | 'har';

export function runImport(args: {
  workspaceId: string;
  source: ImportSource;
  filePath?: string;
  content?: string;
}) {
  const emptySummary = { collections: 0, requests: 0, environments: 0, warnings: [] };

  // Guard against stale workspaceIds (workspace deleted locally or via sync
  // while the renderer still holds the id). Without this the SQLite insert
  // bubbles up as a raw "FOREIGN KEY constraint failed" through the IPC.
  if (!getWorkspace(args.workspaceId)) {
    return {
      success: false,
      summary: emptySummary,
      errorMessage:
        'Selected workspace no longer exists. Pick a workspace from the sidebar and try again.',
    };
  }

  let content = args.content;
  if (!content && args.filePath) {
    try {
      content = fs.readFileSync(args.filePath, 'utf-8');
    } catch (e) {
      return {
        success: false,
        summary: emptySummary,
        errorMessage: `Couldn't read file: ${(e as Error).message}`,
      };
    }
  }
  if (!content) {
    return {
      success: false,
      summary: emptySummary,
      errorMessage: 'No content or file provided.',
    };
  }

  try {
    switch (args.source) {
      case 'postman': {
        const r = importPostman(args.workspaceId, content);
        return {
          success: r.success,
          collectionId: r.rootCollectionId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
      case 'insomnia': {
        const r = importInsomnia(args.workspaceId, content);
        return {
          success: r.success,
          collectionId: r.rootCollectionId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
      case 'openapi': {
        const ext = args.filePath?.toLowerCase().endsWith('.yaml') || args.filePath?.toLowerCase().endsWith('.yml')
          ? 'yaml'
          : 'json';
        const r = importOpenAPI(args.workspaceId, content, ext);
        return {
          success: r.success,
          collectionId: r.rootCollectionId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
      case 'curl': {
        const r = importCurl(args.workspaceId, null, content);
        return {
          success: r.success,
          requestId: r.requestId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
      case 'har': {
        const r = importHar(args.workspaceId, content);
        return {
          success: r.success,
          collectionId: r.rootCollectionId,
          summary: r.summary,
          errorMessage: r.error,
        };
      }
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    // FK failures are almost always a workspace race (deleted between the
    // up-front check and the inserts). Surface a friendly message instead of
    // the raw SqliteError that the renderer would otherwise show.
    const isFkFail =
      err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
      /FOREIGN KEY constraint failed/i.test(err.message);
    return {
      success: false,
      summary: emptySummary,
      errorMessage: isFkFail
        ? 'Import target is missing. The selected workspace may have been removed — pick a workspace and try again.'
        : `Import failed: ${err.message}`,
    };
  }
}
