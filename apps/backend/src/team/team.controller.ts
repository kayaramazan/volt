import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AcceptInviteInput,
  CreateTeamInput,
  InviteTeamMemberInput,
  UpdateMemberRoleInput,
} from '@volt/shared';
import { TeamRole } from '@volt/db';
import { z } from 'zod';

import { TeamService } from './team.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

const TransferOwnershipInput = z.object({ newOwnerId: z.string().uuid() });

@Controller('teams')
@UseGuards(SessionGuard)
export class TeamController {
  constructor(private readonly teams: TeamService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.teams.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateTeamInput)) input: { name: string },
  ) {
    return this.teams.create(user.id, input.name);
  }

  @Get(':id')
  getDetail(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teams.getDetail(user.id, id);
  }

  @Post(':id/invite')
  invite(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(InviteTeamMemberInput.pick({ email: true })))
    input: { email: string },
  ) {
    return this.teams.invite(user.id, id, input.email);
  }

  @Post('invite/:code/accept')
  accept(
    @CurrentUser() user: RequestUser,
    @Param('code') code: string,
  ) {
    return this.teams.acceptInvite(user.id, code);
  }

  @Patch(':id/members/:userId')
  updateRole(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleInput.pick({ role: true })))
    input: { role: TeamRole },
  ) {
    return this.teams.updateMemberRole(user.id, teamId, userId, input.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teams.removeMember(user.id, teamId, userId);
  }

  @Post(':id/transfer-ownership')
  @HttpCode(204)
  transferOwnership(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body(new ZodValidationPipe(TransferOwnershipInput))
    body: z.infer<typeof TransferOwnershipInput>,
  ) {
    return this.teams.transferOwnership(user.id, teamId, body.newOwnerId);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teams.delete(user.id, id);
  }
}
