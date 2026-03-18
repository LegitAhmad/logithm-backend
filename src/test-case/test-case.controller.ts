import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { Types } from 'mongoose';
import { TestCaseService } from './test-case.service';
import { CreateTestCaseDto } from './DTOs/test-case.dto';

@Controller('test-cases')
export class TestCaseController {
  constructor(private readonly service: TestCaseService) {}

  @Post()
  create(@Body() dto: CreateTestCaseDto) {
    return this.service.create(dto);
  }

  @Get('question/:questionId')
  getByQuestion(@Param('questionId') id: string) {
    return this.service.findByQuestion(new Types.ObjectId(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(new Types.ObjectId(id));
  }
}
