import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

  async generateTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync({ sub: userId }, {
      secret: this.configService.get<string>('jwtAccessSecret'),
      expiresIn: this.configService.get<string>('jwtAccessExpiresIn'),
    } as JwtSignOptions);

    const refreshToken = await this.jwtService.signAsync({ sub: userId }, {
      secret: this.configService.get<string>('jwtRefreshSecret'),
      expiresIn: this.configService.get<string>('jwtRefreshExpiresIn'),
    } as JwtSignOptions);

    return { accessToken, refreshToken };
  }

  async login({ identifier, password }: LoginInputDto) {
    const user = await this.userService.findByIdentifier(identifier);

    if (!user) throw new UnauthorizedException('Invalid Credentials');

    // TODO: make custom error for this
    if (!user?.passwordHash)
      throw new UnauthorizedException(
        'User Has Not Configured Email Authentication',
      );
    else if (!(await hasher.verify(password, user?.passwordHash)))
      throw new UnauthorizedException('Invalid Password');
    else
      return {
        ...(await this.generateTokens(user.id as string)),
      };
  }

  async signup({ email, password }: SignupInputDto) {
    const user = await this.userService.findByIdentifier(email);

    if (user) throw new ConflictException('User Already Exists');

    return await this.userService.create({ email, password });
  }
}
