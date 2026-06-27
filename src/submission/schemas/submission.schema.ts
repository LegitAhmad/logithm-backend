import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export interface SubmissionTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type SubmissionDocument = HydratedDocument<Submission> &
  SubmissionTimestamps;

export enum SubmissionMode {
  RUN = 'run',
  SUBMIT = 'submit',
}

export enum SubmissionStatus {
  JUDGING = 'judging',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true, _id: false })
export class TestCaseResult {
  @Prop({ required: true })
  testCaseIndex: number;

  @Prop({ required: true })
  expectedOutput: string;

  @Prop({ default: false })
  isHidden: boolean;

  @Prop({ default: 1 })
  points: number;

  @Prop({ default: false })
  passed: boolean;

  @Prop()
  verdict?: string;

  @Prop()
  stdout?: string;

  @Prop()
  stderr?: string;

  @Prop()
  compileOutput?: string;

  @Prop()
  time?: string;

  @Prop()
  memory?: number;
}

export const TestCaseResultSchema =
  SchemaFactory.createForClass(TestCaseResult);

@Schema({ timestamps: true })
export class Submission {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Assignment' })
  assignmentId?: Types.ObjectId;

  @Prop({ required: true })
  language: string;

  @Prop({ required: true })
  code: string;

  @Prop({ enum: SubmissionMode, required: true })
  mode: SubmissionMode;

  @Prop({ enum: SubmissionStatus, default: SubmissionStatus.JUDGING })
  status: SubmissionStatus;

  // Snapshot of the question's checker config at submission time, so grading
  // stays consistent even if the question is edited afterwards.
  @Prop({ type: Object })
  checker?: { type: 'exact' | 'float' | 'custom'; tolerance?: number };

  @Prop({ type: [TestCaseResultSchema], default: [] })
  results: TestCaseResult[];

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0 })
  maxScore: number;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
