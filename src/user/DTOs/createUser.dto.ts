import z from 'zod';
import { email, password } from './user.fields';

export const CreateUserValidator = z.object({
  email: email,
  password: password,
});

export type CreateUserDto = z.infer<typeof CreateUserValidator>;
