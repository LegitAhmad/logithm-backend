import z from 'zod';

export const CoursePaginationValidator = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(1).optional(),
});

export type CoursePaginationDto = z.infer<typeof CoursePaginationValidator>;
