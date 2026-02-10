import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Question, QuestionSchema } from './schemas/question.schema';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import {
  AssignmentQuestion,
  AssignmentQuestionSchema,
} from './schemas/assignment-question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: AssignmentQuestion.name, schema: AssignmentQuestionSchema },
    ]),
  ],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
