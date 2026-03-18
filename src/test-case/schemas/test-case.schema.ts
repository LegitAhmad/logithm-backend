import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TestCaseDocument = HydratedDocument<TestCase>;

@Schema({ timestamps: true })
export class TestCase {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Question', required: true, index: true })
  questionId: Types.ObjectId;

  @Prop({ type: [Object], required: true })
  inputs: any[];

  @Prop({ type: Object, required: true })
  expectedOutput: any;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop()
  weight?: number;

  @Prop()
  explanation?: string;
}

export const TestCaseSchema = SchemaFactory.createForClass(TestCase);
