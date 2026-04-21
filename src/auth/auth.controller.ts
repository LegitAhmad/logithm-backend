import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { SignupInputDto } from './DTOs/signupInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates a user and returns access and refresh tokens.
   */
  @Post('/login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginInputDto) {
    const res = await this.authService.login(body);
    return res;
  }

  /**
   * Registers a new user.
   */
  @Post('/signup')
  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signup(@Body() body: SignupInputDto) {
    const res = await this.authService.signup(body);
    return res;
  }

  /**
   * Generates a new access token using a valid refresh token.
   */
  @Post('/refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() body: { refreshToken: string }) {
    return await this.authService.refresh(body.refreshToken);
  }
}
