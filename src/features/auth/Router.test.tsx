import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { Router } from '../../app/Router';
import type { StaffProfile } from './permissions';
export const profile: StaffProfile = {
  id: 'synthetic',
  employeeCode: 'E1',
  displayName: 'Employee',
  role: 'employee',
  active: true,
  permissions: {
    casesRead: true,
    casesWrite: false,
    donationsRead: false,
    donationsWrite: false,
    assistantUse: false,
  },
};
it('denies direct navigation without the matching feature permission', () => {
  render(
    <MemoryRouter initialEntries={['/donations']}>
      <Router session={profile} />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole('heading', { name: 'معندكش صلاحية للصفحة دي' }),
  ).toBeVisible();
});
it('allows readable cases without donation or assistant permissions', () => {
  render(
    <MemoryRouter initialEntries={['/cases']}>
      <Router session={profile} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'الحالات' })).toBeVisible();
});
