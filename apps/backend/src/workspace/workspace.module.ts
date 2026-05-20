import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [AuthModule, TeamModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
