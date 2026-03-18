import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { zObjectId } from 'src/utils/zodHelpers';

export const CreateTestCaseSchema = z.object({
  questionId: zObjectId,

  inputs: z.array(z.any()).min(1),

  expectedOutput: z.any(),

  isPublic: z.boolean().default(false),

  weight: z.number().positive().optional(),

  explanation: z.string().max(1000).optional(),
});

export class CreateTestCaseDto extends createZodDto(CreateTestCaseSchema) {}
