import { expect, it } from 'vitest';
import { sanitizeCaseFileInput, visibleCaseIdentityCandidates } from './caseProfileVisibility';
import type { CaseFileInput } from '../../services/cases';

const profile: CaseFileInput = {
  fatherName: 'أب', motherName: 'أم', contactName: 'مسؤول', contactRelationship: 'خال', contactAge: 40,
  nationalId: '29001011234567', nationalIdExpiresOn: '2027-01-01', phones: ['01012345678'], notes: '', address: '',
  monthlyIncome: null, healthCondition: '', branchArea: '', fileStatus: 'نشط', statusReason: '', categories: ['أرملة'],
  fatherNationalId: '29001011234567', fatherNationalIdExpiresOn: '2027-01-01', motherNationalId: '', fatherDateOfBirth: '1990-01-01', fatherGender: 'male',
  fatherHealthCondition: 'ضغط', fatherHealthStatus: 'مرض', fatherEmploymentStatus: 'يعمل', fatherOccupation: 'تاجر',
  motherDateOfBirth: '', motherGender: null, contactDateOfBirth: '1990-01-01', contactGender: 'male',
};

it('does not count hidden father or guardian identities for a widow case', () => {
  expect(visibleCaseIdentityCandidates(profile)).toEqual([{ nationalId: '', dateOfBirth: '' }]);
});

it('clears hidden father and guardian information when saving a widow case', () => {
  expect(sanitizeCaseFileInput(profile)).toMatchObject({
    fatherName: '', fatherNationalId: '', fatherNationalIdExpiresOn: '', fatherDateOfBirth: '', fatherGender: null,
    fatherHealthCondition: '', fatherHealthStatus: undefined, fatherEmploymentStatus: null, fatherOccupation: '',
    contactName: '', contactRelationship: '', contactAge: null, nationalId: '', nationalIdExpiresOn: '',
    contactDateOfBirth: '', contactGender: null, motherName: 'أم',
  });
});

it('keeps father details for divorce while clearing the hidden guardian', () => {
  const input: CaseFileInput = { ...profile, categories: ['مطلقة'] };
  expect(visibleCaseIdentityCandidates(input)).toEqual([{ nationalId: '29001011234567', dateOfBirth: '1990-01-01' }, { nationalId: '', dateOfBirth: '' }]);
  expect(sanitizeCaseFileInput(input)).toMatchObject({ fatherName: 'أب', fatherNationalId: '29001011234567', contactName: '', nationalId: '' });
});
