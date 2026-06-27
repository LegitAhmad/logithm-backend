import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Question } from '../question/schemas/question.schema';
import {
  Submission,
  SubmissionDocument,
  SubmissionMode,
  SubmissionStatus,
} from './schemas/submission.schema';
import {
  CreateSubmissionDto,
  SubmissionResponseDto,
} from './DTOs/submission.dto';
import { resolvePistonLanguage } from './execution/language-map';
import { checkOutput } from './execution/checker';
import {
  PistonClientService,
  PistonExecuteResult,
} from './execution/piston-client.service';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<Submission>,
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
    private readonly pistonClient: PistonClientService,
  ) {}

  private evaluateExecution(
    execution: PistonExecuteResult,
    expectedOutput: string,
    checker: Submission['checker'],
  ): { passed: boolean; verdict: string } {
    if (execution.compile && execution.compile.code !== 0) {
      return { passed: false, verdict: 'Compile Error' };
    }

    if (execution.run.code !== 0 || execution.run.signal) {
      const verdict = execution.run.signal
        ? `Runtime Error (${execution.run.signal})`
        : (execution.run.message ?? 'Runtime Error');
      return { passed: false, verdict };
    }

    const passed = checkOutput(checker, execution.run.stdout, expectedOutput);
    return { passed, verdict: passed ? 'Accepted' : 'Wrong Answer' };
  }

  private format(submission: SubmissionDocument): SubmissionResponseDto {
    return {
      _id: submission._id.toString(),
      questionId: submission.questionId.toString(),
      assignmentId: submission.assignmentId?.toString(),
      language: submission.language,
      mode: submission.mode,
      status: submission.status,
      score: submission.score,
      maxScore: submission.maxScore,
      results: submission.results.map((r) => ({
        testCaseIndex: r.testCaseIndex,
        isHidden: r.isHidden,
        points: r.points,
        passed: r.passed,
        verdict: r.verdict,
        // Hidden test cases never leak stdout/stderr/expectedOutput to the student.
        stdout: r.isHidden ? undefined : (r.stdout ?? undefined),
        stderr: r.isHidden ? undefined : (r.stderr ?? undefined),
        compileOutput: r.compileOutput ?? undefined,
        time: r.time ?? undefined,
        memory: r.memory ?? undefined,
      })),
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
    };
  }

  async create(
    dto: CreateSubmissionDto,
    userId: string,
    mode: SubmissionMode,
  ): Promise<SubmissionResponseDto> {
    const question = await this.questionModel.findById(dto.questionId);
    if (!question) throw new NotFoundException('Question not found');

    const pistonLanguage = resolvePistonLanguage(dto.language);
    if (!pistonLanguage) {
      throw new BadRequestException(`Unsupported language: ${dto.language}`);
    }

    const testCases =
      mode === SubmissionMode.RUN
        ? question.testCases.filter((tc) => !tc.isHidden)
        : question.testCases;

    if (testCases.length === 0) {
      throw new BadRequestException('This question has no test cases to run');
    }

    const executions = await Promise.all(
      testCases.map((tc) =>
        this.pistonClient.execute(
          pistonLanguage.language,
          pistonLanguage.version,
          dto.code,
          tc.input,
        ),
      ),
    );

    const results = executions.map((execution, index) => {
      const testCase = testCases[index];
      const outcome = this.evaluateExecution(
        execution,
        testCase.expectedOutput,
        question.checker as Submission['checker'],
      );

      return {
        testCaseIndex: index,
        expectedOutput: testCase.expectedOutput,
        isHidden: testCase.isHidden,
        points: testCase.points ?? 1,
        passed: outcome.passed,
        verdict: outcome.verdict,
        stdout: execution.run.stdout,
        stderr: execution.run.stderr,
        compileOutput: execution.compile?.stderr,
        time: execution.run.wall_time?.toString(),
        memory: execution.run.memory,
      };
    });

    const submission = await this.submissionModel.create({
      userId: new Types.ObjectId(userId),
      questionId: question._id,
      assignmentId: dto.assignmentId
        ? new Types.ObjectId(dto.assignmentId)
        : undefined,
      language: dto.language,
      code: dto.code,
      mode,
      status: SubmissionStatus.COMPLETED,
      results,
      score: results.reduce((sum, r) => sum + (r.passed ? r.points : 0), 0),
      maxScore: results.reduce((sum, r) => sum + r.points, 0),
      checker: question.checker,
    });

    return this.format(submission as SubmissionDocument);
  }

  async getStatus(id: string, userId: string): Promise<SubmissionResponseDto> {
    const submission = await this.submissionModel.findById(id);
    if (!submission) throw new NotFoundException('Submission not found');

    if (submission.userId.toString() !== userId) {
      throw new ForbiddenException();
    }

    return this.format(submission as SubmissionDocument);
  }

  async findMine(userId: string): Promise<SubmissionResponseDto[]> {
    const submissions = await this.submissionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });

    return submissions.map((s) => this.format(s as SubmissionDocument));
  }

  async findByQuestion(
    questionId: string,
    userId: string,
  ): Promise<SubmissionResponseDto[]> {
    const submissions = await this.submissionModel
      .find({
        questionId: new Types.ObjectId(questionId),
        userId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 });

    return submissions.map((s) => this.format(s as SubmissionDocument));
  }
}
