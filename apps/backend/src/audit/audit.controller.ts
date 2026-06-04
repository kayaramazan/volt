import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { TeamService } from '../team/team.service';
import { AuditService } from './audit.service';

@Controller('teams')
@UseGuards(SessionGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly teamService: TeamService,
  ) {}

  /**
   * Returns the most recent audit-log entries for a team, newest-first.
   * Owners only — the audit log can include billing actions and member
   * removals, both of which leak information about other members.
   */
  @Get(':id/audit-log')
  async list(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) teamId: string,
    @Query('limit') limit?: string,
  ) {
    await this.teamService.assertOwner(user.id, teamId);
    const take = limit ? Number(limit) : undefined;
    const entries = await this.auditService.list(teamId, take);
    return { entries };
  }
}
