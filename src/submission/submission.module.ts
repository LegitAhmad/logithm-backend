import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Question, QuestionSchema } from '../question/schemas/question.schema';
import { Submission, SubmissionSchema } from './schemas/submission.schema';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { PistonClientService } from './execution/piston-client.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService, PistonClientService],
})
export class SubmissionModule {}
