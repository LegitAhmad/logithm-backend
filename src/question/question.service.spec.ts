import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ResourceAccessService } from '../access/resource-access.service';
import { QuestionService } from './question.service';
import { Question } from './schemas/question.schema';
import { Assignment } from '../assignment/schemas/assignment.schema';
import type { ExecutionContract } from './execution-contract';

const owner = new Types.ObjectId();
const execution: ExecutionContract = { functionName: 'solve', parameters: [{ name: 'value', type: { type: 'integer' } }], returnType: { type: 'integer' } };
const dto = { title: 'Identity function', descriptionMd: 'Return the supplied argument', functionSignature: 'solve(value)', execution, testCases: [{ input: '[1]', expectedOutput: '1', isHidden: false, points: 1 }], difficulty: 'easy' as const };

function record() {
  return { ...dto, _id: new Types.ObjectId(), ownerId: owner, checker: { type: 'exact' }, tags: [], isPublic: true,
    createdAt: new Date(), updatedAt: new Date(), save: jest.fn(), deleteOne: jest.fn() };
}

describe('QuestionService typed persistence', () => {
  const questions = { create: jest.fn(), findById: jest.fn(), find: jest.fn() };
  const assignments = { findById: jest.fn() };
  const access = { assertQuestionAccess: jest.fn(), assertAssignmentAccess: jest.fn() };
  let service: QuestionService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({ providers: [QuestionService,
      { provide: getModelToken(Question.name), useValue: questions },
      { provide: getModelToken(Assignment.name), useValue: assignments },
      { provide: ResourceAccessService, useValue: access },
    ] }).compile();
    service = module.get(QuestionService);
  });

  it('rejects authoring errors before any database create', async () => {
    await expect(service.create({ ...dto, testCases: [...dto.testCases, { input: '[false]', expectedOutput: '1', isHidden: true, points: 1 }] }, owner.toString())).rejects.toThrow('Invalid typed question definition');
    expect(questions.create).not.toHaveBeenCalled();
  });

  it('rejects partial return-type changes against existing cases without saving', async () => {
    const question = record(); questions.findById.mockResolvedValue(question);
    await expect(service.update(question._id.toString(), { execution: { ...execution, returnType: { type: 'boolean' } } }, owner.toString())).rejects.toThrow('Invalid typed question definition');
    expect(question.save).not.toHaveBeenCalled();
    expect(question.execution.returnType.type).toBe('integer');
  });

  it('allows a teacher to repair legacy execution and tests together', async () => {
    const question = { ...record(), execution: undefined }; questions.findById.mockResolvedValue(question);
    const response = await service.update(question._id.toString(), { execution, testCases: dto.testCases }, owner.toString());
    expect(question.save).toHaveBeenCalledTimes(1);
    expect(response.execution).toEqual(execution);
  });

  it('does not expose hidden tests, validators or reference solutions to nonowners', async () => {
    const question = { ...record(), checker: { type: 'custom', code: 'def validate(actual, expected, args):\n return True' }, referenceSolution: { language: 'python', code: 'teacher secret' }, testCases: [...dto.testCases, { input: '[987]', expectedOutput: '987', isHidden: true, points: 5 }] };
    questions.findById.mockResolvedValue(question);
    const response = await service.findOne(question._id.toString(), new Types.ObjectId().toString());
    expect(response.testCases).toHaveLength(1);
    expect(response).not.toHaveProperty('checker');
    expect(response).not.toHaveProperty('referenceSolution');
    expect(JSON.stringify(response)).not.toContain('987');
  });
});
