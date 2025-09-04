import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ trim: true, minLength: 3, maxLength: 24 })
  name: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    minLength: 3,
    maxLength: 16,
    unique: true,
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

export const UserSchema = SchemaFactory.createForClass(User);
