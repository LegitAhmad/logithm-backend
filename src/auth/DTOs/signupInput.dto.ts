import { createZodDto } from 'nestjs-zod';
import { email, password } from 'src/user/DTOs/user.fields';
import z from 'zod';

export const signupInputValidator = z.object({
  email: email,
  password: password,
});

export class SignupInputDto extends createZodDto(signupInputValidator) {}
