import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChangePasswordInput, LoginInput, RegisterInput } from '@volt/shared';

import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { lucia } from './lucia';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import {
  CurrentUser,
  type RequestUser,
  type RequestWithUser,
} from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body(new ZodValidationPipe(RegisterInput)) input: RegisterInput) {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginInput)) input: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, user, deviceId } = await this.auth.login(input);
    const cookie = lucia.createSessionCookie(sessionId);
    res.setHeader('Set-Cookie', cookie.serialize());
    return {
      sessionId,
      user: { id: user.id, email: user.email, name: user.name },
      device: deviceId ? { id: deviceId, label: input.device!.label } : undefined,
    };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) {
      await this.auth.logout(req.sessionId);
    }
    res.setHeader('Set-Cookie', lucia.createBlankSessionCookie().serialize());
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@CurrentUser() user: RequestUser, @Req() req: RequestWithUser) {
    return this.auth.me(user.id, req.deviceId ?? null);
  }

  @Post('change-password')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ChangePasswordInput)) input: ChangePasswordInput,
  ) {
    await this.auth.changePassword(user.id, input);
  }

  @Delete('devices/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revokeDevice(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.auth.revokeDevice(user.id, id);
  }
}
