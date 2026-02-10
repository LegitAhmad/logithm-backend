import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type AssignmentQuestionDocument = AssignmentQuestion & Document;

@Schema({ timestamps: true })
export class AssignmentQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Assignment', required: true })
  assignmentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  points: number;

  @Prop({ default: 1000, min: 1 })
  timeLimitMs: number;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: false })
  showHiddenTests: boolean;
}

export const AssignmentQuestionSchema =
  SchemaFactory.createForClass(AssignmentQuestion);
