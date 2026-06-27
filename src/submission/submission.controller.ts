import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import type { UserDto } from 'src/user/DTOs/user.dto';

import { SubmissionService } from './submission.service';
import {
  CreateSubmissionDto,
  SubmissionResponseDto,
} from './DTOs/submission.dto';
import { SubmissionMode } from './schemas/submission.schema';

@ApiTags('submissions')
@ApiBearerAuth('jwt-auth')
@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  /**
   * Runs code against a question's visible test cases only. Not scored.
   */
  @Post('run')
  @ApiOperation({ summary: 'Run code against visible test cases' })
  @ApiResponse({
    status: 201,
    description: 'Submission queued for judging',
    type: SubmissionResponseDto,
  })
  run(
    @Body(new ZodValidationPipe()) dto: CreateSubmissionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.submissionService.create(dto, user._id, SubmissionMode.RUN);
  }

  /**
   * Runs code against all of a question's test cases (including hidden ones) and records a score.
   */
  @Post()
  @ApiOperation({ summary: 'Submit code for full grading' })
  @ApiResponse({
    status: 201,
    description: 'Submission queued for judging',
    type: SubmissionResponseDto,
  })
  submit(
    @Body(new ZodValidationPipe()) dto: CreateSubmissionDto,
    @CurrentUser() user: UserDto,
  ) {
    return this.submissionService.create(dto, user._id, SubmissionMode.SUBMIT);
  }

  /**
   * Lists the current user's submissions, most recent first.
   */
  @Get('mine')
  @ApiOperation({ summary: 'Get my submissions' })
  @ApiResponse({ status: 200, type: [SubmissionResponseDto] })
  mine(@CurrentUser() user: UserDto) {
    return this.submissionService.findMine(user._id);
  }

  /**
   * Lists the current user's submissions for a specific question.
   */
  @Get('question/:questionId')
  @ApiOperation({ summary: 'Get my submissions for a question' })
  @ApiResponse({ status: 200, type: [SubmissionResponseDto] })
  byQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user: UserDto,
  ) {
    return this.submissionService.findByQuestion(questionId, user._id);
  }

  /**
   * Gets a single submission, polling Judge0 for any still-pending results.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get submission status/result' })
  @ApiResponse({ status: 200, type: SubmissionResponseDto })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  getOne(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return this.submissionService.getStatus(id, user._id);
  }
}
