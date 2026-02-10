import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { SignupInputDto } from './DTOs/signupInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';

@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  async login(@Body() body: LoginInputDto) {
    console.log('done');
    const res = await this.authService.login(body);
    return res;
  }

  @Post('/signup')
  async signup(@Body() body: SignupInputDto) {
    const res = await this.authService.signup(body);
    return res;
  }

  @Post('/refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return await this.authService.refresh(body.refreshToken);
  }
}
