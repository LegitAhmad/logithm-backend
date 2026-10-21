import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Question } from '../question/schemas/question.schema';
import { ResourceAccessService } from '../access/resource-access.service';
import { Submission, SubmissionMode } from './schemas/submission.schema';
import { SubmissionService } from './submission.service';
import { PistonClientService } from './execution/piston-client.service';
import type { ExecutionContract } from '../question/execution-contract';

const userId = new Types.ObjectId().toString();
const questionId = new Types.ObjectId();
const execution: ExecutionContract = { functionName: 'solve', parameters: [{ name: 'value', type: { type: 'integer' } }], returnType: { type: 'integer' } };
const testCase = { input: '[4]', expectedOutput: '4', isHidden: false, points: 2 };
const stage = { code: 0, signal: null, message: null, stdout: '', stderr: '', wall_time: 1, memory: 123 };
function result(value: unknown) { return { language: 'python', version: '3.12.0', run: { ...stage, stdout: JSON.stringify({ version: 1, value }) } }; }

describe('SubmissionService return-value grading', () => {
  const questions = { findById: jest.fn() };
  const submissions = { create: jest.fn(), findById: jest.fn() };
  const piston = { execute: jest.fn() };
  const access = { assertSubmissionAccess: jest.fn() };
  let service: SubmissionService;
  beforeEach(async () => {
    jest.resetAllMocks();
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [testCase], checker: { type: 'exact' } });
    submissions.create.mockImplementation(async (value) => ({ ...value, _id: new Types.ObjectId(), createdAt: new Date(), updatedAt: new Date() }));
    const module = await Test.createTestingModule({ providers: [SubmissionService,
      { provide: getModelToken(Question.name), useValue: questions }, { provide: getModelToken(Submission.name), useValue: submissions },
      { provide: PistonClientService, useValue: piston }, { provide: ResourceAccessService, useValue: access },
    ] }).compile();
    service = module.get(SubmissionService);
  });
  const submit = () => service.create({ questionId: questionId.toString(), language: 'python', code: 'def solve(value):\n print(4)\n return 0' }, userId, SubmissionMode.SUBMIT);

  it('rejects matching printed output without a return envelope', async () => {
    piston.execute.mockResolvedValue({ ...result(4), run: { ...stage, stdout: '4' } });
    const response = await submit();
    expect(response.score).toBe(0);
    expect(response.results[0].verdict).toBe('Invalid Return Value');
  });

  it('rejects wrong return even when debug output matches expected', async () => {
    piston.execute.mockResolvedValue({ ...result(0), run: { ...result(0).run, stderr: '4\n' } });
    const response = await submit();
    expect(response.results[0]).toMatchObject({ passed: false, verdict: 'Wrong Answer', actualOutput: '0' });
  });

  it('classifies wrapper type failures separately from student runtime errors', async () => {
    piston.execute.mockResolvedValue({ ...result(null), run: { ...stage, code: 2, stderr: 'debug\nLOGITHM_RETURN_TYPE:return[1]: expected integer\n' } });
    const response = await submit();
    expect(response.results[0]).toMatchObject({ passed: false, verdict: 'Return Type Error', diagnostic: 'return[1]: expected integer' });
  });

  it.each(['stdout', 'stderr'])('records compile-only failures with %s diagnostics as completed zero-score submissions', async channel => {
    piston.execute.mockResolvedValue({ language: 'go', version: '1.16.2', compile: { ...stage, code: 1, [channel]: 'compiler diagnostic' } });
    const response = await submit();
    expect(response.status).toBe('completed');
    expect(response.score).toBe(0);
    expect(response.results[0]).toMatchObject({ passed: false, verdict: 'Compile Error', compileOutput: 'compiler diagnostic' });
  });

  it('reports validator compilation failure without revealing its compiler output', async () => {
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [testCase], checker: { type: 'custom', code: 'def validate(actual, expected, args):\n return True' } });
    piston.execute.mockResolvedValueOnce(result(4)).mockResolvedValueOnce({ language: 'python', version: '3.12.0', compile: { ...stage, code: 1, stderr: 'private validator source' } });
    const response = await submit();
    expect(response.score).toBe(0);
    expect(response.results[0].verdict).toBe('Validator Error');
    expect(JSON.stringify(response)).not.toContain('private validator source');
  });

  it('checks actual return type before invoking a custom checker', async () => {
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [testCase], checker: { type: 'custom', code: 'def validate(actual, expected, args):\n return True' } });
    piston.execute.mockResolvedValue(result(false));
    const response = await submit();
    expect(response.results[0].verdict).toBe('Return Type Error');
    expect(response.results[0].diagnostic).toContain('return');
    expect(piston.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects nonboolean custom decisions and conceals teacher validator details', async () => {
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [testCase], checker: { type: 'custom', code: 'def validate(actual, expected, args):\n return 1' } });
    piston.execute.mockResolvedValueOnce(result(4)).mockResolvedValueOnce(result(1));
    const response = await submit();
    expect(response.results[0]).toMatchObject({ passed: false, verdict: 'Validator Error' });
    expect(JSON.stringify(response)).not.toContain('def validate');
  });

  it('keeps original public case indices in run mode', async () => {
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [{ ...testCase, isHidden: true }, testCase], checker: { type: 'exact' } });
    piston.execute.mockResolvedValue(result(4));
    const response = await service.create({ questionId: questionId.toString(), language: 'python', code: 'def solve(value): return value' }, userId, SubmissionMode.RUN);
    expect(response.results.map(test => test.testCaseIndex)).toEqual([1]);
    expect(piston.execute).toHaveBeenCalledTimes(1);
  });

  it('redacts every hidden diagnostic and resource metadata, including old stored verdict text', async () => {
    submissions.findById.mockResolvedValue({ _id: new Types.ObjectId(), questionId, userId, language: 'python', mode: 'submit', status: 'completed', score: 0, maxScore: 1, createdAt: new Date(), updatedAt: new Date(), results: [{ testCaseIndex: 3, isHidden: true, points: 1, passed: false, verdict: 'Runtime Error secret-input', actualOutput: 'secret-actual', diagnostic: 'secret-expected', stdout: 'secret-stdout', stderr: 'secret-stderr', compileOutput: 'secret-code', time: '999', memory: 123 }] });
    const response = await service.getStatus(new Types.ObjectId().toString(), userId);
    expect(response.results[0]).toEqual({ testCaseIndex: 3, isHidden: true, points: 1, passed: false, verdict: 'Hidden test failed' });
    expect(JSON.stringify(response)).not.toContain('secret');
  });

  it('fails a whole-submission deadline without saving partial results or scheduling more cases', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    questions.findById.mockResolvedValue({ _id: questionId, execution, testCases: [testCase, testCase], checker: { type: 'exact' } });
    piston.execute.mockImplementation(async () => { clock.mockReturnValue(121001); return result(4); });
    try {
      await expect(submit()).rejects.toThrow('Grading exceeded request deadline');
      expect(piston.execute).toHaveBeenCalledTimes(1);
      expect(submissions.create).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });

  it('fails clearly for legacy questions and rejects unsupported adapters without sandbox work', async () => {
    questions.findById.mockResolvedValueOnce({ _id: questionId, testCases: [testCase] });
    await expect(submit()).rejects.toThrow('teacher must edit');
    await expect(service.create({ questionId: questionId.toString(), language: 'rust', code: 'fn solve() {}' }, userId, SubmissionMode.SUBMIT)).rejects.toThrow('Unsupported typed language');
    expect(piston.execute).not.toHaveBeenCalled();
  });
});
