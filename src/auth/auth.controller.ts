import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputDto, LoginInputValidator } from './DTOs/loginInput.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';

@Controller('/auth')
@UsePipes(ZodValidationPipe)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @ApiProperty({ type: [LoginInputDto] })
  async login(@Body() body: LoginInputDto) {
    const res = (await this.authService.login(body)) as {
      accessToken: string;
      requestToken: string;
    };
    return res;
  }
}
