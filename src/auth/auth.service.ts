import { Injectable } from '@nestjs/common';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { UserService } from '../user/user.service';
import { hasher } from 'src/config/hasher';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwtAccessSecret'),
        expiresIn: this.configService.get<string>('jwtAccessExpiresIn'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwtRefreshSecret'),
        expiresIn: this.configService.get<string>('jwtRefreshExpiresIn'),
      },
    );

    return { accessToken, refreshToken };
  }

  async login({ identifier, password }: LoginInputDto): Promise<any> {
    const user = await this.userService.findByIdentifier(identifier);

    if (!user) throw new Error('User not found');

    // TODO: make custom error for this
    if (!user?.passwordHash)
      throw new Error("User doesn't have a defined password");
    else if (!(await hasher.verify(password, user?.passwordHash)))
      throw new Error('Invalid password');
    else
      return {
        ...(await this.generateTokens(user.id as string)),
      };
  }
}
