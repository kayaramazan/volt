import { Body, Controller, Delete, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { UserService } from './user.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';

const UpdateProfileInput = z.object({
  name: z.string().min(1).max(120).optional(),
});

@Controller('users/me')
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(UpdateProfileInput))
    input: z.infer<typeof UpdateProfileInput>,
  ) {
    return this.users.updateProfile(user.id, input);
  }

  @Delete()
  @HttpCode(204)
  delete(@CurrentUser() user: RequestUser) {
    return this.users.deleteAccount(user.id);
  }
}
