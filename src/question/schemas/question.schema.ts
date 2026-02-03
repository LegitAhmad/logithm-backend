import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Question {
  // current owner
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  // fork history
  @Prop({
    type: Types.ObjectId,
    ref: 'Question',
    default: null,
  })
  parentQuestion: Types.ObjectId | null;

  // the original guy who created the first question
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  originalAuthor: Types.ObjectId | null;

  // if they allow to clone or not
  @Prop({
    default: true,
  })
  allowCloning: boolean;

  // info
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  markdown: string;

  @Prop({ type: Object })
  testCases: any;
}
