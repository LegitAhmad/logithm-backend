import z from 'zod';
import {
  username,
  email,
  isVerified,
  firstName,
  lastName,
} from './user.fields';
import { zObjectId } from 'src/utils/zodHelpers';
import { createZodDto } from 'nestjs-zod';

export const UserValidator = z.object({
  _id: zObjectId,
  username: username,
  email: email,
  firstName: firstName,
  lastName: lastName,
  avatarUrl: z.url().optional(),
  favorites: z.array(zObjectId).default([]),
  isVerified: isVerified,
});

export class UserDto extends createZodDto(UserValidator) {}

export interface SafeUserProfile {
  _id: string;
  username?: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  favorites: string[];
  isVerified: boolean;
  avatarUploadEnabled: boolean;
}

export const UpdateUserSchema = UserValidator.pick({ username: true, firstName: true, lastName: true }).partial().strict();
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

export const UpdateAvatarSchema = z.object({
  avatarUrl: z.url(),
});

export class UpdateAvatarDto extends createZodDto(UpdateAvatarSchema) {}

export const FavoriteCourseSchema = z.object({
  courseId: zObjectId,
});

export class FavoriteCourseDto extends createZodDto(FavoriteCourseSchema) {}
