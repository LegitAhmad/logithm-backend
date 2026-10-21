import { CreateQuestionValidator, UpdateQuestionValidator } from './DTOs/question.dto';
import { ExecutionValidator, GradingDefinitionValidator, valueTypeError } from './execution-contract';
import type { ExecutionContract } from './execution-contract';

const execution: ExecutionContract = { functionName: 'solve', parameters: [{ name: 'values', type: { type: 'array', items: { type: 'integer' } } }], returnType: { type: 'boolean' } };
const base = { title: 'Typed problem', descriptionMd: 'A real typed problem description', functionSignature: 'solve(values)', execution, testCases: [{ input: '[[1,2]]', expectedOutput: 'false' }] };

describe('typed question authoring', () => {
  it('accepts false, zero, null, empty strings and nested empty arrays without truthiness coercion', () => {
    for (const [type, expectedOutput] of [['boolean', 'false'], ['integer', '0'], ['null', 'null'], ['string', '""']] as const) {
      expect(CreateQuestionValidator.safeParse({ ...base, execution: { ...execution, returnType: { type } }, testCases: [{ input: '[[]]', expectedOutput }] }).success).toBe(true);
    }
  });

  it('checks every test, not just the first one', () => {
    const result = CreateQuestionValidator.safeParse({ ...base, testCases: [...base.testCases, { input: '[[1,"bad"]]', expectedOutput: 'true' }, { input: '[[2]]', expectedOutput: '1' }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual(expect.arrayContaining(['testCases.1.input', 'testCases.2.expectedOutput']));
  });

  it('requires positional argument JSON and explicit typed execution', () => {
    expect(CreateQuestionValidator.safeParse({ ...base, execution: undefined }).success).toBe(false);
    for (const input of ['1 2', '{"values":[1]}', '[1,2]', '[[1],2]']) expect(CreateQuestionValidator.safeParse({ ...base, testCases: [{ input, expectedOutput: 'false' }] }).success).toBe(false);
  });

  it('reports nested paths and rejects extra/missing object fields, bool numbers, unsafe integers and nonfinite values', () => {
    const schema = { type: 'object', properties: { rows: { type: 'array', items: { type: 'integer' } } } } as const;
    expect(valueTypeError({ rows: [1, false] }, schema)).toContain('$["rows"][1]');
    expect(valueTypeError({ rows: [], extra: 1 }, schema)).toContain('unexpected property');
    expect(valueTypeError({}, schema)).toContain('missing property');
    for (const value of [true, NaN, Infinity, 9007199254740992, 1.5]) expect(valueTypeError(value, { type: 'integer' })).toBeDefined();
    expect(valueTypeError(false, { type: 'number' })).toBeDefined();
  });

  it('rejects invalid checker configurations and incompatible float outputs', () => {
    for (const checker of [{ type: 'float' }, { type: 'float', tolerance: -1 }, { type: 'custom' }, { type: 'custom', code: 'return True' }, { type: 'exact', code: 'ignored' }]) expect(CreateQuestionValidator.safeParse({ ...base, checker }).success).toBe(false);
    expect(CreateQuestionValidator.safeParse({ ...base, checker: { type: 'float', tolerance: 0.1 } }).success).toBe(false);
  });

  it('rejects nonportable identifiers and duplicate parameter names', () => {
    for (const functionName of ['return', 'main', 'foo.bar', 'logithm_value', '1solve']) expect(ExecutionValidator.safeParse({ ...execution, functionName }).success).toBe(false);
    expect(ExecutionValidator.safeParse({ ...execution, parameters: [execution.parameters[0], execution.parameters[0]] }).success).toBe(false);
  });

  it('permits partial DTO updates but rejects invalid merged persisted definitions', () => {
    expect(UpdateQuestionValidator.safeParse({ execution: { ...execution, returnType: { type: 'integer' } } }).success).toBe(true);
    expect(GradingDefinitionValidator.safeParse({ ...base, execution: { ...execution, returnType: { type: 'integer' } } }).success).toBe(false);
  });
});
