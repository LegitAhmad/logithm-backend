import { Module } from '@nestjs/common';
import { TestCaseController } from './test-case.controller';
import { TestCaseService } from './test-case.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TestCase, TestCaseSchema } from './schemas/test-case.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestCase.name, schema: TestCaseSchema },
    ]),
  ],
  controllers: [TestCaseController],
  providers: [TestCaseService],
})
export class TestCaseModule {}
