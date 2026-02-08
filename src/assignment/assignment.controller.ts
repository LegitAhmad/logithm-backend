import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import type { UserDto } from 'src/user/DTOs/user.dto';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';

import { AssignmentService } from './assignment.service';
import type {
  CreateAssignmentDto,
  PublishAssignmentDto,
  UpdateAssignmentDto,
} from './DTOs/assignment.dto';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  // Teacher: all own assignments
  @Get()
  getMyAssignments(@CurrentUser() user: UserDto) {
    return this.assignmentService.getByOwner(user._id);
  }

  // Student: course assignments
  @Get('course/:id')
  getCourseAssignments(@Param('id') courseId: string) {
    return this.assignmentService.getByCourse(courseId);
  }

  // Single assignment
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.getOne(id, user._id);
  }

  // Create draft
  @Post()
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: UserDto) {
    return this.assignmentService.create(dto, user._id);
  }

  // Update draft
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.updateDraft(id, dto, user._id);
  }

  // Publish
  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() dto: PublishAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.publish(id, dto, user._id);
  }

  // Revert to draft
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.unpublish(id, user._id);
  }

  // Delete (only draft)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.deleteDraft(id, user._id);
  }
}
