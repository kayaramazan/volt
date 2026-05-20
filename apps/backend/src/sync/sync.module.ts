import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncStreamService } from './sync-stream.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [SyncController],
  providers: [SyncService, SyncStreamService],
  exports: [SyncService, SyncStreamService],
})
export class SyncModule {}
