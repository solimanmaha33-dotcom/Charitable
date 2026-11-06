export function normalizeArabicSearch(value: string): string {
  return value.normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').toLowerCase().trim();
}
