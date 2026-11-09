export const CASE_CATEGORIES = [
  'هجر',
  'أرملة',
  'مطلقة',
  'عجز أو مرض',
  'يتيم الأب',
  'كبار السن (٦٠ سنة فأكثر)',
  'أسرة مسجون',
] as const;
export type CaseCategory = typeof CASE_CATEGORIES[number];
export type StoredCaseCategory = CaseCategory | 'يتيم الأم' | 'وفاة' | 'أيتام';
export const isCaseCategory = (value: string): value is CaseCategory =>
  CASE_CATEGORIES.includes(value as CaseCategory);
