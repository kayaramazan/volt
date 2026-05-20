import { Module } from '@nestjs/common';
import { TrpcRouter } from './trpc.router';
import { TrpcController } from './trpc.controller';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [AuthModule, TeamModule, WorkspaceModule, SyncModule],
  controllers: [TrpcController],
  providers: [TrpcRouter],
})
export class TrpcModule {}
