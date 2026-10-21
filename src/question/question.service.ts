import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import { Assignment } from '../assignment/schemas/assignment.schema';
import { GradingDefinitionValidator, LEGACY_MIGRATION_MESSAGE } from './execution-contract';
import { ResourceAccessService } from '../access/resource-access.service';

@Injectable()
export class QuestionService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly access: ResourceAccessService,
  ) {}

  private formatForOwner(q: QuestionDocument): QuestionOwnerResponseDto {
    return {
      _id: q._id.toString(),
      title: q.title,
      descriptionMd: q.descriptionMd,
      functionSignature: q.functionSignature,
      execution: q.execution,
      checker: q.checker as QuestionOwnerResponseDto['checker'],
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
      execution: q.execution,
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
    this.validateDefinition(dto);
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
    await this.access.assertQuestionAccess(q, userId);

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
    this.validateDefinition({
      execution: dto.execution ?? q.execution,
      testCases: dto.testCases ?? q.testCases.map((test) => ({
        input: test.input, expectedOutput: test.expectedOutput,
        isHidden: test.isHidden, points: test.points,
      })),
      checker: dto.checker ?? (q.checker ? {
        type: q.checker.type,
        ...(q.checker.tolerance !== undefined ? { tolerance: q.checker.tolerance } : {}),
        ...(q.checker.code !== undefined ? { code: q.checker.code } : {}),
      } : undefined),
    });

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

  private validateDefinition(definition: unknown) {
    if (!definition || typeof definition !== 'object' || !('execution' in definition) || !definition.execution) throw new BadRequestException(LEGACY_MIGRATION_MESSAGE);
    const parsed = GradingDefinitionValidator.safeParse(definition);
    if (!parsed.success) throw new BadRequestException({
      message: 'Invalid typed question definition',
      errors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  async findPublic() {
    const questions = await this.questionModel.find({ isPublic: true });
    return questions.map((question) => this.formatPublic(question));
  }

  /* ---------- ASSIGNMENT-RELATED ---------- */

  /**
   * Get all questions attached to an assignment, in the order they were
   * added (Assignment.questionIds is the single source of truth for the
   * assignment <-> question relationship).
   */
  async findByAssignment(assignmentId: string, userId?: string) {
    const assignment = await this.assignmentModel.findById(assignmentId);
    if (!assignment) throw new NotFoundException('Assignment not found');
    const access = await this.access.assertAssignmentAccess(assignment, userId);
    if (assignment.startAt && assignment.startAt > new Date() && !access.teacher) {
      throw new ForbiddenException('Assignment has not started');
    }

    const questions = await this.questionModel.find({
      _id: { $in: assignment.questionIds },
    });

    const byId = new Map(questions.map((q) => [q._id.toString(), q]));

    return assignment.questionIds
      .map((id) => byId.get(id.toString()))
      .filter((q): q is QuestionDocument => !!q)
      .map((q) => {
        const isOwner = userId && q.ownerId.toString() === userId;
        return isOwner ? this.formatForOwner(q) : this.formatPublic(q);
      });
  }
}
