import z from 'zod';

export const PaginationValidator = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(1).optional(),
});

export type PaginationDto = z.infer<typeof PaginationValidator>;
