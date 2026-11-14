import type { CaseAdultIdentityCandidate } from './caseIdentity';
import type { CaseFileInput } from '../../services/cases';

const HIDE_GUARDIAN_CATEGORIES = ['أرملة', 'هجر', 'مطلقة'];

export function hidesGuardianFields(categories: readonly string[]): boolean {
  return categories.some((category) => HIDE_GUARDIAN_CATEGORIES.includes(category));
}

export function hidesFatherFields(categories: readonly string[]): boolean {
  return categories.includes('أرملة');
}

export function visibleCaseIdentityCandidates(input: Pick<CaseFileInput, 'categories' | 'fatherNationalId' | 'fatherDateOfBirth' | 'motherNationalId' | 'motherDateOfBirth' | 'nationalId' | 'contactDateOfBirth'>): CaseAdultIdentityCandidate[] {
  return [
    ...(!hidesFatherFields(input.categories) ? [{ nationalId: input.fatherNationalId ?? '', dateOfBirth: input.fatherDateOfBirth ?? '' }] : []),
    { nationalId: input.motherNationalId ?? '', dateOfBirth: input.motherDateOfBirth ?? '' },
    ...(!hidesGuardianFields(input.categories) ? [{ nationalId: input.nationalId, dateOfBirth: input.contactDateOfBirth ?? '' }] : []),
  ];
}

export function sanitizeCaseFileInput<T extends CaseFileInput>(input: T): T {
  const sanitized: CaseFileInput = { ...input };
  if (hidesFatherFields(input.categories)) {
    sanitized.fatherName = '';
    sanitized.fatherNationalId = '';
    sanitized.fatherNationalIdExpiresOn = '';
    sanitized.fatherDateOfBirth = '';
    sanitized.fatherGender = null;
    sanitized.fatherHealthCondition = '';
    sanitized.fatherHealthStatus = undefined;
    sanitized.fatherEmploymentStatus = null;
    sanitized.fatherOccupation = '';
  }
  if (hidesGuardianFields(input.categories)) {
    sanitized.contactName = '';
    sanitized.contactRelationship = '';
    sanitized.contactAge = null;
    sanitized.nationalId = '';
    sanitized.nationalIdExpiresOn = '';
    sanitized.contactDateOfBirth = '';
    sanitized.contactGender = null;
  }
  return sanitized as T;
}
