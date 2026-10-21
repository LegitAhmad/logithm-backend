import type { Checker } from '../../question/execution-contract';

/** JSON structural equality: object insertion order is irrelevant; array order is not. */
export function structurallyEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((value, index) => structurallyEqual(value, expected[index]));
  }
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  const a = actual as Record<string, unknown>;
  const e = expected as Record<string, unknown>;
  return actualKeys.length === expectedKeys.length && actualKeys.every((key) => Object.hasOwn(e, key) && structurallyEqual(a[key], e[key]));
}

export function checkValue(checker: Exclude<Checker, { type: 'custom' }>, actual: unknown, expected: unknown): boolean {
  if (checker.type === 'float') return typeof actual === 'number' && typeof expected === 'number' && Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= checker.tolerance;
  return structurallyEqual(actual, expected);
}

export function decodeEnvelope(stdout: string): unknown {
  const envelope: unknown = JSON.parse(stdout);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !('version' in envelope) || envelope.version !== 1 || !('value' in envelope) || Object.keys(envelope).length !== 2) {
    throw new Error('Missing typed return envelope');
  }
  return envelope.value;
}
