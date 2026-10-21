import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    AccessModule,
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
    ]),
  ],

  providers: [AssignmentService],
  controllers: [AssignmentController],
})
export class AssignmentModule {}
