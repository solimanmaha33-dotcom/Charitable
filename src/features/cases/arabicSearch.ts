export function normalizeArabicSearch(value: string): string {
  return [...value.normalize('NFKC')].map((character) => {
    const arabicDigit = '٠١٢٣٤٥٦٧٨٩'.indexOf(character);
    if (arabicDigit >= 0) return String(arabicDigit);
    const persianDigit = '۰۱۲۳۴۵۶۷۸۹'.indexOf(character);
    return persianDigit >= 0 ? String(persianDigit) : character;
  }).join('').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').toLowerCase().trim();
}
