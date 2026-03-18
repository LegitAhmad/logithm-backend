import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TestCase } from './schemas/test-case.schema';
import { CreateTestCaseDto } from './DTOs/test-case.dto';

@Injectable()
export class TestCaseService {
  constructor(
    @InjectModel(TestCase.name)
    private testCaseModel: Model<TestCase>,
  ) {}

  async create(dto: CreateTestCaseDto) {
    return this.testCaseModel.create(dto);
  }

  async findByQuestion(questionId: Types.ObjectId) {
    return this.testCaseModel.find({ questionId }).lean();
  }

  async delete(id: Types.ObjectId) {
    const deleted = await this.testCaseModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Test case not found');
    return { success: true };
  }
}
