export const CASE_CATEGORIES = ['هجر', 'وفاة', 'أرملة', 'مطلقة', 'عجز أو مرض', 'أيتام'] as const;
export type CaseCategory = typeof CASE_CATEGORIES[number];
