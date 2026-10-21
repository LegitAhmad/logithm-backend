import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash, randomBytes } from 'crypto';
import { LoginInputDto } from './DTOs/loginInput.dto';
import { UserService } from '../user/user.service';
import { hasher } from 'src/config/hasher';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupInputDto } from './DTOs/signupInput.dto';

type RefreshClaims = { sub: string; jti: string; ver: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getCookieOptions() {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('nodeEnv') === 'production',
      sameSite: 'lax' as const,
      maxAge: this.configService.get<number>('jwtRefreshCookieMaxAge') ?? 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  private async issueTokens(userId: string, version: number) {
    const accessToken = await this.jwtService.signAsync({ sub: userId, ver: version }, {
      secret: this.configService.get<string>('jwtAccessSecret'),
      expiresIn: this.configService.get<string>('jwtAccessExpiresIn'),
    } as JwtSignOptions);
    const refreshToken = await this.jwtService.signAsync({ sub: userId, ver: version, jti: randomBytes(32).toString('hex') }, {
      secret: this.configService.get<string>('jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('jwtRefreshExpiresIn'),
    } as JwtSignOptions);
    const claims = this.jwtService.decode<{ exp: number }>(refreshToken);
    if (!claims || !Number.isFinite(claims.exp)) throw new Error('Refresh token expiry is required');
    return { accessToken, refreshToken, session: { tokenHash: createHash('sha256').update(refreshToken).digest('hex'), expiresAt: new Date(claims.exp * 1000) } };
  }

  async generateTokens(userId: string, res: Response, version = 0) {
    const tokens = await this.issueTokens(userId, version);
    await this.userService.addRefreshSession(userId, tokens.session, version);
    res.cookie('refreshToken', tokens.refreshToken, this.getCookieOptions());
    return { accessToken: tokens.accessToken };
  }

  private async verifyRefresh(token: string): Promise<RefreshClaims> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshClaims>(token, { secret: this.configService.get<string>('jwtRefreshSecret'), algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub) || typeof payload.jti !== 'string' || !/^[a-f\d]{64}$/.test(payload.jti) || !Number.isSafeInteger(payload.ver) || payload.ver < 0) throw new Error('Invalid refresh claims');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async refresh(previousToken: string, res: Response) {
    const claims = await this.verifyRefresh(previousToken);
    const tokens = await this.issueTokens(claims.sub, claims.ver);
    await this.userService.rotateRefreshSession(claims.sub, createHash('sha256').update(previousToken).digest('hex'), tokens.session, claims.ver);
    res.cookie('refreshToken', tokens.refreshToken, this.getCookieOptions());
    return { accessToken: tokens.accessToken };
  }

  async login({ identifier, password }: LoginInputDto, res: Response) {
    const user = await this.userService.findByIdentifier(identifier);
    if (!user?.passwordHash || !(await hasher.verify(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    return this.generateTokens(user._id.toString(), res, user.authVersion ?? 0);
  }

  async signup({ firstName, lastName, email, password }: SignupInputDto, res: Response) {
    const existing = await this.userService.findByIdentifier(email);
    if (existing) throw new ConflictException('User already exists');
    const user = await this.userService.create({ firstName, lastName, email, password });
    return this.generateTokens(user._id.toString(), res, user.authVersion ?? 0);
  }

  async logout(res: Response, refreshToken?: string) {
    res.clearCookie('refreshToken', this.getCookieOptions());
    if (!refreshToken) return;
    let claims: RefreshClaims;
    try { claims = await this.verifyRefresh(refreshToken); } catch { return; }
    await this.userService.revokeRefreshSession(claims.sub, createHash('sha256').update(refreshToken).digest('hex'));
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, res: Response) {
    await this.userService.changePassword(userId, currentPassword, newPassword);
    res.clearCookie('refreshToken', this.getCookieOptions());
    return { message: 'Password changed. Log in with your new password.' };
  }
}
