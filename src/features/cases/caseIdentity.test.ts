import { expect, it } from 'vitest';
import { hasAdultCaseIdentity, hasValidNationalIdForExpiry } from './caseIdentity';

const today = '2026-11-09';

it('accepts a valid adult ID at the eighteenth birthday', () => {
  expect(hasAdultCaseIdentity([{ nationalId: '٣٠٨١١٠٩٠١١٢٣٤٥', dateOfBirth: '2008-11-09' }], today)).toBe(true);
});

it('rejects an ID whose reviewed date of birth makes the person under eighteen', () => {
  expect(hasAdultCaseIdentity([{ nationalId: '30811100112345', dateOfBirth: '2008-11-10' }], today)).toBe(false);
});

it('does not let an edited adult birth date turn a minor National ID into an adult identity', () => {
  expect(hasAdultCaseIdentity([{ nationalId: '30811100112345', dateOfBirth: '1990-01-01' }], today)).toBe(false);
});

it('checks another adult household member when the contact ID is missing', () => {
  expect(hasAdultCaseIdentity([
    { nationalId: '', dateOfBirth: '' },
    { nationalId: '29001011234567', dateOfBirth: '1990-01-01' },
  ], today)).toBe(true);
});

it('rejects short IDs, impossible dates, future dates, and missing dates', () => {
  expect(hasAdultCaseIdentity([{ nationalId: '123', dateOfBirth: '1980-01-01' }], today)).toBe(false);
  expect(hasAdultCaseIdentity([{ nationalId: '29902311234567', dateOfBirth: '1980-01-01' }], today)).toBe(false);
  expect(hasAdultCaseIdentity([{ nationalId: '29001011234567', dateOfBirth: '2030-01-01' }], today)).toBe(false);
  expect(hasAdultCaseIdentity([{ nationalId: '29001011234567', dateOfBirth: '' }], today)).toBe(true);
});

it('does not accept a widow case identity from a hidden father or guardian field', () => {
  expect(hasAdultCaseIdentity([
    { nationalId: '29001011234567', dateOfBirth: '1990-01-01' },
  ], today)).toBe(true);
});

it('requires a valid National ID for an identity expiry date', () => {
  expect(hasValidNationalIdForExpiry('', '2027-01-01', today)).toBe(false);
  expect(hasValidNationalIdForExpiry('123', '2027-01-01', today)).toBe(false);
  expect(hasValidNationalIdForExpiry('29001011234567', '2027-01-01', today)).toBe(true);
  expect(hasValidNationalIdForExpiry('', '', today)).toBe(true);
});
