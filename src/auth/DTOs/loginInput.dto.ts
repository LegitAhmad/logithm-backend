import { email, password, username } from 'src/user/DTOs/user.fields';
import z from 'zod';

export const LoginInputValidator = z.object({
  identifier: z.union([email, username]),
  password: password,
});

export type LoginInputDto = z.infer<typeof LoginInputValidator>;
