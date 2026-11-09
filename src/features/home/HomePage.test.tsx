import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';
import type { StaffProfile } from '../auth/permissions';
import {addDateOnlyDays,cairoToday} from '../cases/idExpiry';

const counts = vi.hoisted(() => ({ caseFiles: vi.fn(), fileRows: vi.fn(), members: vi.fn(), donations: vi.fn(), expirations: vi.fn(), ageMembers:vi.fn(), reviews:vi.fn(), sponsorships:vi.fn(), payments:vi.fn(), generateInstallments:vi.fn() }));
vi.mock('../../services/cases', () => ({ countCaseFiles: counts.caseFiles, listCaseFiles: counts.fileRows, listAllMembers: counts.members, listCaseFilesByIds:counts.fileRows, listCaseFileIdExpirationsBy: counts.expirations,listAgeThresholdMembers:counts.ageMembers,listCaseReviewDatesBy:counts.reviews }));
vi.mock('../../services/donations', () => ({ countDonations: counts.donations,listSponsorships:counts.sponsorships,listPayments:counts.payments,generateInstallments:counts.generateInstallments }));

const staff: StaffProfile = {
  id: 'test-id', employeeCode: 'E1', displayName: 'سارة', role: 'employee', active: true,
  permissions: { casesRead: true, casesWrite: true, donationsRead: false, donationsWrite: false, assistantUse: false },
};

beforeEach(() => {
  counts.caseFiles.mockResolvedValue(3);
  counts.fileRows.mockResolvedValue([
    { id:'f1',code:'F-1',father_name:'أب',mother_name:'أم',case_file_categories:[{category:'يتيم الأب'}] },
    { id:'f2',code:'F-2',father_name:'أب آخر',mother_name:'أم أخرى',case_file_categories:[{category:'أرملة'}] },
  ]);
  counts.members.mockResolvedValue([
    { family_id: 'f1', person_id: 'p1', relationship: 'ابن', people: { name: 'علي', gender: 'male', date_of_birth: '2018-01-01' } },
    { family_id: 'f2', person_id: 'p2', relationship: 'بنت', people: { name: 'سلمى', gender: 'female', date_of_birth: '2019-01-01' } },
  ]);
  counts.donations.mockResolvedValue(2);
  counts.expirations.mockResolvedValue([]);
  counts.ageMembers.mockResolvedValue([]);
  counts.reviews.mockResolvedValue([]);
  counts.sponsorships.mockResolvedValue([]);
  counts.payments.mockResolvedValue([]);
  counts.generateInstallments.mockResolvedValue(undefined);
  counts.caseFiles.mockClear();
  counts.fileRows.mockClear();
  counts.members.mockClear();
  counts.donations.mockClear();
  counts.expirations.mockClear();
  counts.ageMembers.mockClear();
  counts.reviews.mockClear();
  counts.sponsorships.mockClear();
  counts.payments.mockClear();
  counts.generateInstallments.mockClear();
});

