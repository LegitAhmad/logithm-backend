import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const TestCaseValidator = z.object({
  input: z.string().min(1),
  expectedOutput: z.string().min(1),
  isHidden: z.boolean().optional(),
  points: z.number().min(1).optional(),
});

const CheckerValidator = z.object({
  type: z.enum(['exact', 'float', 'custom']),
  tolerance: z.number().positive().optional(),
  code: z.string().optional(),
});

export const CreateQuestionValidator = z.object({
  title: z.string().min(3).max(100),
  descriptionMd: z.string().min(10),

  functionSignature: z.string().min(3),

  constraints: z.string().optional(),

  testCases: z.array(TestCaseValidator).min(1),

  checker: CheckerValidator.optional(),

  referenceSolution: z
    .object({
      language: z.string(),
      code: z.string().min(10),
    })
    .optional(),

  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),

  tags: z.array(z.string()).optional(),

  isPublic: z.boolean().optional(),
});

export const UpdateQuestionValidator = CreateQuestionValidator.partial();

export class CreateQuestionDto extends createZodDto(CreateQuestionValidator) {}

export class UpdateQuestionDto extends createZodDto(UpdateQuestionValidator) {}

// Response DTOs for safe data exposure
const PublicTestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  points: z.number(),
});

export const QuestionResponseSchema = z.object({
  _id: z.string(),
  title: z.string(),
  descriptionMd: z.string(),
  functionSignature: z.string(),
  constraints: z.string().optional(),
  testCases: z.array(PublicTestCaseSchema),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class QuestionResponseDto extends createZodDto(QuestionResponseSchema) {}

// For owners: includes hidden tests and reference solution
export const QuestionOwnerResponseSchema = QuestionResponseSchema.extend({
  testCases: z.array(TestCaseValidator),
  checker: CheckerValidator.optional(),
  referenceSolution: z
    .object({
      language: z.string(),
      code: z.string(),
    })
    .optional(),
});

export class QuestionOwnerResponseDto extends createZodDto(
  QuestionOwnerResponseSchema,
) {}

