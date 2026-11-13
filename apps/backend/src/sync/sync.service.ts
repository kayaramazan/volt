import { Injectable, Logger } from '@nestjs/common';
import { prisma, Prisma } from '@volt/db';
import type {
  FetchedChange,
  SyncChange,
  SyncPullOutput,
  SyncPushOutput,
  SyncTable,
} from '@volt/shared';

import { AppError } from '../common/app.error';
import { SyncStreamService } from './sync-stream.service';

/**
 * Sync engine — implements last-write-wins with monotonic per-workspace revision.
 *
 * Push flow:
 *   1. Acquire advisory lock for workspace (serializes concurrent pushes)
 *   2. Re-read currentRevision under lock
 *   3. If baseRevision != currentRevision → REVISION_CONFLICT (client must pull first)
 *   4. For each change:
 *        a. Read existing row (if any)
 *        b. If existing row's revision > baseRevision: that row was changed by someone
 *           else after the client's baseRevision. Save its state to ConflictLog
 *           BEFORE overwriting (last-write-wins, but with audit trail).
 *           [Note: this can't actually happen when baseRevision == currentRevision,
 *            since no row can have revision > workspace revision. Defensive check.]
 *        c. Increment workspace currentRevision
 *        d. Apply change with the new revision
 *   5. Release lock (automatic at transaction commit)
 *   6. Broadcast SSE 'change' event to subscribers
 *
 * Pull flow:
 *   1. Return all rows where revision > since, ordered ASC
 *   2. Include workspace's currentRevision for client to advance to
 *
 * The advisory lock + transaction guarantees: two concurrent pushes from the
 * same baseRevision will be serialized; the second will see updated
 * currentRevision and get a 409.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  async push(
    userId: string,
    workspaceId: string,
    baseRevision: string,
    changes: SyncChange[],
  ): Promise<SyncPushOutput> {
    const baseRev = BigInt(baseRevision);

    const result = await prisma.$transaction(async (tx) => {
      // Acquire advisory lock — serializes concurrent pushes for this workspace.
      // pg_advisory_xact_lock auto-releases at end of transaction.
      const lockKey = this.workspaceLockKey(workspaceId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Re-read currentRevision under lock — this is the authoritative value.
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { currentRevision: true },
      });

      if (workspace.currentRevision !== baseRev) {
        throw new AppError(
          'REVISION_CONFLICT',
          409,
          'Your workspace is out of date. Pull latest changes first.',
          {
            workspaceId,
            baseRevision,
            currentRevision: workspace.currentRevision.toString(),
          },
        );
      }

      // Apply changes one by one. Each gets revision = currentRevision + 1, then increment.
      let revisionCounter = workspace.currentRevision;
      const applied: Array<{ table: SyncTable; rowId: string; revision: string }> = [];

      for (const change of changes) {
        revisionCounter += 1n;
        await this.applyChange(tx, workspaceId, userId, change, revisionCounter);
        applied.push({
          table: change.table,
          rowId: change.rowId,
          revision: revisionCounter.toString(),
        });
      }

      // Commit new currentRevision
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { currentRevision: revisionCounter },
      });

      return { newRevision: revisionCounter, applied };
    });

    // Notify SSE subscribers (outside the transaction — after commit)
    this.streams.broadcastChange(workspaceId, result.newRevision);

    return {
      newRevision: result.newRevision.toString(),
      applied: result.applied,
    };
  }

  async pull(workspaceId: string, sinceStr: string): Promise<SyncPullOutput> {
    const since = BigInt(sinceStr);

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { currentRevision: true },
    });

    // Four parallel queries — one per syncable table.
    const [collections, requests, environments, history] = await Promise.all([
      prisma.collection.findMany({
        where: { workspaceId, revision: { gt: since } },
        orderBy: { revision: 'asc' },
      }),
      prisma.apiRequest.findMany({
        where: { workspaceId, revision: { gt: since } },
        orderBy: { revision: 'asc' },
      }),
      prisma.environment.findMany({
        where: { workspaceId, revision: { gt: since } },
        orderBy: { revision: 'asc' },
      }),
      // History is device-private (snapshots carry resolved auth headers and
      // tokens). Never hand it to other members, including rows uploaded by
      // older desktop builds.
      Promise.resolve([] as never[]),
    ]);

    // Merge by revision asc into a single ordered stream.
    const fetched: FetchedChange[] = [
      ...collections.map((c): FetchedChange => this.collectionToChange(c)),
      ...requests.map((r): FetchedChange => this.requestToChange(r)),
      ...environments.map((e): FetchedChange => this.environmentToChange(e)),
      ...history.map((h): FetchedChange => this.historyToChange(h)),
    ].sort((a, b) => {
      const ar = BigInt(a.revision);
      const br = BigInt(b.revision);
      return ar < br ? -1 : ar > br ? 1 : 0;
    });

    return {
      currentRevision: workspace.currentRevision.toString(),
      changes: fetched,
    };
  }

  async listConflicts(workspaceId: string) {
    return prisma.conflictLog.findMany({
      where: { workspaceId },
      orderBy: { overwrittenAt: 'desc' },
      include: { author: { select: { id: true, name: true } } },
      take: 100,
    });
  }

  /**
   * Restore an overwritten row by reapplying its previous state as a new change.
   * The "winner" of the original conflict is overwritten in turn — recorded
   * as a fresh conflict entry.
   */
  async restoreConflict(userId: string, conflictId: string) {
    const conflict = await prisma.conflictLog.findUniqueOrThrow({
      where: { id: conflictId },
    });

    // Build a synthetic upsert change from the previous state.
    const change: SyncChange = {
      op: 'upsert',
      table: conflict.table as SyncTable,
      rowId: conflict.rowId,
      data: conflict.previousState as Record<string, unknown>,
    };

    // Read current revision to use as baseRevision (we want to apply now).
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: conflict.workspaceId },
      select: { currentRevision: true },
    });

    return this.push(
      userId,
      conflict.workspaceId,
      workspace.currentRevision.toString(),
      [change],
    );
  }

  // ─────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────

  constructor(private readonly streams: SyncStreamService) {}

  private async applyChange(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId: string,
    userId: string,
    change: SyncChange,
    newRevision: bigint,
  ) {
    if (change.op === 'delete') {
      await this.deleteRow(tx, workspaceId, userId, change.table, change.rowId, newRevision);
      return;
    }

    // upsert
    await this.upsertRow(tx, workspaceId, userId, change.table, change.rowId, change.data, newRevision);
  }

  private async upsertRow(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId: string,
    userId: string,
    table: SyncTable,
    rowId: string,
    data: Record<string, unknown>,
    newRevision: bigint,
  ) {
    switch (table) {
      case 'collection': {
        const existing = await tx.collection.findUnique({ where: { id: rowId } });
        if (existing && existing.workspaceId !== workspaceId) {
          throw new AppError('WORKSPACE_NOT_FOUND', 403, 'Row belongs to another workspace.');
        }
        if (existing) {
          await this.logConflict(tx, workspaceId, userId, 'collection', existing);
        }
        await tx.collection.upsert({
          where: { id: rowId },
          create: {
            id: rowId,
            workspaceId,
            parentId: (data.parentId as string | null) ?? null,
            name: (data.name as string) ?? 'Untitled',
            description: (data.description as string) ?? '',
            sortOrder: (data.sortOrder as number) ?? 0,
            variables: (data.variables as object) ?? [],
            revision: newRevision,
          },
          update: {
            parentId: (data.parentId as string | null) ?? null,
            name: (data.name as string) ?? existing?.name ?? 'Untitled',
            description:
              (data.description as string) ?? existing?.description ?? '',
            sortOrder: (data.sortOrder as number) ?? existing?.sortOrder ?? 0,
            variables: (data.variables as object) ?? existing?.variables ?? [],
            revision: newRevision,
            deletedAt: null,
          },
        });
        break;
      }
      case 'request': {
        const existing = await tx.apiRequest.findUnique({ where: { id: rowId } });
        if (existing && existing.workspaceId !== workspaceId) {
          throw new AppError('WORKSPACE_NOT_FOUND', 403);
        }
        if (existing) {
          await this.logConflict(tx, workspaceId, userId, 'request', existing);
        }
        await tx.apiRequest.upsert({
          where: { id: rowId },
          create: {
            id: rowId,
            workspaceId,
            collectionId: (data.collectionId as string | null) ?? null,
            name: (data.name as string) ?? 'Untitled',
            method: (data.method as string) ?? 'GET',
            url: (data.url as string) ?? '',
            headers: (data.headers as object) ?? [],
            queryParams: (data.queryParams as object) ?? [],
            pathVariables: (data.pathVariables as object) ?? [],
            bodyType: (data.bodyType as string) ?? 'none',
            body: (data.body as object) ?? {},
            auth: (data.auth as object) ?? { type: 'none' },
            preRequestScript: (data.preRequestScript as string) ?? '',
            postResponseScript: (data.postResponseScript as string) ?? '',
            description: (data.description as string) ?? '',
            examples: (data.examples as object) ?? [],
            sortOrder: (data.sortOrder as number) ?? 0,
            revision: newRevision,
          },
          update: {
            collectionId: (data.collectionId as string | null) ?? null,
            name: (data.name as string) ?? existing?.name ?? 'Untitled',
            method: (data.method as string) ?? existing?.method ?? 'GET',
            url: (data.url as string) ?? existing?.url ?? '',
            headers: (data.headers as object) ?? existing?.headers ?? [],
            queryParams: (data.queryParams as object) ?? existing?.queryParams ?? [],
            pathVariables: (data.pathVariables as object) ?? existing?.pathVariables ?? [],
            bodyType: (data.bodyType as string) ?? existing?.bodyType ?? 'none',
            body: (data.body as object) ?? existing?.body ?? {},
            auth: (data.auth as object) ?? existing?.auth ?? { type: 'none' },
            preRequestScript:
              (data.preRequestScript as string) ?? existing?.preRequestScript ?? '',
            postResponseScript:
              (data.postResponseScript as string) ?? existing?.postResponseScript ?? '',
            description: (data.description as string) ?? existing?.description ?? '',
            examples: (data.examples as object) ?? existing?.examples ?? [],
            sortOrder: (data.sortOrder as number) ?? existing?.sortOrder ?? 0,
            revision: newRevision,
            deletedAt: null,
          },
        });
        break;
      }
      case 'environment': {
        const existing = await tx.environment.findUnique({ where: { id: rowId } });
        if (existing && existing.workspaceId !== workspaceId) {
          throw new AppError('WORKSPACE_NOT_FOUND', 403);
        }
        if (existing) {
          await this.logConflict(tx, workspaceId, userId, 'environment', existing);
        }
        await tx.environment.upsert({
          where: { id: rowId },
          create: {
            id: rowId,
            workspaceId,
            name: (data.name as string) ?? 'Environment',
            sortOrder: (data.sortOrder as number) ?? 0,
            variables: (data.variables as object) ?? [],
            revision: newRevision,
          },
          update: {
            name: (data.name as string) ?? existing?.name ?? 'Environment',
            sortOrder: (data.sortOrder as number) ?? existing?.sortOrder ?? 0,
            variables: (data.variables as object) ?? existing?.variables ?? [],
            revision: newRevision,
            deletedAt: null,
          },
        });
        break;
      }
      case 'history': {
        // History is device-private and must not be stored server-side.
        // Older desktop builds still upload it: accept the change (so their
        // dirty flags clear) but drop the data.
        break;
      }
    }
  }

  private async deleteRow(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId: string,
    userId: string,
    table: SyncTable,
    rowId: string,
    newRevision: bigint,
  ) {
    // Soft delete + log conflict if there's prior state worth restoring.
    switch (table) {
      case 'collection': {
        const existing = await tx.collection.findUnique({ where: { id: rowId } });
        if (!existing || existing.workspaceId !== workspaceId) return;
        await this.logConflict(tx, workspaceId, userId, 'collection', existing);
        await tx.collection.update({
          where: { id: rowId },
          data: { deletedAt: new Date(), revision: newRevision },
        });
        break;
      }
      case 'request': {
        const existing = await tx.apiRequest.findUnique({ where: { id: rowId } });
        if (!existing || existing.workspaceId !== workspaceId) return;
        await this.logConflict(tx, workspaceId, userId, 'request', existing);
        await tx.apiRequest.update({
          where: { id: rowId },
          data: { deletedAt: new Date(), revision: newRevision },
        });
        break;
      }
      case 'environment': {
        const existing = await tx.environment.findUnique({ where: { id: rowId } });
        if (!existing || existing.workspaceId !== workspaceId) return;
        await this.logConflict(tx, workspaceId, userId, 'environment', existing);
        await tx.environment.update({
          where: { id: rowId },
          data: { deletedAt: new Date(), revision: newRevision },
        });
        break;
      }
      case 'history': {
        const existing = await tx.historyEntry.findUnique({ where: { id: rowId } });
        if (!existing || existing.workspaceId !== workspaceId) return;
        await tx.historyEntry.update({
          where: { id: rowId },
          data: { deletedAt: new Date(), revision: newRevision },
        });
        break;
      }
    }
  }

  private async logConflict(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    workspaceId: string,
    overwrittenBy: string,
    table: SyncTable,
    previousState: object,
  ) {
    await tx.conflictLog.create({
      data: {
        workspaceId,
        table,
        rowId: (previousState as { id: string }).id,
        previousState: this.serializeForJson(previousState),
        overwrittenBy,
      },
    });
  }

  /**
   * Prisma row → plain JSON (drops BigInt revision, Date fields → ISO strings).
   */
  private serializeForJson(obj: object): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(obj, (_k, v) => {
        if (typeof v === 'bigint') return v.toString();
        return v;
      }),
    );
  }

  private collectionToChange(c: {
    id: string;
    parentId: string | null;
    name: string;
    description: string;
    sortOrder: number;
    variables: unknown;
    revision: bigint;
    deletedAt: Date | null;
  }): FetchedChange {
    if (c.deletedAt) {
      return {
        op: 'delete',
        table: 'collection',
        rowId: c.id,
        revision: c.revision.toString(),
      };
    }
    return {
      op: 'upsert',
      table: 'collection',
      rowId: c.id,
      revision: c.revision.toString(),
      data: {
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        variables: c.variables,
      },
    };
  }

  private requestToChange(r: {
    id: string;
    collectionId: string | null;
    name: string;
    method: string;
    url: string;
    headers: unknown;
    queryParams: unknown;
    pathVariables: unknown;
    bodyType: string;
    body: unknown;
    auth: unknown;
    preRequestScript: string;
    postResponseScript: string;
    description: string;
    examples: unknown;
    sortOrder: number;
    revision: bigint;
    deletedAt: Date | null;
  }): FetchedChange {
    if (r.deletedAt) {
      return {
        op: 'delete',
        table: 'request',
        rowId: r.id,
        revision: r.revision.toString(),
      };
    }
    return {
      op: 'upsert',
      table: 'request',
      rowId: r.id,
      revision: r.revision.toString(),
      data: {
        id: r.id,
        collectionId: r.collectionId,
        name: r.name,
        method: r.method,
        url: r.url,
        headers: r.headers,
        queryParams: r.queryParams,
        pathVariables: r.pathVariables,
        bodyType: r.bodyType,
        body: r.body,
        auth: r.auth,
        preRequestScript: r.preRequestScript,
        postResponseScript: r.postResponseScript,
        description: r.description,
        examples: r.examples,
        sortOrder: r.sortOrder,
      },
    };
  }

  private environmentToChange(e: {
    id: string;
    name: string;
    sortOrder: number;
    variables: unknown;
    revision: bigint;
    deletedAt: Date | null;
  }): FetchedChange {
    if (e.deletedAt) {
      return {
        op: 'delete',
        table: 'environment',
        rowId: e.id,
        revision: e.revision.toString(),
      };
    }
    return {
      op: 'upsert',
      table: 'environment',
      rowId: e.id,
      revision: e.revision.toString(),
      data: {
        id: e.id,
        name: e.name,
        sortOrder: e.sortOrder,
        variables: e.variables,
      },
    };
  }

  private historyToChange(h: {
    id: string;
    requestId: string | null;
    method: string;
    url: string;
    requestSnapshot: unknown;
    statusCode: number | null;
    responseHeaders: unknown;
    responseSizeBytes: number | null;
    responseContentType: string | null;
    startedAt: Date;
    durationMs: number;
    errorCode: string | null;
    pinned: boolean;
    revision: bigint;
    deletedAt: Date | null;
  }): FetchedChange {
    if (h.deletedAt) {
      return {
        op: 'delete',
        table: 'history',
        rowId: h.id,
        revision: h.revision.toString(),
      };
    }
    return {
      op: 'upsert',
      table: 'history',
      rowId: h.id,
      revision: h.revision.toString(),
      data: {
        id: h.id,
        requestId: h.requestId,
        method: h.method,
        url: h.url,
        requestSnapshot: h.requestSnapshot,
        statusCode: h.statusCode,
        responseHeaders: h.responseHeaders,
        responseSizeBytes: h.responseSizeBytes,
        responseContentType: h.responseContentType,
        // Send as epoch ms so the desktop's integer column maps cleanly.
        startedAt: h.startedAt.getTime(),
        durationMs: h.durationMs,
        errorCode: h.errorCode,
        pinned: h.pinned,
      },
    };
  }

  /**
   * Convert a workspace UUID string to a stable bigint for pg_advisory_lock.
   * Uses Postgres hashtext() which returns int4, then casts via SQL.
   * Here we compute hashtext-equivalent in JS for the lock key.
   */
  private workspaceLockKey(workspaceId: string): number {
    // Simple djb2 hash → int32 range
    let hash = 5381;
    for (let i = 0; i < workspaceId.length; i++) {
      hash = ((hash << 5) + hash + workspaceId.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
