import { expect, it } from 'vitest';
import { addDateOnlyDays, cairoToday, lastDateOfCairoMonth } from './cairoDate';

it.each([
  ['2026-01-01T21:30:00.000Z', '2026-01-01'],
  ['2026-01-01T22:30:00.000Z', '2026-01-02'],
  ['2026-07-01T20:30:00.000Z', '2026-07-01'],
  ['2026-07-01T21:30:00.000Z', '2026-07-02'],
])('uses Cairo calendar date at %s', (instant, expected) => {
  expect(cairoToday(new Date(instant))).toBe(expected);
});

it('adds calendar days without shifting at timezone boundaries', () => {
  expect(addDateOnlyDays('2026-01-31', 1)).toBe('2026-02-01');
  expect(addDateOnlyDays('2024-02-28', 1)).toBe('2024-02-29');
});

it('finds the last day of the Cairo calendar month', () => {
  expect(lastDateOfCairoMonth('2026-02-01')).toBe('2026-02-28');
  expect(lastDateOfCairoMonth('2024-02-01')).toBe('2024-02-29');
});
