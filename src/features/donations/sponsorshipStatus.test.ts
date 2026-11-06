import { expect, it } from 'vitest';
import { getSponsorshipStatus } from './sponsorshipStatus';
it.each([
 ['2026-01-31', null, '2026-01-30', 'due'],
 ['2026-01-31', null, '2026-01-31', 'due'],
 ['2026-01-31', null, '2026-02-01', 'late'],
 ['2026-01-31', '2026-02-02', '2026-02-03', 'received'],
 ['2026-01-31', '2026-01-20', '2026-02-03', 'received'],
] as const)('installment %s received %s on %s is %s', (due, received, today, status) => {
 expect(getSponsorshipStatus(due, received, today)).toBe(status);
});
it('rejects timestamps and impossible calendar dates instead of comparing ambiguous boundaries', () => {
 expect(() => getSponsorshipStatus('2026-02-30', null, '2026-03-01')).toThrow();
 expect(() => getSponsorshipStatus('2026-02-28', null, '2026-03-01T00:00:00Z')).toThrow();
});
