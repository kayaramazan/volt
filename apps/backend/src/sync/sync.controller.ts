import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  RestoreConflictInput,
  SyncPullInput,
  SyncPushInput,
} from '@volt/shared';

import { SyncService } from './sync.service';
import { SyncStreamService } from './sync-stream.service';
import { SessionGuard } from '../auth/session.guard';
import { WorkspaceService } from '../workspace/workspace.service';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

@Controller('sync')
@UseGuards(SessionGuard)
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly streams: SyncStreamService,
    private readonly workspaces: WorkspaceService,
  ) {}

  @Post('push')
  @HttpCode(200)
  async push(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(SyncPushInput)) input: import('@volt/shared').SyncPushInput,
  ) {
    await this.workspaces.assertAccess(user.id, input.workspaceId);
    return this.sync.push(user.id, input.workspaceId, input.baseRevision, input.changes);
  }

  @Get('pull')
  async pull(
    @CurrentUser() user: RequestUser,
    @Query('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('since') since: string,
  ) {
    await this.workspaces.assertAccess(user.id, workspaceId);
    const parsed = SyncPullInput.parse({ workspaceId, since: since ?? '0' });
    return this.sync.pull(parsed.workspaceId, parsed.since);
  }

  /**
   * SSE stream. The client subscribes to receive `change` and `heartbeat` events
   * for the given workspace.
   *
   * Auth note: SSE in browsers can't send custom headers, so the client passes
   * the session token as ?token= in the URL. SessionGuard accepts this.
   */
  @Sse('stream')
  async stream(
    @CurrentUser() user: RequestUser,
    @Query('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<Observable<MessageEvent>> {
    await this.workspaces.assertAccess(user.id, workspaceId);

    return this.streams.subscribe(workspaceId).pipe(
      map((event) => ({
        type: event.type,
        data: event,
      })),
    );
  }

  @Get('conflicts')
  async conflicts(
    @CurrentUser() user: RequestUser,
    @Query('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    await this.workspaces.assertAccess(user.id, workspaceId);
    return this.sync.listConflicts(workspaceId);
  }

  @Post('conflicts/:id/restore')
  async restoreConflict(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sync.restoreConflict(user.id, id);
  }
}
