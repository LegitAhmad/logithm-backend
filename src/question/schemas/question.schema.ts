import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { ExecutionContract } from '../execution-contract';

export interface QuestionTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionDocument = HydratedDocument<Question> & QuestionTimestamps;

export enum DifficultyLevel {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}
@Schema({ timestamps: true, _id: false })
export class TestCase {
  @Prop({ required: true })
  input: string;

  @Prop({ required: true })
  expectedOutput: string;

  @Prop({ default: false })
  isHidden: boolean;

  @Prop({ default: 1 })
  points: number;
}

export const TestCaseSchema = SchemaFactory.createForClass(TestCase);

@Schema({ _id: false })
export class CheckerConfig {
  @Prop({
    enum: ['exact', 'float', 'custom'],
    default: 'exact',
  })
  type: string;

  @Prop()
  tolerance?: number;

  @Prop()
  code?: string;
}

export const CheckerConfigSchema = SchemaFactory.createForClass(CheckerConfig);

@Schema({ timestamps: true })
export class Question {
  declare createdAt: Date;
  declare updatedAt: Date;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  descriptionMd: string;

  @Prop({ required: true })
  functionSignature: string;

  // Optional in storage only so legacy questions remain editable for migration.
  @Prop({ type: MongooseSchema.Types.Mixed })
  execution?: ExecutionContract;

  @Prop()
  constraints?: string;

  @Prop({ type: [TestCaseSchema], default: [] })
  testCases: TestCase[];

  @Prop({ type: CheckerConfigSchema })
  checker: CheckerConfig;

  @Prop({
    type: {
      language: String,
      code: String,
    },
  })
  referenceSolution?: {
    language: string;
    code: string;
  };

  @Prop({ default: DifficultyLevel.Easy })
  difficulty: DifficultyLevel;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ default: false })
  isPublic: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);
