import { cairoToday } from '../../shared/cairoDate';
import { ageOn } from './memberAge';

export type NationalIdScan = { nationalId: string | null; expiresOn: string | null };
export type EgyptianNationalIdDetails = {
  nationalId: string;
  birthDate: string;
  age: number;
  governorateCode: string;
  governorate: string;
  gender: 'female' | 'male';
};

export const EGYPTIAN_GOVERNORATES: Readonly<Record<string, string>> = {
  '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس',
  '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية',
  '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة',
  '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم',
  '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا', '28': 'أسوان',
  '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد', '33': 'مطروح',
  '34': 'شمال سيناء', '35': 'جنوب سيناء', '88': 'خارج مصر',
};

export function normalizeEgyptianNationalIdInput(value: string): string {
  return normalizeDigits(value).replace(/\D/gu, '').slice(0, 14);
}

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

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return validDate(year, month, day) === value;
}

export function parseEgyptianNationalId(value: string, today = cairoToday()): EgyptianNationalIdDetails | null {
  const nationalId = normalizeDigits(value).replace(/[\s-]/gu, '');
  if (!/^\d{14}$/u.test(nationalId) || !validCalendarDate(today)) return null;
  const century = nationalId[0];
  if (century !== '2' && century !== '3') return null;
  const year = Number(nationalId.slice(1, 3)) + (century === '2' ? 1900 : 2000);
  const birthDate = validDate(year, Number(nationalId.slice(3, 5)), Number(nationalId.slice(5, 7)));
  if (!birthDate || birthDate > today) return null;
  const governorateCode = nationalId.slice(7, 9);
  const governorate = EGYPTIAN_GOVERNORATES[governorateCode];
  if (!governorate) return null;
  const genderDigit = Number(nationalId[12]);
  return {
    nationalId,
    birthDate,
    age: ageOn(birthDate, today),
    governorateCode,
    governorate,
    gender: genderDigit % 2 === 0 ? 'female' : 'male',
  };
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
