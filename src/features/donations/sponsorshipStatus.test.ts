import { expect, it, vi } from 'vitest';
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

it('marks a voided installment as canceled before checking its due or received status',()=>{
 expect(getSponsorshipStatus('2026-01-01',null,'2026-02-01','2026-01-15')).toBe('voided');
});

it('uses the Cairo date by default before and after Cairo midnight', () => {
 vi.useFakeTimers();
 try {
  vi.setSystemTime(new Date('2026-01-31T21:30:00.000Z'));
  expect(getSponsorshipStatus('2026-01-31', null)).toBe('due');
  vi.setSystemTime(new Date('2026-01-31T22:30:00.000Z'));
  expect(getSponsorshipStatus('2026-01-31', null)).toBe('late');
 } finally {
  vi.useRealTimers();
 }
});
