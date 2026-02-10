import { createZodDto } from 'nestjs-zod';
import { email, password } from 'src/user/DTOs/user.fields';
import z from 'zod';

export const signupInputValidator = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    // Validation: Only letters, spaces, hyphens, and apostrophes
    .regex(/^[a-zA-Z]+(?:[-' ][a-zA-Z]+)*$/, 'Invalid name format')
    // Transformation: Capitalize first letter of each word
    .transform((val) =>
      val.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase()),
    ),
  lastName: z
    .string()
    .trim()
    .min(1, 'last name is required')
    // Validation: Only letters, spaces, hyphens, and apostrophes
    .regex(/^[a-zA-Z]+(?:[-' ][a-zA-Z]+)*$/, 'Invalid name format')
    // Transformation: Capitalize first letter of each word
    .transform((val) =>
      val.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase()),
    ),
  email: email,
  password: password,
});

export class SignupInputDto extends createZodDto(signupInputValidator) {}
