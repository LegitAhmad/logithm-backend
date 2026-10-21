import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './schemas/question.schema';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import {
  Assignment,
  AssignmentSchema,
} from '../assignment/schemas/assignment.schema';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    AccessModule,
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Assignment.name, schema: AssignmentSchema },
    ]),
  ],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
