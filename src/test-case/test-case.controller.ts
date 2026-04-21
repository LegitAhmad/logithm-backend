import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { Types } from 'mongoose';
import { TestCaseService } from './test-case.service';
import { CreateTestCaseDto } from './DTOs/test-case.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('test-cases')
@Controller('test-cases')
export class TestCaseController {
  constructor(private readonly service: TestCaseService) {}

  /**
   * Creates a new test case for a specific question.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new test case' })
  @ApiResponse({ status: 201, description: 'Test case created successfully' })
  create(@Body() dto: CreateTestCaseDto) {
    return this.service.create(dto);
  }

  /**
   * Retrieves all test cases associated with a specific question.
   */
  @Get('question/:questionId')
  @ApiOperation({ summary: 'Get test cases for a question' })
  @ApiResponse({ status: 200, description: 'List of test cases returned' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  getByQuestion(@Param('questionId') id: string) {
    return this.service.findByQuestion(new Types.ObjectId(id));
  }

  /**
   * Deletes a specific test case by its ID.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a test case' })
  @ApiResponse({ status: 200, description: 'Test case deleted successfully' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  delete(@Param('id') id: string) {
    return this.service.delete(new Types.ObjectId(id));
  }
}
