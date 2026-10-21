import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from '../course/schemas/course.schema';
import { Assignment, AssignmentSchema } from '../assignment/schemas/assignment.schema';
import { Question, QuestionSchema } from '../question/schemas/question.schema';
import { ResourceAccessService } from './resource-access.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Course.name, schema: CourseSchema },
    { name: Assignment.name, schema: AssignmentSchema },
    { name: Question.name, schema: QuestionSchema },
  ])],
  providers: [ResourceAccessService],
  exports: [ResourceAccessService],
})
export class AccessModule {}
