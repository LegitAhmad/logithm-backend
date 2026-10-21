import { checkValue, decodeEnvelope, structurallyEqual } from './checker';

describe('typed value checker', () => {
  it('compares object structure independently of property order but preserves array order and primitive types', () => {
    expect(structurallyEqual({ a: [1, { x: false }], b: null }, { b: null, a: [1, { x: false }] })).toBe(true);
    expect(structurallyEqual([1, 2], [2, 1])).toBe(false);
    expect(structurallyEqual(false, 0)).toBe(false);
    expect(structurallyEqual({ a: null }, {})).toBe(false);
  });
  it('compares finite numeric values using absolute tolerance only', () => {
    expect(checkValue({ type: 'float', tolerance: 0.001 }, 1.0005, 1)).toBe(true);
    expect(checkValue({ type: 'float', tolerance: 0.001 }, 1.002, 1)).toBe(false);
    for (const value of ['1', false, null, Infinity, NaN]) expect(checkValue({ type: 'float', tolerance: 1 }, value, 1)).toBe(false);
  });
  it('requires a versioned return envelope, not matching stdout or injected extra log lines', () => {
    for (const output of ['42', 'debug\n{"version":1,"value":42}', '{"version":2,"value":42}', '{"version":1}', '{"version":1,"value":42,"extra":true}']) expect(() => decodeEnvelope(output)).toThrow();
    for (const value of [0, false, null, '', [], {}]) expect(decodeEnvelope(JSON.stringify({ version: 1, value }))).toEqual(value);
  });
});
