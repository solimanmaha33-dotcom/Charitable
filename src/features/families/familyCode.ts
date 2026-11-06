export function createFamilyCode(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError('Invalid family sequence');
  return `F-${String(sequence).padStart(4, '0')}`;
}
