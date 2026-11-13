"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@volt/db");
const app_error_1 = require("../common/app.error");
const sync_stream_service_1 = require("./sync-stream.service");
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
let SyncService = SyncService_1 = class SyncService {
    streams;
    logger = new common_1.Logger(SyncService_1.name);
    async push(userId, workspaceId, baseRevision, changes) {
        const baseRev = BigInt(baseRevision);
        const result = await db_1.prisma.$transaction(async (tx) => {
            // Acquire advisory lock — serializes concurrent pushes for this workspace.
            // pg_advisory_xact_lock auto-releases at end of transaction.
            const lockKey = this.workspaceLockKey(workspaceId);
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(${lockKey})`;
            // Re-read currentRevision under lock — this is the authoritative value.
            const workspace = await tx.workspace.findUniqueOrThrow({
                where: { id: workspaceId },
                select: { currentRevision: true },
            });
            if (workspace.currentRevision !== baseRev) {
                throw new app_error_1.AppError('REVISION_CONFLICT', 409, 'Your workspace is out of date. Pull latest changes first.', {
                    workspaceId,
                    baseRevision,
                    currentRevision: workspace.currentRevision.toString(),
                });
            }
            // Apply changes one by one. Each gets revision = currentRevision + 1, then increment.
            let revisionCounter = workspace.currentRevision;
            const applied = [];
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
    async pull(workspaceId, sinceStr) {
        const since = BigInt(sinceStr);
        const workspace = await db_1.prisma.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            select: { currentRevision: true },
        });
        // Four parallel queries — one per syncable table.
        const [collections, requests, environments, history] = await Promise.all([
            db_1.prisma.collection.findMany({
                where: { workspaceId, revision: { gt: since } },
                orderBy: { revision: 'asc' },
            }),
            db_1.prisma.apiRequest.findMany({
                where: { workspaceId, revision: { gt: since } },
                orderBy: { revision: 'asc' },
            }),
            db_1.prisma.environment.findMany({
                where: { workspaceId, revision: { gt: since } },
                orderBy: { revision: 'asc' },
            }),
            // History is device-private (snapshots carry resolved auth headers and
            // tokens). Never hand it to other members, including rows uploaded by
            // older desktop builds.
            Promise.resolve([]),
        ]);
        // Merge by revision asc into a single ordered stream.
        const fetched = [
            ...collections.map((c) => this.collectionToChange(c)),
            ...requests.map((r) => this.requestToChange(r)),
            ...environments.map((e) => this.environmentToChange(e)),
            ...history.map((h) => this.historyToChange(h)),
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
    async listConflicts(workspaceId) {
        return db_1.prisma.conflictLog.findMany({
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
    async restoreConflict(userId, conflictId) {
        const conflict = await db_1.prisma.conflictLog.findUniqueOrThrow({
            where: { id: conflictId },
        });
        // Build a synthetic upsert change from the previous state.
        const change = {
            op: 'upsert',
            table: conflict.table,
            rowId: conflict.rowId,
            data: conflict.previousState,
        };
        // Read current revision to use as baseRevision (we want to apply now).
        const workspace = await db_1.prisma.workspace.findUniqueOrThrow({
            where: { id: conflict.workspaceId },
            select: { currentRevision: true },
        });
        return this.push(userId, conflict.workspaceId, workspace.currentRevision.toString(), [change]);
    }
    // ─────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────
    constructor(streams) {
        this.streams = streams;
    }
    async applyChange(tx, workspaceId, userId, change, newRevision) {
        if (change.op === 'delete') {
            await this.deleteRow(tx, workspaceId, userId, change.table, change.rowId, newRevision);
            return;
        }
        // upsert
        await this.upsertRow(tx, workspaceId, userId, change.table, change.rowId, change.data, newRevision);
    }
    async upsertRow(tx, workspaceId, userId, table, rowId, data, newRevision) {
        switch (table) {
            case 'collection': {
                const existing = await tx.collection.findUnique({ where: { id: rowId } });
                if (existing && existing.workspaceId !== workspaceId) {
                    throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 403, 'Row belongs to another workspace.');
                }
                if (existing) {
                    await this.logConflict(tx, workspaceId, userId, 'collection', existing);
                }
                await tx.collection.upsert({
                    where: { id: rowId },
                    create: {
                        id: rowId,
                        workspaceId,
                        parentId: data.parentId ?? null,
                        name: data.name ?? 'Untitled',
                        description: data.description ?? '',
                        sortOrder: data.sortOrder ?? 0,
                        variables: data.variables ?? [],
                        revision: newRevision,
                    },
                    update: {
                        parentId: data.parentId ?? null,
                        name: data.name ?? existing?.name ?? 'Untitled',
                        description: data.description ?? existing?.description ?? '',
                        sortOrder: data.sortOrder ?? existing?.sortOrder ?? 0,
                        variables: data.variables ?? existing?.variables ?? [],
                        revision: newRevision,
                        deletedAt: null,
                    },
                });
                break;
            }
            case 'request': {
                const existing = await tx.apiRequest.findUnique({ where: { id: rowId } });
                if (existing && existing.workspaceId !== workspaceId) {
                    throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 403);
                }
                if (existing) {
                    await this.logConflict(tx, workspaceId, userId, 'request', existing);
                }
                await tx.apiRequest.upsert({
                    where: { id: rowId },
                    create: {
                        id: rowId,
                        workspaceId,
                        collectionId: data.collectionId ?? null,
                        name: data.name ?? 'Untitled',
                        method: data.method ?? 'GET',
                        url: data.url ?? '',
                        headers: data.headers ?? [],
                        queryParams: data.queryParams ?? [],
                        pathVariables: data.pathVariables ?? [],
                        bodyType: data.bodyType ?? 'none',
                        body: data.body ?? {},
                        auth: data.auth ?? { type: 'none' },
                        preRequestScript: data.preRequestScript ?? '',
                        postResponseScript: data.postResponseScript ?? '',
                        description: data.description ?? '',
                        examples: data.examples ?? [],
                        sortOrder: data.sortOrder ?? 0,
                        revision: newRevision,
                    },
                    update: {
                        collectionId: data.collectionId ?? null,
                        name: data.name ?? existing?.name ?? 'Untitled',
                        method: data.method ?? existing?.method ?? 'GET',
                        url: data.url ?? existing?.url ?? '',
                        headers: data.headers ?? existing?.headers ?? [],
                        queryParams: data.queryParams ?? existing?.queryParams ?? [],
                        pathVariables: data.pathVariables ?? existing?.pathVariables ?? [],
                        bodyType: data.bodyType ?? existing?.bodyType ?? 'none',
                        body: data.body ?? existing?.body ?? {},
                        auth: data.auth ?? existing?.auth ?? { type: 'none' },
                        preRequestScript: data.preRequestScript ?? existing?.preRequestScript ?? '',
                        postResponseScript: data.postResponseScript ?? existing?.postResponseScript ?? '',
                        description: data.description ?? existing?.description ?? '',
                        examples: data.examples ?? existing?.examples ?? [],
                        sortOrder: data.sortOrder ?? existing?.sortOrder ?? 0,
                        revision: newRevision,
                        deletedAt: null,
                    },
                });
                break;
            }
            case 'environment': {
                const existing = await tx.environment.findUnique({ where: { id: rowId } });
                if (existing && existing.workspaceId !== workspaceId) {
                    throw new app_error_1.AppError('WORKSPACE_NOT_FOUND', 403);
                }
                if (existing) {
                    await this.logConflict(tx, workspaceId, userId, 'environment', existing);
                }
                await tx.environment.upsert({
                    where: { id: rowId },
                    create: {
                        id: rowId,
                        workspaceId,
                        name: data.name ?? 'Environment',
                        sortOrder: data.sortOrder ?? 0,
                        variables: data.variables ?? [],
                        revision: newRevision,
                    },
                    update: {
                        name: data.name ?? existing?.name ?? 'Environment',
                        sortOrder: data.sortOrder ?? existing?.sortOrder ?? 0,
                        variables: data.variables ?? existing?.variables ?? [],
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
    async deleteRow(tx, workspaceId, userId, table, rowId, newRevision) {
        // Soft delete + log conflict if there's prior state worth restoring.
        switch (table) {
            case 'collection': {
                const existing = await tx.collection.findUnique({ where: { id: rowId } });
                if (!existing || existing.workspaceId !== workspaceId)
                    return;
                await this.logConflict(tx, workspaceId, userId, 'collection', existing);
                await tx.collection.update({
                    where: { id: rowId },
                    data: { deletedAt: new Date(), revision: newRevision },
                });
                break;
            }
            case 'request': {
                const existing = await tx.apiRequest.findUnique({ where: { id: rowId } });
                if (!existing || existing.workspaceId !== workspaceId)
                    return;
                await this.logConflict(tx, workspaceId, userId, 'request', existing);
                await tx.apiRequest.update({
                    where: { id: rowId },
                    data: { deletedAt: new Date(), revision: newRevision },
                });
                break;
            }
            case 'environment': {
                const existing = await tx.environment.findUnique({ where: { id: rowId } });
                if (!existing || existing.workspaceId !== workspaceId)
                    return;
                await this.logConflict(tx, workspaceId, userId, 'environment', existing);
                await tx.environment.update({
                    where: { id: rowId },
                    data: { deletedAt: new Date(), revision: newRevision },
                });
                break;
            }
            case 'history': {
                const existing = await tx.historyEntry.findUnique({ where: { id: rowId } });
                if (!existing || existing.workspaceId !== workspaceId)
                    return;
                await tx.historyEntry.update({
                    where: { id: rowId },
                    data: { deletedAt: new Date(), revision: newRevision },
                });
                break;
            }
        }
    }
    async logConflict(tx, workspaceId, overwrittenBy, table, previousState) {
        await tx.conflictLog.create({
            data: {
                workspaceId,
                table,
                rowId: previousState.id,
                previousState: this.serializeForJson(previousState),
                overwrittenBy,
            },
        });
    }
    /**
     * Prisma row → plain JSON (drops BigInt revision, Date fields → ISO strings).
     */
    serializeForJson(obj) {
        return JSON.parse(JSON.stringify(obj, (_k, v) => {
            if (typeof v === 'bigint')
                return v.toString();
            return v;
        }));
    }
    collectionToChange(c) {
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
    requestToChange(r) {
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
    environmentToChange(e) {
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
    historyToChange(h) {
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
    workspaceLockKey(workspaceId) {
        // Simple djb2 hash → int32 range
        let hash = 5381;
        for (let i = 0; i < workspaceId.length; i++) {
            hash = ((hash << 5) + hash + workspaceId.charCodeAt(i)) | 0;
        }
        return hash;
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sync_stream_service_1.SyncStreamService])
], SyncService);
//# sourceMappingURL=sync.service.js.map