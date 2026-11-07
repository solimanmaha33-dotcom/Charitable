import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';
import type { StaffProfile } from '../auth/permissions';

const staff: StaffProfile = {
  id: 'test-id', employeeCode: 'E1', displayName: 'سارة', role: 'employee', active: true,
  permissions: { casesRead: true, casesWrite: true, donationsRead: false, donationsWrite: false, assistantUse: false },
};

describe('home workspace', () => {
  it('shows practical family and case actions for a case worker without made-up counts', () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'أهلاً بيك، سارة' })).toBeVisible();
    expect(screen.getByRole('link', { name: /إضافة أسرة/ })).toHaveAttribute('href', '/families?add=1');
    expect(screen.getByRole('link', { name: /تسجيل حالة/ })).toHaveAttribute('href', '/cases/new');
    expect(screen.queryByText(/أسرة مسجلة|حالة مفتوحة/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /التبرعات|المساعد/ })).not.toBeInTheDocument();
  });

  it('shows only donation actions when the employee can only manage donations', () => {
    const donor: StaffProfile = { ...staff, permissions: { casesRead: false, casesWrite: false, donationsRead: true, donationsWrite: true, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={donor} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /التبرعات والكفالات/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /إضافة أسرة|تسجيل حالة/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /تسجيل تبرع/ })).toHaveAttribute('href', '/donations?add=donation');
  });

  it('shows manager case creation shortcuts even when employee permission flags are unset', () => {
    const manager: StaffProfile = { ...staff, role: 'manager', permissions: { casesRead: false, casesWrite: false, donationsRead: false, donationsWrite: false, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={manager} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /إضافة أسرة/ })).toHaveAttribute('href', '/families?add=1');
    expect(screen.getByRole('link', { name: /تسجيل حالة/ })).toHaveAttribute('href', '/cases/new');
  });
});
