import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { ZodValidationPipe } from 'nestjs-zod';
import { QuestionService } from './question.service';
import { CreateQuestionDto, UpdateQuestionDto } from './DTOs/question.dto';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import type { UserDto } from 'src/user/DTOs/user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  /**
   * Creates a new coding question.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created successfully' })
  async create(
    @Body(new ZodValidationPipe())
    dto: CreateQuestionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.questionService.create(dto, user._id);
  }

  /**
   * Retrieves all questions owned by the current user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Get questions owned by current user' })
  @ApiResponse({ status: 200, description: 'List of owned questions' })
  async getMine(@CurrentUser() user: UserDto) {
    return this.questionService.findByOwner(user._id);
  }

  /**
   * Retrieves all questions for a specific assignment.
   */
  @Get('assignment/:assignmentId')
  @ApiOperation({ summary: 'Get questions for an assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of questions for the assignment',
  })
  async getByAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user?: UserDto,
  ) {
    return this.questionService.findByAssignment(assignmentId, user?._id);
  }

  /**
   * Retrieves a single question by its ID.
   * Public questions are accessible to everyone; private ones only to the owner.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get question details' })
  @ApiResponse({ status: 200, description: 'Question details returned' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  @ApiResponse({ status: 403, description: 'Question is private' })
  async getOne(@Param('id') id: string, @CurrentUser() user?: UserDto) {
    return this.questionService.findOne(id, user?._id);
  }

  /**
   * Updates an existing question.
   * Only the owner can update the question.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Update a question' })
  @ApiResponse({ status: 200, description: 'Question updated successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can update' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe())
    dto: UpdateQuestionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.questionService.update(id, dto, user._id);
  }

  /**
   * Deletes a question.
   * Only the owner can delete the question.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({ summary: 'Delete a question' })
  @ApiResponse({ status: 200, description: 'Question deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can delete' })
  async remove(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.questionService.remove(id, user._id);
  }
}
