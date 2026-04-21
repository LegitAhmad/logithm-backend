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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  /**
   * Returns the profile of the currently authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  me(@CurrentUser('_id') userId: string) {
    return this.users.findByIdSafe(userId);
  }

  /**
   * Returns a user's public profile (limited information).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get public profile by ID or username' })
  @ApiResponse({ status: 200, description: 'Public profile returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getById(@Param('id') id: string) {
    return this.users.findPublicProfile(id);
  }

  /**
   * Updates the current user's profile information.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  updateMe(
    @CurrentUser('_id') userId: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  /**
   * Adds a course to the current user's favorites.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me/favorites')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Favorite a course' })
  @ApiResponse({ status: 200, description: 'Course added to favorites' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  favoriteCourse(
    @CurrentUser('_id') userId: string,
    @Body('courseId') courseId: string,
  ) {
    return this.users.favoriteCourse(userId, courseId);
  }

  /**
   * Uploads and updates the current user's avatar image.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  @ApiBearerAuth('jwt-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or upload error' })
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
