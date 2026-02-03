import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service'; // adjust path
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

  async validate(payload: { sub: string }): Promise<UserDto> {
    const user = await this.userService.findByIdentifier(payload.sub);
    console.log(user);
    if (!user) throw new UnauthorizedException();
    const cleanUser = user.toObject();

    console.log(payload.sub);
    return { ...cleanUser, _id: payload.sub };
  }
}
