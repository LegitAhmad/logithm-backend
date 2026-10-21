import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { password } from '../../user/DTOs/user.fields';
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: password,
}).strict();
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
