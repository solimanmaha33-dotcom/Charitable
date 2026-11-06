import { describe, expect, it } from 'vitest';
import {
  canReadCases,
  canWriteCases,
  canReadDonations,
  canWriteDonations,
  hasPermission,
  type EmployeePermission,
} from './permissions';
const none: EmployeePermission = {
  casesRead: false,
  casesWrite: false,
  donationsRead: false,
  donationsWrite: false,
  assistantUse: false,
};
describe('staff permissions', () => {
  it.each([
    [false, false, false, false],
    [true, false, true, false],
    [false, true, true, true],
    [true, true, true, true],
  ])(
    'case and donation read/write grants (%s,%s)',
    (read, write, wantRead, wantWrite) => {
      const p = {
        ...none,
        casesRead: read,
        casesWrite: write,
        donationsRead: read,
        donationsWrite: write,
      };
      expect(canReadCases(p)).toBe(wantRead);
      expect(canWriteCases(p)).toBe(wantWrite);
      expect(canReadDonations(p)).toBe(wantRead);
      expect(canWriteDonations(p)).toBe(wantWrite);
    },
  );
  it.each(['manager', 'general_manager'] as const)(
    'grants %s all feature permissions',
    (role) => {
      for (const permission of Object.keys(
        none,
      ) as (keyof EmployeePermission)[])
        expect(
          hasPermission({ role, active: true, permissions: none }, permission),
        ).toBe(true);
    },
  );
  it('denies inactive staff even with role grants', () =>
    expect(
      hasPermission(
        { role: 'general_manager', active: false, permissions: none },
        'casesWrite',
      ),
    ).toBe(false));
  it('keeps employee features independent', () => {
    expect(
      hasPermission(
        {
          role: 'employee',
          active: true,
          permissions: { ...none, casesWrite: true },
        },
        'casesRead',
      ),
    ).toBe(true);
    expect(
      hasPermission(
        {
          role: 'employee',
          active: true,
          permissions: { ...none, casesWrite: true },
        },
        'donationsRead',
      ),
    ).toBe(false);
  });
});
