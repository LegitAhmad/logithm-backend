import z from 'zod';
import {
  username,
  email,
  passwordHash,
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
  passwordHash: passwordHash,
  isVerified: isVerified,
});

export class UserDto extends createZodDto(UserValidator) {}

export const UpdateUserSchema = UserValidator.partial();
export class UpdateUserDto extends createZodDto(UserValidator.partial()) {}

export const UpdateAvatarSchema = z.object({
  avatarUrl: z.url(),
});

export class UpdateAvatarDto extends createZodDto(UpdateAvatarSchema) {}
