import z from 'zod';
import { username, email, name, passwordHash, isVerified } from './user.fields';

export const UserValidator = z.object({
  username: username,
  email: email,
  name: name,
  passwordHash: passwordHash,
  isVerified: isVerified,
});

export type UserDto = z.infer<typeof UserValidator>;
