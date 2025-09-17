import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { SignupInputDto } from './DTOs/signupInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';

@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @ApiProperty({ type: [LoginInputDto] })
  async login(@Body() body: LoginInputDto) {
    const res = await this.authService.login(body);
    return res;
  }

  @Post('/signup')
  @ApiProperty({ type: [SignupInputDto] })
  async signup(@Body() body: SignupInputDto) {
    const res = await this.authService.signup(body);
    return res;
  }
}
