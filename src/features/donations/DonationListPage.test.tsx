import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DonationListPage } from './DonationListPage';

const service = vi.hoisted(() => ({
  cancelDonation:vi.fn(),voidPayment:vi.fn(),endSponsorship: vi.fn(), generateInstallments: vi.fn(), listDonations: vi.fn(), listDonors: vi.fn(), listCaseFilesByIds: vi.fn(),
  listPayments: vi.fn(), listSponsorships: vi.fn(), receivePayment: vi.fn(), saveDonor: vi.fn(),
}));
vi.mock('../../services/donations', () => ({
  ...service,
  PaymentAlreadyReceivedError: class extends Error {},
}));
const caseService = vi.hoisted(() => ({ listCaseFiles: vi.fn() }));
vi.mock('../../services/cases', () => ({ ...caseService, listCaseFilesByIds: service.listCaseFilesByIds }));

beforeEach(() => {
  service.generateInstallments.mockResolvedValue(undefined);
  service.listDonors.mockResolvedValue([]);
  service.listDonations.mockRejectedValue(new Error('offline'));
  service.listSponsorships.mockResolvedValue([]);
  service.listPayments.mockResolvedValue([]);
  service.listCaseFilesByIds.mockResolvedValue([]);
  caseService.listCaseFiles.mockResolvedValue([]);
});

describe('donation workspace', () => {
  it('keeps a canceled donation visible and requires a reason before canceling another',async()=>{
    service.listDonations.mockResolvedValue([
      {id:'d-1',donor_id:null,donation_type:'cash',kind:'cash',amount:100,quantity:null,unit:null,description:'',received_on:'2026-11-01',voided_at:'2026-11-02T00:00:00Z',voided_by:'staff',void_reason:'تسجيل مكرر'},
      {id:'d-2',donor_id:null,donation_type:'cash',kind:'cash',amount:200,quantity:null,unit:null,description:'',received_on:'2026-11-02',voided_at:null,voided_by:null,void_reason:null},
    ]);
    service.cancelDonation.mockResolvedValue(undefined);
    render(<MemoryRouter><DonationListPage canWrite canReadCases={false}/></MemoryRouter>);
    expect(await screen.findByText('ملغي')).toBeVisible();
    expect(screen.getByText('سبب الإلغاء: تسجيل مكرر')).toBeVisible();
    expect(screen.getByText('1 نشطة · 2 في السجل')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'إلغاء التبرع'}));
    fireEvent.change(screen.getByLabelText('سبب إلغاء التبرع'),{target:{value:'اتسجل بالغلط'}});
    fireEvent.click(screen.getByRole('button',{name:'تأكيد إلغاء التبرع'}));
    await waitFor(()=>expect(service.cancelDonation).toHaveBeenCalledWith('d-2','اتسجل بالغلط'));
  });
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

  it('keeps an archived linked sponsorship visible but excludes its file from new sponsorship choices', async () => {
    service.listDonations.mockResolvedValue([]);
    service.listSponsorships.mockResolvedValue([{ id: 's-1', donor_id: 'd-1', family_id: 'archived-1', monthly_amount: 300, start_date: '2026-01-01', end_date: null }]);
    service.listPayments.mockResolvedValue([]);
    service.listDonors.mockResolvedValue([{ id: 'd-1', name: 'متبرع تجريبي', phone: null, created_at: '2026-01-01' }]);
    caseService.listCaseFiles.mockResolvedValue([{ id: 'active-1', code: 'F-0001', father_name: 'أب حالي', mother_name: 'أم حالية', archived_at: null }]);
    service.listCaseFilesByIds.mockResolvedValue([{ id: 'archived-1', code: 'F-0002', father_name: 'أب قديم', mother_name: 'أم قديمة', archived_at: '2026-10-01T12:00:00Z' }]);
    render(<MemoryRouter><DonationListPage canWrite canReadCases /></MemoryRouter>);
    expect(await screen.findByText('ملف الحالة مؤرشف')).toBeVisible();
    expect(screen.getByText(/F-0002 — الأب: أب قديم/)).toBeVisible();
    expect(service.listCaseFilesByIds).toHaveBeenCalledWith(['archived-1']);
    const choice = screen.getByLabelText('ملف الكفالة') as HTMLSelectElement;
    expect(choice.textContent).toContain('F-0001');
    expect(choice.textContent).not.toContain('F-0002');
  });
});
