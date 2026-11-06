export type EmployeePermission = {
  casesRead: boolean;
  casesWrite: boolean;
  donationsRead: boolean;
  donationsWrite: boolean;
  assistantUse: boolean;
};
export type StaffRole = 'employee' | 'manager' | 'general_manager';
export type StaffProfile = {
  id: string;
  employeeCode: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  permissions: EmployeePermission;
};
export const canReadCases = (p: EmployeePermission): boolean =>
  p.casesRead || p.casesWrite;
export const canWriteCases = (p: EmployeePermission): boolean => p.casesWrite;
export const canReadDonations = (p: EmployeePermission): boolean =>
  p.donationsRead || p.donationsWrite;
export const canWriteDonations = (p: EmployeePermission): boolean =>
  p.donationsWrite;
export function hasPermission(
  s: Pick<StaffProfile, 'role' | 'active' | 'permissions'>,
  p: keyof EmployeePermission,
): boolean {
  if (!s.active) return false;
  if (s.role === 'general_manager' || s.role === 'manager') return true;
  if (p === 'casesRead') return canReadCases(s.permissions);
  if (p === 'donationsRead') return canReadDonations(s.permissions);
  return s.permissions[p];
}
