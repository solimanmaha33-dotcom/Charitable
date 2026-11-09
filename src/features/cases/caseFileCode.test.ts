import { describe, expect, it } from 'vitest';
import { createCaseFileCode } from './caseFileCode';
describe('case-file codes', () => {
  it('pads the sequence without truncating larger values', () => {
    expect(createCaseFileCode(1)).toBe('F-0001');
    expect(createCaseFileCode(10000)).toBe('F-10000');
  });
  it('rejects invalid sequence numbers', () => {
    expect(() => createCaseFileCode(0)).toThrow();
    expect(() => createCaseFileCode(1.2)).toThrow();
  });
});
