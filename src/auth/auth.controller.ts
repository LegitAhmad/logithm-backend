import { Body, Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginInputValidator } from './DTOs/loginInput.dto';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Get('/login')
  async login(@Body() body: any) {
    const parsedBody = LoginInputValidator.parse(body);
    const res = await this.authService.login(parsedBody);
    return res;
  }
}
