import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { AuditModule } from '../audit/audit.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule, TeamModule, AuditModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
