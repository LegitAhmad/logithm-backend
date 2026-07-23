import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { UserService } from '../user/user.service';
import { hasher } from 'src/config/hasher';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupInputDto } from './DTOs/signupInput.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getCookieOptions() {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge:
        this.configService.get<number>('jwtRefreshCookieMaxAge') ??
        7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  async generateTokens(userId: string, res: Response) {
    const accessToken = await this.jwtService.signAsync({ sub: userId }, {
      secret: this.configService.get<string>('jwtAccessSecret'),
      expiresIn: this.configService.get<string>('jwtAccessExpiresIn'),
    } as JwtSignOptions);

    const refreshToken = await this.jwtService.signAsync({ sub: userId }, {
      secret: this.configService.get<string>('jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('jwtRefreshExpiresIn'),
    } as JwtSignOptions);

    res.cookie('refreshToken', refreshToken, this.getCookieOptions());

    return { accessToken };
  }

  async refresh(oldRefreshToken: string, res: Response) {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.get<string>('jwtRefreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub;
    const user = await this.userService.findByIdentifier(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(userId, res);
  }

  async login({ identifier, password }: LoginInputDto, res: Response) {
    const user = await this.userService.findByIdentifier(identifier);

    if (!user) throw new UnauthorizedException('Invalid Credentials');

    if (!user?.passwordHash)
      throw new UnauthorizedException(
        'User Has Not Configured Email Authentication',
      );
    else if (!(await hasher.verify(password, user?.passwordHash)))
      throw new UnauthorizedException('Invalid Password');
    else
      return {
        ...(await this.generateTokens(user._id.toString(), res)),
      };
  }

  async signup({ email, password }: SignupInputDto) {
    const user = await this.userService.findByIdentifier(email);

    if (user) throw new ConflictException('User Already Exists');

    return await this.userService.create({ email, password });
  }

  logout(res: Response) {
    res.clearCookie('refreshToken', this.getCookieOptions());
  }
}
