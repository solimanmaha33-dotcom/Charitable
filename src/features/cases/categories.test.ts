import { expect, it } from 'vitest';
import { CASE_CATEGORIES } from './categories';

it('offers the current case types and removes death and the generic orphan label', () => {
  expect(CASE_CATEGORIES).toEqual([
    'هجر', 'أرملة', 'مطلقة', 'عجز أو مرض', 'يتيم الأم', 'يتيم الأب',
    'كبار السن (٦٠ سنة فأكثر)', 'أسرة مسجون',
  ]);
  expect(CASE_CATEGORIES).not.toContain('وفاة');
  expect(CASE_CATEGORIES).not.toContain('أيتام');
});
