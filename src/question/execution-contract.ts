import { z } from 'zod';

export type ValueType =
  | { type: 'string' | 'number' | 'integer' | 'boolean' | 'null' }
  | { type: 'array'; items: ValueType }
  | { type: 'object'; properties: Record<string, ValueType> };
export interface ExecutionContract {
  functionName: string;
  parameters: { name: string; type: ValueType }[];
  returnType: ValueType;
}
export type Checker =
  | { type: 'exact' }
  | { type: 'float'; tolerance: number }
  | { type: 'custom'; code: string };

// A common identifier subset keeps contracts portable between every adapter.
const reserved = new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield abstract arguments boolean byte case catch char const debugger default delete do double enum eval export extends final finally float function goto implements instanceof int interface let long native new null package private protected public short static super switch synchronized this throw throws transient true false typeof var void volatile yield Infinity NaN undefined constructor prototype __proto__ main init func map range select struct chan defer fallthrough go type interface make len cap append copy recover panic print println').split(/\s+/));
export const IdentifierValidator = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(80)
  .refine((name) => !reserved.has(name) && !name.startsWith('logithm'), 'Reserved execution identifier');

// Reuse each depth's schema object and give it an OpenAPI identity. Fresh lazy
// children expand exponentially when nestjs-zod traverses the DTO graph.
const valueTypeSchemas: z.ZodType<ValueType>[] = [];
function valueSchema(depth: number): z.ZodType<ValueType> {
  const cached = valueTypeSchemas[depth];
  if (cached) return cached;
  const primitive = z.object({ type: z.enum(['string', 'number', 'integer', 'boolean', 'null']) }).strict();
  const child = depth > 0 ? valueSchema(depth - 1) : undefined;
  const schema: z.ZodType<ValueType> = child ? z.union([
    primitive,
    z.object({ type: z.literal('array'), items: child }).strict(),
    z.object({ type: z.literal('object'), properties: z.record(z.string().max(200), child) }).strict(),
  ]) : primitive;
  valueTypeSchemas[depth] = schema.meta({ id: `LogithmValueTypeDepth${depth}` });
  return valueTypeSchemas[depth];
}
export const ValueTypeValidator = valueSchema(12);
export const ExecutionValidator = z.object({
  functionName: IdentifierValidator,
  parameters: z.array(z.object({ name: IdentifierValidator, type: ValueTypeValidator }).strict()).max(32),
  returnType: ValueTypeValidator,
}).strict().superRefine((execution, ctx) => {
  const names = execution.parameters.map((parameter) => parameter.name);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', path: ['parameters'], message: 'Parameter names must be unique' });
});
export const CheckerValidator = z.discriminatedUnion('type', [
  z.object({ type: z.literal('exact') }).strict(),
  z.object({ type: z.literal('float'), tolerance: z.number().finite().nonnegative() }).strict(),
  z.object({ type: z.literal('custom'), code: z.string().min(1).max(65536).refine((code) => /^\s*def\s+validate\s*\(/m.test(code), 'Define validate(actual, expected, args)') }).strict(),
]);
export const TestCaseValidator = z.object({
  input: z.string().min(1).max(262144),
  expectedOutput: z.string().min(1).max(262144),
  isHidden: z.boolean().optional(),
  points: z.number().finite().min(1).optional(),
}).strict();

/** Returns the first mismatch, preserving an actionable nested value path. */
export function valueTypeError(value: unknown, schema: ValueType, path = '$'): string | undefined {
  if (schema.type === 'null') return value === null ? undefined : `${path}: expected null`;
  if (schema.type === 'string' || schema.type === 'boolean') return typeof value === schema.type ? undefined : `${path}: expected ${schema.type}`;
  if (schema.type === 'number' || schema.type === 'integer') {
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && (schema.type !== 'integer' || Number.isSafeInteger(value))
      ? undefined : `${path}: expected finite safe ${schema.type}`;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${path}: expected array`;
    for (let index = 0; index < value.length; index++) {
      const error = valueTypeError(value[index], schema.items, `${path}[${index}]`);
      if (error) return error;
    }
    return;
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path}: expected object`;
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(schema.properties)) {
      if (!Object.hasOwn(object, key)) return `${path}[${JSON.stringify(key)}]: missing property`;
      const error = valueTypeError(object[key], schema.properties[key], `${path}[${JSON.stringify(key)}]`);
      if (error) return error;
    }
    for (const key of Object.keys(object)) if (!Object.hasOwn(schema.properties, key)) return `${path}[${JSON.stringify(key)}]: unexpected property`;
  }
}

export function gradingIssues(definition: { execution: ExecutionContract; testCases: { input: string; expectedOutput: string }[]; checker?: Checker }): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  if (definition.checker?.type === 'float' && !['number', 'integer'].includes(definition.execution.returnType.type)) issues.push({ path: ['checker'], message: 'Float checker requires a numeric return type' });
  definition.testCases.forEach((test, index) => {
    for (const field of ['input', 'expectedOutput'] as const) {
      try {
        const value: unknown = JSON.parse(test[field]);
        let error: string | undefined;
        if (field === 'input') {
          if (!Array.isArray(value) || value.length !== definition.execution.parameters.length) error = `args: expected ${definition.execution.parameters.length} positional arguments`;
          else for (let argument = 0; argument < value.length; argument++) {
            error = valueTypeError(value[argument], definition.execution.parameters[argument].type, `args[${argument}]`);
            if (error) break;
          }
        } else error = valueTypeError(value, definition.execution.returnType, 'expected');
        if (error) issues.push({ path: ['testCases', index, field], message: error });
      } catch { issues.push({ path: ['testCases', index, field], message: 'Must be valid JSON (input is a positional arguments array)' }); }
    }
  });
  return issues;
}

export const GradingDefinitionValidator = z.object({
  execution: ExecutionValidator,
  testCases: z.array(TestCaseValidator).min(1).max(100),
  checker: CheckerValidator.optional(),
}).superRefine((definition, ctx) => {
  for (const issue of gradingIssues(definition)) ctx.addIssue({ code: 'custom', ...issue });
});
export const LEGACY_MIGRATION_MESSAGE = 'This question has no typed execution contract. Its teacher must edit it, define execution parameters/return type, and migrate every test input to a JSON positional arguments array before it can be run.';
