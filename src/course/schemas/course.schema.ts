import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true })
export class Course {
  // req info

  @Prop({
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 80,
  })
  name: string;

  @Prop({
    trim: true,
    maxlength: 500,
    default: "Welcome to this awesome course! Let's get codin'!",
  })
  description: string;

  @Prop({
    default: '',
  })
  bannerUrl: string;

  @Prop({
    required: true,
  })
  startDate: Date;

  @Prop({
    required: true,
  })
  endDate: Date;

  // users
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  creatorId: Types.ObjectId;

  @Prop({
    type: [Types.ObjectId],
    ref: 'User',
    default: [],
    validate: {
      validator: (v: Types.ObjectId[]) => v.length <= 5,
      message: 'A course can have at most 5 admins',
    },
  })
  admins: Types.ObjectId[];

  @Prop({
    type: [Types.ObjectId],
    ref: 'User',
    default: [],
  })
  students: Types.ObjectId[];

  @Prop({
    type: [Types.ObjectId],
    ref: 'Assignment',
    default: [],
  })
  assignments: Types.ObjectId[];

  @Prop({
    unique: true,
    sparse: true,
    uppercase: true,
    length: 8,
  })
  joinCode: string;

  @Prop({
    default: true,
  })
  isActive: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
