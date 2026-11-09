import { render, screen } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { StaffProfile } from '../features/auth/permissions';
import { Router } from './Router';

vi.mock('../features/cases/CaseDetailsPage', () => ({
  CaseDetailsPage: () => <div>صفحة الحالة: {useParams().id ?? 'بدون كود'}</div>,
}));
vi.mock('../features/cases/ArchivedCasesPage', () => ({
  ArchivedCasesPage: () => <div>صفحة الحالات المؤرشفة</div>,
}));

const manager: StaffProfile = {
  id: 'manager-1', employeeCode: 'M1', displayName: 'مدير', role: 'manager', active: true,
  permissions: { casesRead: true, casesWrite: true, donationsRead: true, donationsWrite: true, assistantUse: true },
};
const generalManager: StaffProfile = { ...manager, id:'general-manager-1', employeeCode:'GM1', role:'general_manager' };
const employee: StaffProfile = { ...manager, id:'employee-1', employeeCode:'E1', role:'employee', permissions:{casesRead:true,casesWrite:false,donationsRead:false,donationsWrite:false,assistantUse:false} };

it('opens the new-case route with the expected new identifier', () => {
  render(<MemoryRouter initialEntries={['/cases/new']}><Router session={manager} /></MemoryRouter>);
  expect(screen.getByText('صفحة الحالة: new')).toBeVisible();
});

it('allows only the general manager to open the archive route', () => {
  const { unmount }=render(<MemoryRouter initialEntries={['/cases/archive']}><Router session={generalManager} /></MemoryRouter>);
  expect(screen.getByText('صفحة الحالات المؤرشفة')).toBeVisible();
  unmount();
  render(<MemoryRouter initialEntries={['/cases/archive']}><Router session={employee} /></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'معندكش صلاحية للصفحة دي'})).toBeVisible();
  expect(screen.queryByText('صفحة الحالة: archive')).not.toBeInTheDocument();
});
