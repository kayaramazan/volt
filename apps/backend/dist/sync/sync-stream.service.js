"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SyncStreamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStreamService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
/**
 * Maintains in-memory subscriptions of clients to workspace change events.
 *
 * When a sync push is applied, the SyncService calls broadcastChange(),
 * which fans out to all subscribers of that workspace.
 *
 * For single-instance backend this is fine. Scaling to multiple instances
 * later requires Redis pub/sub or similar (post-MVP).
 */
let SyncStreamService = SyncStreamService_1 = class SyncStreamService {
    logger = new common_1.Logger(SyncStreamService_1.name);
    // One Subject per workspaceId; lazily created.
    workspaceStreams = new Map();
    // Global heartbeat: every 30s, fan out to all active streams.
    heartbeat$ = (0, rxjs_1.interval)(30_000).pipe((0, rxjs_1.map)(() => ({ type: 'heartbeat', ts: new Date().toISOString() })));
    /**
     * Returns an Observable for the given workspace's change events,
     * mixed with global heartbeats. The caller subscribes via SSE.
     */
    subscribe(workspaceId) {
        if (!this.workspaceStreams.has(workspaceId)) {
            this.workspaceStreams.set(workspaceId, new rxjs_1.Subject());
        }
        const workspace$ = this.workspaceStreams.get(workspaceId);
        return (0, rxjs_1.merge)(workspace$, this.heartbeat$);
    }
    /**
     * Called by SyncService after a successful push. Notifies all subscribers
     * of the affected workspace that there are new changes to pull.
     */
    broadcastChange(workspaceId, newRevision) {
        const stream = this.workspaceStreams.get(workspaceId);
        if (!stream)
            return; // no subscribers
        stream.next({
            type: 'change',
            workspaceId,
            newRevision: newRevision.toString(),
        });
    }
    onModuleDestroy() {
        for (const subject of this.workspaceStreams.values()) {
            subject.complete();
        }
        this.workspaceStreams.clear();
    }
};
exports.SyncStreamService = SyncStreamService;
exports.SyncStreamService = SyncStreamService = SyncStreamService_1 = __decorate([
    (0, common_1.Injectable)()
], SyncStreamService);
//# sourceMappingURL=sync-stream.service.js.map