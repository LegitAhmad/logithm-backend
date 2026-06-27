import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { zObjectId } from 'src/utils/zodHelpers';

export const CreateSubmissionValidator = z.object({
  questionId: zObjectId,
  language: z.string().min(1),
  code: z.string().min(1),
  assignmentId: zObjectId.optional(),
});

export class CreateSubmissionDto extends createZodDto(
  CreateSubmissionValidator,
) {}

const TestCaseResultResponseSchema = z.object({
  testCaseIndex: z.number(),
  isHidden: z.boolean(),
  points: z.number(),
  passed: z.boolean(),
  verdict: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  compileOutput: z.string().optional(),
  time: z.string().optional(),
  memory: z.number().optional(),
});

export const SubmissionResponseSchema = z.object({
  _id: z.string(),
  questionId: z.string(),
  assignmentId: z.string().optional(),
  language: z.string(),
  mode: z.enum(['run', 'submit']),
  status: z.enum(['judging', 'completed']),
  results: z.array(TestCaseResultResponseSchema),
  score: z.number(),
  maxScore: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class SubmissionResponseDto extends createZodDto(
  SubmissionResponseSchema,
) {}
