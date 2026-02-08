// assignments.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type AssignmentDocument = Assignment & Document;

export enum AssignmentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Schema({ timestamps: true })
export class Assignment {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  // For now required, later optional
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Question' }])
  questionIds: Types.ObjectId[];

  @Prop({
    enum: AssignmentStatus,
    default: AssignmentStatus.DRAFT,
  })
  status: AssignmentStatus;

  // When made public
  @Prop()
  publishedAt?: Date;

  // When students can start
  @Prop()
  startAt?: Date;

  // Deadline
  @Prop()
  deadline?: Date;

  // Who created it
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
