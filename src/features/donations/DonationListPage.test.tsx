import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DonationListPage } from './DonationListPage';

const service = vi.hoisted(() => ({
  endSponsorship: vi.fn(), generateInstallments: vi.fn(), listDonations: vi.fn(), listDonors: vi.fn(),
  listPayments: vi.fn(), listSponsorships: vi.fn(), receivePayment: vi.fn(), saveDonor: vi.fn(), utcToday: vi.fn(),
}));
vi.mock('../../services/donations', () => ({
  ...service,
  PaymentAlreadyReceivedError: class extends Error {},
}));
vi.mock('../../services/cases', () => ({ listCaseFiles: vi.fn().mockResolvedValue([]) }));

beforeEach(() => {
  service.generateInstallments.mockResolvedValue(undefined);
  service.listDonors.mockResolvedValue([]);
  service.listDonations.mockRejectedValue(new Error('offline'));
  service.listSponsorships.mockResolvedValue([]);
  service.listPayments.mockResolvedValue([]);
});

describe('donation workspace', () => {
  it('opens the donation form when opened from the home shortcut', async () => {
    service.listDonations.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={['/donations?add=donation']}><DonationListPage canWrite canReadCases={false} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'تسجيل تبرع' })).toBeVisible();
  });

  it('does not report zero or empty records when data could not be loaded', async () => {
    render(<MemoryRouter><DonationListPage canWrite={false} canReadCases /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر تحميل التبرعات والكفالات');
    expect(screen.queryByText('0 متبرعين')).not.toBeInTheDocument();
    expect(screen.queryByText('0 تبرعات')).not.toBeInTheDocument();
    expect(screen.queryByText('0 كفالات')).not.toBeInTheDocument();
    expect(screen.queryByText('مفيش متبرعين مسجلين لسه.')).not.toBeInTheDocument();
    expect(screen.queryByText('مفيش تبرعات مسجلة لسه.')).not.toBeInTheDocument();
    expect(screen.queryByText('مفيش كفالات شهرية مسجلة لسه.')).not.toBeInTheDocument();
  });

  it('does not expose a sponsorship count without permission to read cases', async () => {
    service.listDonations.mockResolvedValue([]);
    render(<MemoryRouter><DonationListPage canWrite={false} canReadCases={false} /></MemoryRouter>);
    expect(await screen.findByText(/مفيش تبرعات مسجلة لسه/)).toBeVisible();
    expect(screen.queryByText('0 كفالات')).not.toBeInTheDocument();
    expect(screen.getByText(/عدد الكفالات مش متاح من غير صلاحية قراءة الحالات/)).toBeVisible();
  });
});
