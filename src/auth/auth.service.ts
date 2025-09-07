import { Injectable, NotImplementedException } from '@nestjs/common';
import { LoginInputDto } from './DTOs/loginInput.dto';

@Injectable()
export class AuthService {
  constructor() {}
  async login({ identifier, password }: LoginInputDto) {
    throw new NotImplementedException();
  }
}
