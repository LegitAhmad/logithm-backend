import { createZodDto } from 'nestjs-zod';
import { email, password, username } from 'src/user/DTOs/user.fields';
import z from 'zod';

export const LoginInputValidator = z.object({
  identifier: z.union([email, username]),
  password: password,
});

export class LoginInputDto extends createZodDto(LoginInputValidator) {}
// export type LoginInputDto = z.infer<typeof LoginInputValidator>;
