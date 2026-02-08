import { z } from 'zod';
import { zObjectId } from 'src/utils/zodHelpers';

export const CreateAssignmentSchema = z.object({
  title: z.string().min(3, 'Title too short').max(200),

  description: z.string().max(5000).optional(),

  courseId: zObjectId,

  questionIds: z.array(zObjectId).optional(),
});

export type CreateAssignmentDto = z.infer<typeof CreateAssignmentSchema>;

export const UpdateAssignmentSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),

    description: z.string().max(5000).optional(),

    questionIds: z.array(zObjectId).optional(),
  })
  .strict();

export type UpdateAssignmentDto = z.infer<typeof UpdateAssignmentSchema>;

export const PublishAssignmentSchema = z
  .object({
    startAt: z.string().datetime().optional(),

    deadline: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.startAt || !data.deadline) return true;

      return new Date(data.deadline) > new Date(data.startAt);
    },
    {
      message: 'Deadline must be after start time',
      path: ['deadline'],
    },
  );

export type PublishAssignmentDto = z.infer<typeof PublishAssignmentSchema>;

export const AssignmentQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'active', 'closed']).optional(),

  courseId: zObjectId.optional(),

  page: z.string().regex(/^\d+$/).transform(Number).default(1),

  limit: z.string().regex(/^\d+$/).transform(Number).default(20),
});

export type AssignmentQueryDto = z.infer<typeof AssignmentQuerySchema>;

export const AssignmentResponseSchema = z.object({
  _id: z.string(),

  title: z.string(),
  description: z.string().nullable(),

  courseId: z.string(),

  questionIds: z.array(z.string()),

  status: z.enum(['draft', 'published', 'active', 'closed']),

  publishedAt: z.string().nullable(),
  startAt: z.string().nullable(),
  deadline: z.string().nullable(),

  realStatus: z.enum(['draft', 'published', 'active', 'closed']),

  isActive: z.boolean(),
  isExpired: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AssignmentResponseDto = z.infer<typeof AssignmentResponseSchema>;