describe('home workspace', () => {
  it('shows practical family and case actions for a case worker without made-up counts', () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'أهلاً بيك، سارة' })).toBeVisible();
    expect(screen.getByRole('link', { name: /إضافة حالة جديدة/ })).toHaveAttribute('href', '/cases/new');
    expect(screen.queryByText(/أسرة مسجلة|حالة مفتوحة/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /التبرعات|المساعد/ })).not.toBeInTheDocument();
  });

  it('shows only exact totals for records the employee can read', async () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(await screen.findByTestId('summary-cases')).toHaveTextContent('٣');
    expect(screen.getByTestId('summary-children')).toHaveTextContent('٢');
    expect(screen.getByTestId('summary-orphans')).toHaveTextContent('١');
    expect(screen.queryByTestId('summary-families')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-donations')).not.toBeInTheDocument();
    expect(counts.caseFiles).toHaveBeenCalledOnce();
    expect(counts.fileRows).toHaveBeenCalledOnce();
    expect(counts.members).toHaveBeenCalledOnce();
    expect(counts.donations).not.toHaveBeenCalled();
  });

  it('shows expired and soon-to-expire IDs as case-file links', async()=>{
    const today=cairoToday();
    counts.expirations.mockResolvedValue([
      {id:'old',code:'F-OLD',father_name:'أحمد',mother_name:'منى',contact_name:null,national_id_expires_on:addDateOnlyDays(today,-1)},
      {id:'soon',code:'F-SOON',father_name:'محمود',mother_name:'سعاد',contact_name:'مسؤولة',national_id_expires_on:addDateOnlyDays(today,25)},
    ]);
    render(<MemoryRouter><HomePage staff={staff}/></MemoryRouter>);
    expect(await screen.findByText('منتهية')).toBeVisible();
    expect(screen.getByRole('link',{name:/أحمد/})).toHaveAttribute('href','/cases/old');
    expect(await screen.findByText(/هتنتهي خلال ٢٥ يوم/)).toBeVisible();
    expect(screen.getByRole('link',{name:/محمود/})).toHaveAttribute('href','/cases/soon');
    expect(counts.expirations).toHaveBeenCalledWith(addDateOnlyDays(today,30));
    expect(screen.getByText('خلال ٣٠ يوم')).toBeVisible();
  });

  it('shows the correct age threshold reminder and family link',async()=>{
    const today=cairoToday();const threshold=addDateOnlyDays(today,25);const [year,month,day]=threshold.split('-');
    counts.ageMembers.mockResolvedValue([{family_id:'family-1',person_id:'member-1',relationship:'بنت',people:{name:'ريم',gender:'female',date_of_birth:`${Number(year)-21}-${month}-${day}`},case_file:{father_name:'أحمد',mother_name:'منى',code:'F-0001'}}]);
    render(<MemoryRouter><HomePage staff={staff}/></MemoryRouter>);
    expect(await screen.findByText((_text,element)=>element?.tagName==='SMALL'&&element.textContent?.includes('هيكمل ٢١ سنة')===true)).toBeVisible();
    expect(await screen.findByText('خلال ٢٥ يوم')).toBeVisible();
    expect(screen.getByText('قبل السن المحدد بـ٣٠ يوم')).toBeVisible();
    expect(screen.getByRole('link',{name:/ريم · الأب: أحمد/})).toHaveAttribute('href','/cases/family-1');
    expect(counts.ageMembers).toHaveBeenCalledOnce();
  });

  it('does not turn a failed count request into a zero total', async () => {
    counts.caseFiles.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    expect(await screen.findByTestId('summary-cases')).toHaveTextContent('تعذّر التحميل');
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
    expect(await screen.findByTestId('summary-donations')).toHaveTextContent('٢');
    expect(screen.queryByTestId('summary-cases')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-children')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-orphans')).not.toBeInTheDocument();
    expect(counts.donations).toHaveBeenCalledOnce();
    expect(counts.caseFiles).not.toHaveBeenCalled();
    expect(counts.fileRows).not.toHaveBeenCalled();
    expect(counts.members).not.toHaveBeenCalled();
    expect(counts.expirations).not.toHaveBeenCalled();
    expect(counts.ageMembers).not.toHaveBeenCalled();
  });

  it('shows manager case creation shortcuts even when employee permission flags are unset', () => {
    const manager: StaffProfile = { ...staff, role: 'manager', permissions: { casesRead: false, casesWrite: false, donationsRead: false, donationsWrite: false, assistantUse: false } };
    render(<MemoryRouter><HomePage staff={manager} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /إضافة حالة جديدة/ })).toHaveAttribute('href', '/cases/new');
  });

  it('shows work shortcuts before the reminders', () => {
    render(<MemoryRouter><HomePage staff={staff} /></MemoryRouter>);
    const actions = screen.getByRole('heading', { name: 'ابدأ من هنا' });
    const reminders = screen.getByRole('heading', { name: 'متابعة انتهاء بطاقات الرقم القومي' });
    expect(actions.compareDocumentPosition(reminders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows case re-search reminders and unpaid sponsorship followups only to staff who can read both areas',async()=>{
    const today=cairoToday();const donor:StaffProfile={...staff,permissions:{casesRead:true,casesWrite:false,donationsRead:true,donationsWrite:false,assistantUse:false}};
    counts.reviews.mockResolvedValue([{id:'f1',code:'F-1',father_name:'أحمد',mother_name:'منى',next_review_date:today}]);
    counts.sponsorships.mockResolvedValue([{id:'s1',family_id:'f1'}]);
    counts.payments.mockResolvedValue([{id:'p1',sponsorship_id:'s1',due_date:addDateOnlyDays(today,6),amount_due:300,received_on:null,voided_at:null}]);
    counts.fileRows.mockResolvedValue([{id:'f1',code:'F-1',father_name:'أحمد',mother_name:'منى',case_file_categories:[]}]);
    render(<MemoryRouter><HomePage staff={donor}/></MemoryRouter>);
    expect(await screen.findByRole('heading',{name:'حالات محتاجة إعادة بحث'})).toBeVisible();
    expect(await screen.findByText('ميعادها النهارده')).toBeVisible();
    expect(screen.getByRole('link',{name:/F-1 — الأب: أحمد/})).toHaveAttribute('href','/donations');
    expect(screen.getByRole('heading',{name:'متابعة الكفالات الشهرية'})).toBeVisible();
    expect(await screen.findByText('خلال ٦ يوم')).toBeVisible();
    expect(counts.reviews).toHaveBeenCalledWith(addDateOnlyDays(today,30));
    expect(counts.sponsorships).toHaveBeenCalledOnce();expect(counts.payments).toHaveBeenCalledOnce();
    expect(counts.generateInstallments).toHaveBeenCalledOnce();
    expect(counts.generateInstallments.mock.invocationCallOrder[0]).toBeLessThan(counts.payments.mock.invocationCallOrder[0]!);
  });

  it('materializes a next-month sponsorship due within 30 days before loading dashboard reminders',async()=>{
    const today=cairoToday();const donor:StaffProfile={...staff,permissions:{casesRead:true,casesWrite:false,donationsRead:true,donationsWrite:false,assistantUse:false}};
    const futureDue=addDateOnlyDays(today,25);
    counts.generateInstallments.mockImplementationOnce(async()=>{
      counts.payments.mockResolvedValue([{id:'future-payment',sponsorship_id:'future-sponsorship',due_date:futureDue,amount_due:400,received_on:null,voided_at:null}]);
    });
    counts.sponsorships.mockResolvedValue([{id:'future-sponsorship',family_id:'future-case'}]);
    counts.fileRows.mockResolvedValue([{id:'future-case',code:'F-FUTURE',father_name:'أحمد',mother_name:'منى',case_file_categories:[]}]);
    render(<MemoryRouter><HomePage staff={donor}/></MemoryRouter>);
    expect(await screen.findByRole('link',{name:/F-FUTURE — الأب: أحمد/})).toBeVisible();
    expect(await screen.findByText('خلال ٢٥ يوم')).toBeVisible();
    expect(counts.generateInstallments).toHaveBeenCalledOnce();
    expect(counts.payments.mock.invocationCallOrder[0]).toBeGreaterThan(counts.generateInstallments.mock.invocationCallOrder[0]!);
  });

  it('does not query sponsorship followups when case-read permission is missing',()=>{
    const donor:StaffProfile={...staff,permissions:{casesRead:false,casesWrite:false,donationsRead:true,donationsWrite:false,assistantUse:false}};
    render(<MemoryRouter><HomePage staff={donor}/></MemoryRouter>);
    expect(counts.sponsorships).not.toHaveBeenCalled();expect(counts.payments).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading',{name:'متابعة الكفالات الشهرية'})).not.toBeInTheDocument();
  });
});
