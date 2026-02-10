import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { zDateString, zObjectId } from 'src/utils/zodHelpers';
import { z } from 'zod';

// --- BASE SCHEMA (Common Fields) ---
const BaseCourse = z.object({
  _id: zObjectId,
  name: z.string().min(3).max(80),
  description: z.string().max(500),
  bannerUrl: z.string(),
  startDate: zDateString,
  endDate: zDateString,
  creatorId: z.string(), // ID as string
  isActive: z.boolean(),
  createdAt: zDateString,
});

// --- 1. RESPONSE DTOS (Outgoing) ---

// For Pagination: Summary
export const CourseSummarySchema = BaseCourse;
export class CourseSummaryResponseDto extends createZodDto(
  CourseSummarySchema,
) {}

// For Single View: Full version
export const CourseDetailSchema = BaseCourse.extend({
  joinCode: z.string().length(8).optional(),
  admins: z.array(z.string()),
});
export class CourseResponseDto extends createZodDto(CourseDetailSchema) {}

// Paginated Wrapper using the Summary DTO
export class PaginatedCourseResponseDto {
  @ApiProperty() limit: number;
  @ApiProperty() offset: number;
  @ApiProperty({ type: [CourseSummaryResponseDto] })
  data: CourseSummaryResponseDto[];
}

// --- 2. REQUEST DTOS (Incoming) ---

export const CreateCourseSchema = BaseCourse.omit({
  _id: true,
  creatorId: true,
  isActive: true,
  createdAt: true,
});

export class CreateCourseDto extends createZodDto(CreateCourseSchema) {}
export class UpdateCourseDto extends createZodDto(
  CreateCourseSchema.partial(),
) {}

// Pagination Query
export const CoursePaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export class CoursePaginationDto extends createZodDto(CoursePaginationSchema) {}
