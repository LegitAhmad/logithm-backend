import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AssignmentDocument = HydratedDocument<Assignment>;

@Schema({ timestamps: true })
export class Assignment {
  // required shit
  @Prop({
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100,
  })
  title: string;

  @Prop({
    trim: true,
    maxlength: 1000,
    default: '',
  })
  description: string;

  // owner information
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  creator: Types.ObjectId;

  // optional course
  @Prop({
    type: Types.ObjectId,
    ref: 'Course',
    default: null,
  })
  course: Types.ObjectId | null;

  // timing
  @Prop({
    required: true,
  })
  startTime: Date;

  @Prop({
    required: true,
  })
  deadline: Date;

  // Questions linked
  @Prop({
    type: [Types.ObjectId],
    ref: 'Question',
    default: [],
  })
  questions: Types.ObjectId[];

  @Prop({
    unique: true,
    sparse: true,
    uppercase: true,
    length: 7,
  })
  assignmentCode: string;

  // Hide questions after deadline
  @Prop({
    default: false,
  })
  hideAfterDeadline: boolean;

  // Hide before start (usually true)
  @Prop({
    default: true,
  })
  hideBeforeStart: boolean;

  // Original assignment (if cloned)
  @Prop({
    type: Types.ObjectId,
    ref: 'Assignment',
    default: null,
  })
  parentAssignment: Types.ObjectId | null;

  @Prop({
    default: true,
  })
  isActive: boolean;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
