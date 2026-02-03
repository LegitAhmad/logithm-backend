import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { SignupInputDto } from './DTOs/signupInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiBody } from '@nestjs/swagger';

@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @ApiBody({ type: [LoginInputDto] })
  async login(@Body() body: LoginInputDto) {
    console.log('haha');
    const res = await this.authService.login(body);
    return res;
  }

  @Post('/signup')
  @ApiBody({ type: [SignupInputDto] })
  async signup(@Body() body: SignupInputDto) {
    const res = await this.authService.signup(body);
    return res;
  }
}
