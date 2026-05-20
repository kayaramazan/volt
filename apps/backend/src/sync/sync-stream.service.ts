import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';
import type { SseEvent } from '@volt/shared';

/**
 * Maintains in-memory subscriptions of clients to workspace change events.
 *
 * When a sync push is applied, the SyncService calls broadcastChange(),
 * which fans out to all subscribers of that workspace.
 *
 * For single-instance backend this is fine. Scaling to multiple instances
 * later requires Redis pub/sub or similar (post-MVP).
 */
@Injectable()
export class SyncStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncStreamService.name);

  // One Subject per workspaceId; lazily created.
  private readonly workspaceStreams = new Map<string, Subject<SseEvent>>();

  // Global heartbeat: every 30s, fan out to all active streams.
  private readonly heartbeat$ = interval(30_000).pipe(
    map((): SseEvent => ({ type: 'heartbeat', ts: new Date().toISOString() })),
  );

  /**
   * Returns an Observable for the given workspace's change events,
   * mixed with global heartbeats. The caller subscribes via SSE.
   */
  subscribe(workspaceId: string): Observable<SseEvent> {
    if (!this.workspaceStreams.has(workspaceId)) {
      this.workspaceStreams.set(workspaceId, new Subject<SseEvent>());
    }
    const workspace$ = this.workspaceStreams.get(workspaceId)!;
    return merge(workspace$, this.heartbeat$);
  }

  /**
   * Called by SyncService after a successful push. Notifies all subscribers
   * of the affected workspace that there are new changes to pull.
   */
  broadcastChange(workspaceId: string, newRevision: bigint): void {
    const stream = this.workspaceStreams.get(workspaceId);
    if (!stream) return; // no subscribers
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
}
