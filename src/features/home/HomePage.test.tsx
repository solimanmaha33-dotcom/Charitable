import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';
import type { StaffProfile } from '../auth/permissions';

const counts = vi.hoisted(() => ({ families: vi.fn(), cases: vi.fn(), donations: vi.fn() }));
vi.mock('../../services/cases', () => ({ countFamilies: counts.families, countCases: counts.cases }));
vi.mock('../../services/donations', () => ({ countDonations: counts.donations }));

const staff: StaffProfile = {
  id: 'test-id', employeeCode: 'E1', displayName: 'سارة', role: 'employee', active: true,
  permissions: { casesRead: true, casesWrite: true, donationsRead: false, donationsWrite: false, assistantUse: false },
};

beforeEach(() => {
  counts.families.mockResolvedValue(3);
  counts.cases.mockResolvedValue(5);
  counts.donations.mockResolvedValue(2);
  counts.families.mockClear();
  counts.cases.mockClear();
  counts.donations.mockClear();
});

describe('home workspace', () => {
  it('shows practical family and case actions for a case worker without made-up counts', () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'أهلاً بيك، سارة' })).toBeVisible();
    expect(screen.getByRole('link', { name: /إضافة أسرة/ })).toHaveAttribute('href', '/families?add=1');
    expect(screen.getByRole('link', { name: /تسجيل حالة/ })).toHaveAttribute('href', '/cases/new');
    expect(screen.queryByText(/أسرة مسجلة|حالة مفتوحة/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /التبرعات|المساعد/ })).not.toBeInTheDocument();
  });

  it('shows only exact totals for records the employee can read', async () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(await screen.findByTestId('summary-families')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-cases')).toHaveTextContent('5');
    expect(screen.queryByTestId('summary-donations')).not.toBeInTheDocument();
    expect(counts.families).toHaveBeenCalledOnce();
    expect(counts.cases).toHaveBeenCalledOnce();
    expect(counts.donations).not.toHaveBeenCalled();
  });

  it('does not turn a failed count request into a zero total', async () => {
    counts.families.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(await screen.findByTestId('summary-families')).toHaveTextContent('تعذّر التحميل');
    expect(screen.getByTestId('summary-cases')).toHaveTextContent('5');
  });

  it('shows only donation actions when the employee can only manage donations', () => {
    const donor: StaffProfile = { ...staff, permissions: { casesRead: false, casesWrite: false, donationsRead: true, donationsWrite: true, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={donor} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /التبرعات والكفالات/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /إضافة أسرة|تسجيل حالة/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /تسجيل تبرع/ })).toHaveAttribute('href', '/donations?add=donation');
  });

  it('shows a donation total without requesting restricted case totals', async () => {
    const donor: StaffProfile = { ...staff, permissions: { casesRead: false, casesWrite: false, donationsRead: true, donationsWrite: false, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={donor} /></MemoryRouter>);
    expect(await screen.findByTestId('summary-donations')).toHaveTextContent('2');
    expect(screen.queryByTestId('summary-families')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-cases')).not.toBeInTheDocument();
    expect(counts.donations).toHaveBeenCalledOnce();
    expect(counts.families).not.toHaveBeenCalled();
    expect(counts.cases).not.toHaveBeenCalled();
  });

  it('shows manager case creation shortcuts even when employee permission flags are unset', () => {
    const manager: StaffProfile = { ...staff, role: 'manager', permissions: { casesRead: false, casesWrite: false, donationsRead: false, donationsWrite: false, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={manager} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /إضافة أسرة/ })).toHaveAttribute('href', '/families?add=1');
    expect(screen.getByRole('link', { name: /تسجيل حالة/ })).toHaveAttribute('href', '/cases/new');
  });
});
