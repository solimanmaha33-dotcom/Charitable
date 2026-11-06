import { describe, expect, it } from 'vitest';
import { createFamilyCode } from './familyCode';
describe('family codes', () => {
  it('pads the sequence without truncating larger values', () => {
    expect(createFamilyCode(1)).toBe('F-0001');
    expect(createFamilyCode(10000)).toBe('F-10000');
  });
  it('rejects invalid sequence numbers', () => {
    expect(() => createFamilyCode(0)).toThrow();
    expect(() => createFamilyCode(1.2)).toThrow();
  });
});
