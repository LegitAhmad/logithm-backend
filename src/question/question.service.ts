import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from './schemas/question.schema';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QuestionResponseDto,
  QuestionOwnerResponseDto,
} from './DTOs/question.dto';
import { AssignmentQuestion } from './schemas/assignment-question.schema';

@Injectable()
export class QuestionService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(AssignmentQuestion.name)
    private readonly assignmentQuestionModel: Model<AssignmentQuestion>,
  ) {}

  private formatForOwner(q: QuestionDocument): QuestionOwnerResponseDto {
    return {
      _id: q._id.toString(),
      title: q.title,
      descriptionMd: q.descriptionMd,
      functionSignature: q.functionSignature,
      constraints: q.constraints,
      testCases: q.testCases.map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        isHidden: t.isHidden,
        points: t.points,
      })),
      referenceSolution: q.referenceSolution,
      difficulty: q.difficulty,
      tags: q.tags,
      isPublic: q.isPublic,
      ownerId: q.ownerId.toString(),
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }

  private formatPublic(q: QuestionDocument): QuestionResponseDto {
    return {
      _id: q._id.toString(),
      title: q.title,
      descriptionMd: q.descriptionMd,
      functionSignature: q.functionSignature,
      constraints: q.constraints,
      testCases: q.testCases
        .filter((t) => !t.isHidden)
        .map((t) => ({
          input: t.input,
          expectedOutput: t.expectedOutput,
          points: t.points,
        })),
      difficulty: q.difficulty,
      tags: q.tags,
      isPublic: q.isPublic,
      ownerId: q.ownerId.toString(),
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateQuestionDto, userId: string) {
    const question = await this.questionModel.create({
      ...dto,
      ownerId: new Types.ObjectId(userId),
    });

    return this.formatForOwner(question as QuestionDocument);
  }

  async findByOwner(userId: string) {
    const questions: QuestionDocument[] | null | undefined =
      await this.questionModel.find({
        ownerId: userId,
      });

    return questions.map((q) => this.formatForOwner(q));
  }

  async findOne(id: string, userId?: string) {
    const q: QuestionDocument | null | undefined =
      await this.questionModel.findById(id);

    if (!q) throw new NotFoundException('Question not found');

    // Owner sees everything
    if (userId && q.ownerId.toString() === userId) {
      return this.formatForOwner(q);
    }

    // Others see only public test cases
    return this.formatPublic(q);
  }

  async update(id: string, dto: UpdateQuestionDto, userId: string) {
    const q = await this.questionModel.findById(id);

    if (!q) throw new NotFoundException('Question not found');

    if (q.ownerId.toString() !== userId) throw new ForbiddenException();

    Object.assign(q, dto);

    await q.save();

    return this.formatForOwner(q as QuestionDocument);
  }

  async remove(id: string, userId: string) {
    const q = await this.questionModel.findById(id);

    if (!q) throw new NotFoundException('Question not found');

    if (q.ownerId.toString() !== userId) throw new ForbiddenException();

    await q.deleteOne();

    return { success: true };
  }

  /* ---------- ASSIGNMENT-RELATED ---------- */

  /**
   * Get all questions inside an assignment
   * (with overrides: points, limits, order)
   */
  async findByAssignment(assignmentId: string, userId?: string) {
    const assignmentQuestions = await this.assignmentQuestionModel
      .find({
        assignmentId: new Types.ObjectId(assignmentId),
      })
      .populate('questionId')
      .sort({ order: 1 });

    return assignmentQuestions.map((aq) => {
      const q = aq.questionId as unknown as QuestionDocument;

      const isOwner = userId && q.ownerId.toString() === userId;

      const formattedQuestion = isOwner
        ? this.formatForOwner(q)
        : this.formatPublic(q);

      return {
        ...formattedQuestion,
        assignmentPoints: aq.points,
        timeLimitMs: aq.timeLimitMs,
        order: aq.order,
        showHiddenTests: aq.showHiddenTests,
      };
    });
  }
}
