import { ageOn } from './memberAge';
import { parseEgyptianNationalId, normalizeEgyptianNationalIdInput } from './nationalIdScan';

export type CaseAdultIdentityCandidate = { nationalId: string; dateOfBirth: string };

export function hasValidNationalIdForExpiry(nationalId: string | null | undefined, expiresOn: string | null | undefined, today: string): boolean {
  if (!expiresOn) return true;
  return Boolean(parseEgyptianNationalId(normalizeEgyptianNationalIdInput(nationalId ?? ''), today));
}

function validDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value > today) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function hasAdultCaseIdentity(candidates: readonly CaseAdultIdentityCandidate[], today: string): boolean {
  return candidates.some(({ nationalId, dateOfBirth }) => {
    const id = normalizeEgyptianNationalIdInput(nationalId);
    const parsedId = parseEgyptianNationalId(id, today);
    if (!parsedId) return false;
    const reviewedBirthDate = dateOfBirth || parsedId.birthDate;
    return ageOn(parsedId.birthDate, today) >= 18
      && validDate(reviewedBirthDate, today)
      && ageOn(reviewedBirthDate, today) >= 18;
  });
}
