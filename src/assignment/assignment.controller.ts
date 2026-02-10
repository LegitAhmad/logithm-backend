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
import {
  CreateAssignmentDto,
  PublishAssignmentDto,
  UpdateAssignmentDto,
} from './DTOs/assignment.dto';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiBearerAuth('jwt-auth')
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  // Teacher: all own assignments
  @Get()
  @UseGuards(JwtAuthGuard)
  getMyAssignments(@CurrentUser() user: UserDto) {
    return this.assignmentService.getByOwner(user._id);
  }

  // Student: course assignments
  @Get('course/:id')
  @UseGuards(JwtAuthGuard)
  getCourseAssignments(@Param('id') courseId: string) {
    return this.assignmentService.getByCourse(courseId);
  }

  // Single assignment
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.getOne(id, user._id);
  }

  // Create draft
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateAssignmentDto })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: UserDto) {
    return this.assignmentService.create(dto, user._id);
  }

  // Update draft
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: UpdateAssignmentDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.updateDraft(id, dto, user._id);
  }

  // Publish
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: PublishAssignmentDto })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishAssignmentDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.assignmentService.publish(id, dto, user._id);
  }

  // Revert to draft
  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  unpublish(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.unpublish(id, user._id);
  }

  // Delete (only draft)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.assignmentService.deleteDraft(id, user._id);
  }
}
