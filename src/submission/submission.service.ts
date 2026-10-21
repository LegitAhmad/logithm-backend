import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question } from '../question/schemas/question.schema';
import { GradingDefinitionValidator, LEGACY_MIGRATION_MESSAGE, valueTypeError } from '../question/execution-contract';
import type { Checker, ExecutionContract } from '../question/execution-contract';
import { ResourceAccessService } from '../access/resource-access.service';
import { Submission, SubmissionDocument, SubmissionMode, SubmissionStatus } from './schemas/submission.schema';
import { CreateSubmissionDto, SubmissionResponseDto } from './DTOs/submission.dto';
import { resolvePistonLanguage } from './execution/language-map';
import { checkValue, decodeEnvelope } from './execution/checker';
import { wrapProgram, wrapCustomValidator, RETURN_TYPE_MARKER } from './execution/wrappers';
import { PistonClientService } from './execution/piston-client.service';
import type { PistonExecuteResult } from './execution/piston-client.service';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectModel(Submission.name) private readonly submissionModel: Model<Submission>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly pistonClient: PistonClientService,
    private readonly access: ResourceAccessService,
  ) {}

  private assertGradingDeadline(deadline: number) {
    if (Date.now() >= deadline) throw new ServiceUnavailableException('Grading exceeded request deadline; no partial score was saved');
  }

  private async evaluateExecution(result: PistonExecuteResult, expected: unknown, args: unknown[], contract: ExecutionContract, checker: Checker, deadline: number): Promise<{ passed: boolean; verdict: string; actualOutput?: string; diagnostic?: string }> {
    if (result.compile && (result.compile.code !== 0 || result.compile.signal)) return { passed: false, verdict: 'Compile Error' };
    const run = result.run;
    if (!run) throw new ServiceUnavailableException('Execution service did not return a run stage');
    if (run.code === 2) {
      const marker = run.stderr.lastIndexOf(RETURN_TYPE_MARKER);
      if (marker !== -1) return { passed: false, verdict: 'Return Type Error', diagnostic: run.stderr.slice(marker + RETURN_TYPE_MARKER.length).split('\n')[0].slice(0, 8192) };
    }
    if (run.code !== 0 || run.signal) return { passed: false, verdict: 'Runtime Error', diagnostic: (run.message ? `${run.message}\n${run.stderr}` : run.stderr).slice(0, 8192) || 'Execution failed or exceeded resource limits' };
    let actual: unknown;
    try { actual = decodeEnvelope(run.stdout); }
    catch { return { passed: false, verdict: 'Invalid Return Value', diagnostic: 'Function did not produce a valid typed return value' }; }
    const actualOutput = JSON.stringify(actual);
    const typeError = valueTypeError(actual, contract.returnType, 'return');
    if (typeError) return { passed: false, verdict: 'Return Type Error', actualOutput, diagnostic: typeError };
    let passed: boolean;
    if (checker.type === 'custom') {
      const python = resolvePistonLanguage('python')!;
      this.assertGradingDeadline(deadline);
      const validator = await this.pistonClient.execute(python.language, python.version, wrapCustomValidator(checker.code, actual, expected, args));
      this.assertGradingDeadline(deadline);
      if ((validator.compile && (validator.compile.code !== 0 || validator.compile.signal)) || !validator.run || validator.run.code !== 0 || validator.run.signal) {
        return { passed: false, verdict: 'Validator Error', actualOutput, diagnostic: 'Teacher validator failed; contact the question owner' };
      }
      try {
        const decision = decodeEnvelope(validator.run.stdout);
        if (typeof decision !== 'boolean') throw new Error('Expected strict bool');
        passed = decision;
      } catch { return { passed: false, verdict: 'Validator Error', actualOutput, diagnostic: 'Teacher validator must return a strict bool' }; }
    } else passed = checkValue(checker, actual, expected);
    return { passed, verdict: passed ? 'Accepted' : 'Wrong Answer', actualOutput };
  }

  private format(submission: SubmissionDocument): SubmissionResponseDto {
    return {
      _id: submission._id.toString(), questionId: submission.questionId.toString(), assignmentId: submission.assignmentId?.toString(),
      language: submission.language, mode: submission.mode, status: submission.status, score: submission.score, maxScore: submission.maxScore,
      results: submission.results.map((result) => ({
        testCaseIndex: result.testCaseIndex, isHidden: result.isHidden, points: result.points, passed: result.passed,
        verdict: result.isHidden ? (result.passed ? 'Accepted' : 'Hidden test failed') : result.verdict,
        ...(result.isHidden ? {} : {
          stderr: result.stderr ?? undefined, compileOutput: result.compileOutput ?? undefined,
          actualOutput: result.actualOutput ?? undefined, diagnostic: result.diagnostic ?? undefined,
          time: result.time ?? undefined, memory: result.memory ?? undefined,
        }),
      })),
      createdAt: submission.createdAt.toISOString(), updatedAt: submission.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateSubmissionDto, userId: string, mode: SubmissionMode): Promise<SubmissionResponseDto> {
    const deadline = Date.now() + 120000;
    const question = await this.questionModel.findById(dto.questionId);
    if (!question) throw new NotFoundException('Question not found');
    await this.access.assertSubmissionAccess(question, userId, dto.assignmentId);
    if (!question.execution) throw new BadRequestException(LEGACY_MIGRATION_MESSAGE);
    // Revalidate persisted definitions: old or externally changed records must not bypass author checks.
    const definition = GradingDefinitionValidator.safeParse({
      execution: question.execution,
      testCases: question.testCases.map((test) => ({ input: test.input, expectedOutput: test.expectedOutput, isHidden: test.isHidden, points: test.points })),
      checker: question.checker ? {
        type: question.checker.type,
        ...(question.checker.tolerance !== undefined ? { tolerance: question.checker.tolerance } : {}),
        ...(question.checker.code !== undefined ? { code: question.checker.code } : {}),
      } : undefined,
    });
    if (!definition.success) throw new BadRequestException('Question grading definition is invalid. Its teacher must edit and migrate its typed tests before execution.');
    const runtime = resolvePistonLanguage(dto.language);
    if (!runtime) throw new BadRequestException(`Unsupported typed language: ${dto.language}. Supported: Python, JavaScript, TypeScript, Go`);
    const cases = definition.data.testCases.map((test, index) => ({ test, index })).filter(({ test }) => mode !== SubmissionMode.RUN || !test.isHidden);
    if (cases.length === 0) throw new BadRequestException('This question has no public test cases to run');
    // Prepare every program before executing any case (e.g. unsupported Go object tags).
    const programs = cases.map(({ test }) => {
      const args: unknown[] = JSON.parse(test.input);
      try { return { args, program: wrapProgram(runtime.language, dto.code, definition.data.execution, args) }; }
      catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Unsupported execution contract'); }
    });
    const results: Submission['results'] = [];
    for (let position = 0; position < cases.length; position++) {
      const { test, index } = cases[position];
      const { args, program } = programs[position];
      this.assertGradingDeadline(deadline);
      const execution = await this.pistonClient.execute(runtime.language, runtime.version, program);
      this.assertGradingDeadline(deadline);
      const outcome = await this.evaluateExecution(execution, JSON.parse(test.expectedOutput), args, definition.data.execution, definition.data.checker ?? { type: 'exact' }, deadline);
      results.push({
        testCaseIndex: index, expectedOutput: test.expectedOutput, isHidden: test.isHidden ?? false, points: test.points ?? 1,
        ...outcome,
        stderr: execution.run?.stderr.slice(0, 8192),
        compileOutput: execution.compile ? (execution.compile.stderr + execution.compile.stdout).slice(0, 8192) : undefined,
        time: execution.run?.wall_time?.toString(), memory: execution.run?.memory,
      });
    }
    const checker = definition.data.checker ?? { type: 'exact' };
    this.assertGradingDeadline(deadline);
    const submission = await this.submissionModel.create({
      userId: new Types.ObjectId(userId), questionId: question._id,
      assignmentId: dto.assignmentId ? new Types.ObjectId(dto.assignmentId) : undefined,
      language: dto.language.toLowerCase(), code: dto.code, mode, status: SubmissionStatus.COMPLETED, results,
      score: results.reduce((sum, result) => sum + (result.passed ? result.points : 0), 0),
      maxScore: results.reduce((sum, result) => sum + result.points, 0),
      checker: { type: checker.type, ...(checker.type === 'float' ? { tolerance: checker.tolerance } : {}) },
    });
    return this.format(submission as SubmissionDocument);
  }

  async getStatus(id: string, userId: string): Promise<SubmissionResponseDto> {
    const submission = await this.submissionModel.findById(id);
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId.toString() !== userId) throw new ForbiddenException();
    return this.format(submission as SubmissionDocument);
  }

  async findMine(userId: string): Promise<SubmissionResponseDto[]> {
    const submissions = await this.submissionModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
    return submissions.map((submission) => this.format(submission as SubmissionDocument));
  }

  async findByQuestion(questionId: string, userId: string): Promise<SubmissionResponseDto[]> {
    const submissions = await this.submissionModel.find({ questionId: new Types.ObjectId(questionId), userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
    return submissions.map((submission) => this.format(submission as SubmissionDocument));
  }
}
