import { expect, it } from 'vitest';
import { normalizeArabicSearch } from './arabicSearch';
it('matches common alef variants and diacritics without mutating the input', () => {
  const original = 'إِبْرَاهِيم أَحْمَد';
  expect(normalizeArabicSearch(original)).toBe(normalizeArabicSearch('ابراهيم احمد'));
  expect(original).toBe('إِبْرَاهِيم أَحْمَد');
});
