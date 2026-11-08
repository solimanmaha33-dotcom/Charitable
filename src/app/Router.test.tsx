import { render, screen } from '@testing-library/react';
import { MemoryRouter, useParams } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { StaffProfile } from '../features/auth/permissions';
import { Router } from './Router';

vi.mock('../features/cases/CaseDetailsPage', () => ({
  CaseDetailsPage: () => <div>صفحة الحالة: {useParams().id ?? 'بدون كود'}</div>,
}));

const manager: StaffProfile = {
  id: 'manager-1', employeeCode: 'M1', displayName: 'مدير', role: 'manager', active: true,
  permissions: { casesRead: true, casesWrite: true, donationsRead: true, donationsWrite: true, assistantUse: true },
};

it('opens the new-case route with the expected new identifier', () => {
  render(<MemoryRouter initialEntries={['/cases/new']}><Router session={manager} /></MemoryRouter>);
  expect(screen.getByText('صفحة الحالة: new')).toBeVisible();
});
