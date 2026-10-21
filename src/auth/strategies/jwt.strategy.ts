import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { UserDto } from 'src/user/DTOs/user.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
  ) {
    const secret = config.get<string>('jwtAccessSecret');
    if (!secret) throw new Error('JWT Access Secret not defined in config');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; ver?: number }): Promise<UserDto> {
    const user = await this.userService.findByIdentifier(payload.sub);
    if (!user || (payload.ver ?? 0) !== (user.authVersion ?? 0)) throw new UnauthorizedException();
    const { passwordHash: _passwordHash, authVersion: _authVersion, refreshSessions: _sessions, ...cleanUser } = user.toObject();
    const favorites = (cleanUser.favorites ?? []).map((favorite) =>
      favorite.toString(),
    );

    return { ...cleanUser, _id: payload.sub, favorites };
  }
}
