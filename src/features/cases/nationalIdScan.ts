export type NationalIdScan = { nationalId: string | null; expiresOn: string | null };

const digitMap = new Map([
  ...[...'٠١٢٣٤٥٦٧٨٩'].map((digit, index) => [digit, String(index)] as const),
  ...[...'۰۱۲۳۴۵۶۷۸۹'].map((digit, index) => [digit, String(index)] as const),
]);

function normalizeDigits(value: string): string {
  return [...value].map((digit) => digitMap.get(digit) ?? digit).join('');
}

function validDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function labeledExpiry(text: string): string | null {
  const normalized = normalizeDigits(text);
  const label = /(?:تاريخ\s*(?:ال)?انتهاء|ينتهي|صالح\s*حتى|expiry|expires|valid\s*until)/giu;
  for (const match of normalized.matchAll(label)) {
    const start = (match.index ?? 0) + match[0].length;
    const nearby = normalized.slice(start, start + 90).split(/\n|تاريخ\s*(?:الميلاد|الولادة)|date\s+of\s+birth|birth\s+date/iu)[0];
    const date = nearby.match(/(?:^|\D)(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})(?!\d)|(?:^|\D)(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\d)/u);
    if (!date) continue;
    if (date[3]) {
      const result = validDate(Number(date[3]), Number(date[2]), Number(date[1]));
      if (result) return result;
    } else {
      const result = validDate(Number(date[4]), Number(date[5]), Number(date[6]));
      if (result) return result;
    }
  }
  return null;
}

export function parseNationalIdScan(text: string): NationalIdScan {
  const normalized = normalizeDigits(text);
  const idMatch = normalized.match(/(?:^|\D)(\d(?:[\s-]*\d){13})(?!\d)/u);
  const nationalId = idMatch?.[1].replace(/[\s-]/gu, '') ?? null;
  return { nationalId, expiresOn: labeledExpiry(normalized) };
}
