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
  async signup(@Body() body: SignupInputDto) {
    return await this.authService.signup(body);
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate all refresh tokens' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout(res);
    return { message: 'Logged out successfully' };
  }
}
