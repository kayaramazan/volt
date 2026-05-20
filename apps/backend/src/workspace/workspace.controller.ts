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
import { CreateWorkspaceInput, RenameWorkspaceInput } from '@volt/shared';
import { z } from 'zod';

import { WorkspaceService } from './workspace.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

const MoveToTeamInput = z.object({ teamId: z.string().uuid() });

@Controller('workspaces')
@UseGuards(SessionGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.workspaces.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateWorkspaceInput))
    input: { name: string; teamId?: string; id?: string },
  ) {
    return this.workspaces.create(user.id, input.name, input.teamId, input.id);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RenameWorkspaceInput.pick({ name: true })))
    input: { name: string },
  ) {
    return this.workspaces.rename(user.id, id, input.name);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workspaces.softDelete(user.id, id);
  }

  @Post(':id/move-to-team')
  moveToTeam(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MoveToTeamInput)) input: { teamId: string },
  ) {
    return this.workspaces.moveToTeam(user.id, id, input.teamId);
  }
}
