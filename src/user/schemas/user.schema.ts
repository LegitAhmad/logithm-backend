import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class RefreshSession {
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;
}
const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);

@Schema({ timestamps: true })
export class User {
  @Prop({ trim: true, minLength: 1, maxLength: 40 })
  firstName: string;

  @Prop({ trim: true, minLength: 1, maxLength: 40 })
  lastName: string;

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

  @Prop({ trim: true, required: false })
  passwordHash: string;

  @Prop({ type: Number, default: 0, select: false })
  authVersion: number;

  @Prop({ type: [RefreshSessionSchema], default: [], select: false })
  refreshSessions: RefreshSession[];

  @Prop({ trim: true, required: false })
  avatarUrl?: string;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'Course',
    default: [],
  })
  favorites: Types.ObjectId[];

  @Prop({ required: true, default: false })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
