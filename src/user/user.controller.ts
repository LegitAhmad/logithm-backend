import { Controller, Get, Patch, Param, UseGuards, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  UpdateAvatarSchema,
  UpdateUserDto,
  UpdateUserSchema,
  UserDto,
} from './DTOs/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  // Public profile
  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.users.findPublicProfile(username);
  }

  // Current user
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.findByIdentifier(userId);
  }

  // Update profile
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  // Upload avatar
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  async updateAvatar(
    @CurrentUser('id') user: UserDto,
    @Body(new ZodValidationPipe(UpdateAvatarSchema)) avatarUrl: string,
  ) {
    return this.users.updateAvatar(user._id, avatarUrl);
  }
}
