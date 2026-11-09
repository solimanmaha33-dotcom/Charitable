export const CASE_CATEGORIES = [
  'هجر',
  'أرملة',
  'مطلقة',
  'عجز أو مرض',
  'يتيم الأب',
  'كبار السن (٦٠ سنة فأكثر)',
  'أسرة مسجون',
  'أخرى',
] as const;
export type CaseCategory = typeof CASE_CATEGORIES[number];
export type StoredCaseCategory = CaseCategory | 'يتيم الأم' | 'وفاة' | 'أيتام';
export const isCaseCategory = (value: string): value is CaseCategory =>
  CASE_CATEGORIES.includes(value as CaseCategory);

export const EXCLUSIVE_CASE_CATEGORY_GROUPS: readonly (readonly CaseCategory[])[] = [['هجر', 'أرملة', 'مطلقة']];

export function updateCaseCategorySelection(current: CaseCategory[], category: CaseCategory, checked: boolean): CaseCategory[] {
  if (!checked) return current.filter((item) => item !== category);
  const exclusiveGroup = EXCLUSIVE_CASE_CATEGORY_GROUPS.find((group) => group.includes(category));
  return [...current.filter((item) => item !== category && (!exclusiveGroup || !exclusiveGroup.includes(item))), category];
}

export function hasConflictingCaseCategories(categories: readonly string[]): boolean {
  return EXCLUSIVE_CASE_CATEGORY_GROUPS.some((group) => categories.filter((category) => group.includes(category as CaseCategory)).length > 1);
}
