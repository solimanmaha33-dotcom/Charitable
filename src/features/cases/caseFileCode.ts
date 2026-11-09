export function createCaseFileCode(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError('Invalid case-file sequence');
  return `F-${String(sequence).padStart(4, '0')}`;
}
