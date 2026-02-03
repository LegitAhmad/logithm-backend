import z from 'zod';
import { username, email, name, passwordHash, isVerified } from './user.fields';
import { zObjectId } from 'src/utils/zodHelpers';

export const UserValidator = z.object({
  _id: zObjectId,
  username: username,
  email: email,
  name: name,
  passwordHash: passwordHash,
  isVerified: isVerified,
});

export type UserDto = z.infer<typeof UserValidator>;
