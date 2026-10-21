import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { SignupInputDto } from './DTOs/signupInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

import { ChangePasswordDto } from './DTOs/change-password.dto';
import { CurrentUser } from '../utils/decorators/create-param.decorator';
@ApiTags('auth')
@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiCookieAuth('refreshToken')
  async login(
    @Body() body: LoginInputDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.login(body, res);
  }

  @Post('/signup')
  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiCookieAuth('refreshToken')
  async signup(
    @Body() body: SignupInputDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.signup(body, res);
  }

  @Post('/refresh')
  @ApiOperation({ summary: 'Refresh access & refresh tokens (rotation)' })
  @ApiResponse({ status: 200, description: 'Tokens rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiCookieAuth('refreshToken')
  async refresh(@Res({ passthrough: true }) res: Response) {
    const req = res.req as { cookies?: Record<string, string> } | undefined;
    const refreshToken = req?.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    return await this.authService.refresh(refreshToken, res);
  }

  @Post('/logout')
  @ApiOperation({ summary: 'Revoke the current refresh session and clear its cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Res({ passthrough: true }) res: Response) {
    const req = res.req as { cookies?: Record<string, string> } | undefined;
    await this.authService.logout(res, req?.cookies?.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Change password and revoke all sessions' })
  changePassword(
    @CurrentUser('_id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword, res);
  }
}
