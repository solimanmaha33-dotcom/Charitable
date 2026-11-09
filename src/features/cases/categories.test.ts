import { expect, it } from 'vitest';
import { CASE_CATEGORIES } from './categories';

it('offers current case types and removes death, generic orphans and maternal orphan category', () => {
  expect(CASE_CATEGORIES).toEqual([
    'هجر', 'أرملة', 'مطلقة', 'عجز أو مرض', 'يتيم الأب',
    'كبار السن (٦٠ سنة فأكثر)', 'أسرة مسجون',
  ]);
  expect(CASE_CATEGORIES).not.toContain('وفاة');
  expect(CASE_CATEGORIES).not.toContain('أيتام');
  expect(CASE_CATEGORIES).not.toContain('يتيم الأم');
});
