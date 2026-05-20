import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TeamModule } from './team/team.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { SyncModule } from './sync/sync.module';
import { TrpcModule } from './trpc/trpc.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [AuthModule, UserModule, TeamModule, WorkspaceModule, SyncModule, TrpcModule],
  controllers: [HealthController],
})
export class AppModule {}
