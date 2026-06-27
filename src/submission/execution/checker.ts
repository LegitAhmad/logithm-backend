export interface CheckerConfig {
  type: 'exact' | 'float' | 'custom';
  tolerance?: number;
}

const DEFAULT_FLOAT_TOLERANCE = 1e-6;

/**
 * Compares actual program output against the expected output for a test case.
 *
 * 'custom' checkers are not implemented: running a checker script requires the
 * same sandboxing as the submission itself, which is a separate piece of work.
 * They currently fall back to exact comparison.
 */
export function checkOutput(
  checker: CheckerConfig | undefined,
  actual: string,
  expected: string,
): boolean {
  const a = (actual ?? '').trim();
  const e = (expected ?? '').trim();

  if (checker?.type === 'float') {
    const actualNum = Number(a);
    const expectedNum = Number(e);

    if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) return false;

    const tolerance = checker.tolerance ?? DEFAULT_FLOAT_TOLERANCE;
    return Math.abs(actualNum - expectedNum) <= tolerance;
  }

  return a === e;
}
