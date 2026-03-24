import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import { UpdateUserDto, UpdateUserSchema } from './DTOs/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  // Current user
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('_id') userId: string) {
    return this.users.findByIdSafe(userId);
  }

  // Public profile
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.users.findPublicProfile(id);
  }

  // Update profile
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser('_id') userId: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  // Favorite a course
  @UseGuards(JwtAuthGuard)
  @Patch('me/favorites')
  favoriteCourse(
    @CurrentUser('_id') userId: string,
    @Body('courseId') courseId: string,
  ) {
    return this.users.favoriteCourse(userId, courseId);
  }

  // Upload avatar
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateAvatar(
    @CurrentUser('_id') userId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    console.log('[user.controller.updateAvatar] request', {
      userId,
      hasFile: Boolean(file),
      mimetype: file?.mimetype,
      size: file?.buffer?.length,
    });
    return this.users.uploadAvatar(userId, file);
  }
}
