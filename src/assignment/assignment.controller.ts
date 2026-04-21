import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import type { UserDto } from 'src/user/DTOs/user.dto';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';

import { AssignmentService } from './assignment.service';
import {
  AssignmentQueryDto,
  AssignmentResponseDto,
  CreateAssignmentDto,
  PublishAssignmentDto,
  UpdateAssignmentDto,
} from './DTOs/assignment.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('assignments')
@ApiBearerAuth('jwt-auth')
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  /**
   * Retrieves all assignments created by the current user (Teacher view).
   */
  @Get()
  @ApiOperation({ summary: 'Get assignments owned by current user' })
  @ApiResponse({
    status: 200,
    description: 'List of assignments owned by the user.',
    type: [AssignmentResponseDto],
  })
  getMyAssignments(
    @CurrentUser() user: UserDto,
    @Query(new ZodValidationPipe(AssignmentQueryDto)) query: AssignmentQueryDto,
  ) {
    return this.assignmentService.getByOwner(user._id, query);
  }

  /**
   * Retrieves all published assignments for a specific course (Student view).
   */
  @Get('course/:id')
  @ApiOperation({ summary: 'Get published assignments for a course' })
  @ApiResponse({
    status: 200,
    description: 'List of published assignments for the course.',
    type: [AssignmentResponseDto],
  })
  getCourseAssignments(
    @Param('id') courseId: string,
    @Query(new ZodValidationPipe(AssignmentQueryDto)) query: AssignmentQueryDto,
  ) {
    return this.assignmentService.getByCourse(courseId, query);
  }

  /**
   * Retrieves detailed information about a single assignment.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get assignment details' })
  @ApiResponse({
    status: 200,
    description: 'Assignment details.',
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  getOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.getOne(id, user._id);
  }

  /**
   * Creates a new assignment as a draft.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new assignment draft' })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiResponse({
    status: 201,
    description: 'The assignment draft has been created.',
    type: AssignmentResponseDto,
  })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: UserDto) {
    return this.assignmentService.create(dto, user._id);
  }

  /**
   * Updates an existing assignment draft.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update an assignment draft' })
  @ApiBody({ type: UpdateAssignmentDto })
  @ApiResponse({
    status: 200,
    description: 'The assignment draft has been updated.',
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Only drafts can be edited' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.updateDraft(id, dto, user._id);
  }

  /**
   * Publishes an assignment draft, making it visible to students.
   */
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish an assignment' })
  @ApiBody({ type: PublishAssignmentDto })
  @ApiResponse({
    status: 200,
    description: 'The assignment has been published.',
    type: AssignmentResponseDto,
  })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.publish(id, dto, user._id);
  }

  /**
   * Reverts a published assignment back to draft status.
   */
  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish an assignment' })
  @ApiResponse({
    status: 200,
    description: 'The assignment has been reverted to draft.',
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot unpublish active assignment' })
  unpublish(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.unpublish(id, user._id);
  }

  /**
   * Deletes an assignment (must be in draft status).
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an assignment draft' })
  @ApiResponse({ status: 204, description: 'Assignment deleted successfully' })
  @ApiResponse({ status: 400, description: 'Only drafts can be deleted' })
  remove(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.deleteDraft(id, user._id);
  }
}
