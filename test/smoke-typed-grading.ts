// Run from logithm-backend: node -r ts-node/register test/smoke-typed-grading.ts
// Requires local python3, node and go; executes only fixed trusted regression examples.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { wrapProgram, wrapCustomValidator, goType, RETURN_TYPE_MARKER } from '../src/submission/execution/wrappers';
import type { WrappedProgram } from '../src/submission/execution/wrappers';
import { decodeEnvelope, checkValue } from '../src/submission/execution/checker';
import { valueTypeError } from '../src/question/execution-contract';
import type { ExecutionContract, ValueType } from '../src/question/execution-contract';

const directory = mkdtempSync(join(tmpdir(), 'logithm-wrappers-'));
const evidence: Record<string, unknown>[] = [];
const contract: ExecutionContract = { functionName: 'solve', parameters: [{ name: 'value', type: { type: 'integer' } }], returnType: { type: 'integer' } };

function execute(language: string, program: WrappedProgram) {
  const file = program.files[0];
  const extension = language === 'typescript' ? 'js' : file.name.split('.').pop();
  const path = join(directory, `program.${extension}`);
  writeFileSync(path, language === 'typescript' ? transpileModule(file.content, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } }).outputText : file.content);
  const command = language === 'python' ? 'python3' : language === 'go' ? 'go' : process.execPath;
  const result = spawnSync(command, language === 'go' ? ['run', path] : [path], { input: program.stdin, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, env: { ...process.env, GO111MODULE: 'off' } });
  if (result.error) throw result.error;
  return result;
}

try {
  const examples = [
    ['python', 'def solve(value):\n print(4)\n return 0'],
    ['javascript', 'function solve(value) { console.log(4); return 0; }'],
    ['typescript', 'function solve(value: number): number { console.log(4); return 0; }'],
    ['go', 'package main\nimport "fmt"\nfunc solve(value int64) int64 { fmt.Println(4); return 0 }'],
  ];
  for (const [language, code] of examples) {
    const result = execute(language, wrapProgram(language, code, contract, [4]));
    assert.equal(result.status, 0, result.stderr);
    const actual = decodeEnvelope(result.stdout);
    assert.equal(actual, 0);
    assert.match(result.stderr, /4/);
    const accepted = checkValue({ type: 'exact' }, actual, 4);
    assert.equal(accepted, false);
    evidence.push({ language, scenario: 'matching print, wrong return', actual, expected: 4, accepted });
  }

  const nested: ValueType = { type: 'object', properties: { values: { type: 'array', items: { type: 'integer' } } } };
  const nestedContract: ExecutionContract = { ...contract, parameters: [{ name: 'value', type: nested }], returnType: nested };
  const goObject = goType(nested);
  const correctExamples = [
    ['python', 'def solve(value):\n value["values"][0] += 1\n return value'],
    ['javascript', 'async function solve(value) { value.values[0]++; return value; }'],
    ['typescript', 'async function solve(value: {values: number[]}): Promise<{values: number[]}> { value.values[0]++; return value; }'],
    ['go', `package main\nfunc solve(value ${goObject}) ${goObject} { value.F0[0]++; return value }`],
  ];
  for (const [language, code] of correctExamples) {
    const result = execute(language, wrapProgram(language, code, nestedContract, [{ values: [1] }]));
    assert.equal(result.status, 0, result.stderr);
    const actual = decodeEnvelope(result.stdout);
    assert.equal(valueTypeError(actual, nested), undefined);
    assert.deepEqual(actual, { values: [2] });
    evidence.push({ language, scenario: 'typed nested values', accepted: true });
  }

  for (const [language, code] of [
    ['python', 'def solve(value):\n return {"values": [1, True]}'],
    ['javascript', 'function solve(value) { return {values: [1, undefined]}; }'],
    ['typescript', 'function solve(value: {values: number[]}) { return {values: [1, undefined]}; }'],
  ]) {
    const result = execute(language, wrapProgram(language, code, nestedContract, [{ values: [] }]));
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, new RegExp(RETURN_TYPE_MARKER));
    assert.match(result.stderr, /return.*values.*\[1\]/);
    evidence.push({ language, scenario: 'nested invalid return type', accepted: false, diagnostic: result.stderr.trim() });
  }

  const custom = wrapCustomValidator('def validate(actual, expected, args):\n return "solve" not in globals() and actual == expected and actual["items"][0] is False and args == [None, 0, ""]', { items: [false] }, { items: [false] }, [null, 0, '']);
  const customResult = execute('python', custom);
  assert.equal(customResult.status, 0, customResult.stderr);
  assert.equal(decodeEnvelope(customResult.stdout), true);
  const invalidCustom = execute('python', wrapCustomValidator('def validate(actual, expected, args):\n return 1', 1, 1, []));
  assert.notEqual(invalidCustom.status, 0);
  assert.match(invalidCustom.stderr, /strict bool/);
  evidence.push({ language: 'python', scenario: 'isolated validator proper JSON values and strict bool', accepted: true });

  // Python bool is an int subclass: the adapter must reject it before serialization loses that distinction.
  const boolNumber = execute('python', wrapProgram('python', 'def solve(value):\n return True', contract, [4]));
  assert.equal(boolNumber.status, 2);
  assert.match(boolNumber.stderr, /return: expected integer/);
  evidence.push({ language: 'python', scenario: 'bool is not integer', accepted: false });
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
