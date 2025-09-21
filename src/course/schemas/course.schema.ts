import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true })
export class Course {
  @Prop({ trim: true, minLength: 3, maxLength: 50 })
  name: string;

  @Prop({
    required: false,
    lowercase: true,
    trim: true,
    minLength: 3,
    maxLength: 16,
    unique: true,
    sparse: true,
    match: /^[a-zA-Z0-9_]+$/,
  })
  username: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minLength: 5,
    maxLength: 254,
  })
  email: string;

  @Prop({ trim: true })
  passwordHash: string;

  @Prop({ required: true, default: false })
  isVerified: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
