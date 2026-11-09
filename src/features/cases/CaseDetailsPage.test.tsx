import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseDetailsPage } from './CaseDetailsPage';
import { archiveCaseFile, findCaseFileForLegacyId, getCaseFile, listMembers, listCaseAttachments, listCaseFileHistory, saveCaseFile } from '../../services/cases';

const file = { id:'f1',code:'F-0001',phone:'01012345678',phone_2:'01098765432',phone_3:null,father_name:'أحمد',father_national_id:'28001011234567',father_health_condition:'مستقر',father_employment_status:'لا يعمل',mother_name:'منى',mother_national_id:'29001011234567',mother_health_condition:'ضغط',mother_employment_status:'يعمل',mother_occupation:'خياطة',contact_name:'منى',contact_relationship:'الأم',contact_age:40,national_id:null,national_id_expires_on:null,notes:'ملاحظة حالية',address:'شارع النيل',monthly_income:2000,health_condition:'متابعة أسرية',branch_area:'فرع وسط البلد',file_status:'تحت المراجعة' as const,status_reason:null,case_file_categories:[{category:'أرملة' as const}] };
vi.mock('../../services/cases', () => ({
  findCaseFileForLegacyId: vi.fn(async (id: string) => id === 'old-case' ? 'f1' : null),
  getCaseFile: vi.fn(async (id: string) => id === 'f1' ? file : null),
  listMembers: vi.fn().mockResolvedValue([{ person_id:'p1',relationship:'ابنة',people:{name:'ريم',gender:'female',date_of_birth:'2010-01-01',health_condition:'حساسية صدر',health_status:'مرض',health_details:'حساسية صدر',employment_status:'يعمل',occupation:'تمريض'} }]),
  listCaseAttachments: vi.fn().mockResolvedValue([{id:'a1',family_id:'f1',storage_path:'f1/doc',file_name:'ملف.pdf',mime_type:'application/pdf',size_bytes:10,uploaded_by:'u1',extracted_text:null,created_at:'2026-11-09'}]),
  listCaseFileHistory: vi.fn().mockResolvedValue([{id:'h1',family_id:'f1',legacy_case_id:'old',notes:'متابعة سابقة',created_at:'2025-01-01',source:'قديم'}]),
  listAllMembers: vi.fn().mockResolvedValue([]), saveCaseFile: vi.fn().mockResolvedValue('f1'), archiveCaseFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/disbursements',()=>({DISBURSEMENT_TYPES:['كفالة شهرية','مساعدة موسمية','علاج','عيني','طوارئ'],listCaseDisbursements:vi.fn().mockResolvedValue([])}));
const branchServiceState = vi.hoisted(() => ({ reactivateBranch: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/branches',()=>({listBranches:vi.fn().mockResolvedValue([{id:'branch-1',name:'فرع وسط البلد'}]),listInactiveBranches:vi.fn().mockResolvedValue([{id:'branch-old',name:'فرع محفوظ'}]),reactivateBranch:branchServiceState.reactivateBranch}));
beforeEach(() => vi.clearAllMocks());
function route(path='/cases/f1', canWrite=true) { return <MemoryRouter initialEntries={[path]}><Routes><Route path="/cases/:id" element={<CaseDetailsPage canWrite={canWrite} />} /></Routes></MemoryRouter>; }

it('shows one canonical case file with status, profile fields, members, attachments and history', async () => {
  render(route());
  expect(await screen.findByRole('heading', { name: /ملف الحالة/ })).toBeVisible();
  expect(screen.getAllByText('F-0001')[0]).toBeVisible(); expect(screen.getAllByText('تحت المراجعة')).toHaveLength(2);
  expect(screen.getAllByText('شارع النيل')).toHaveLength(2); expect(screen.getAllByText('فرع وسط البلد')).toHaveLength(2);
  expect(screen.getAllByText('ريم')).toHaveLength(2); expect(screen.getByText('متابعة سابقة')).toBeVisible();
  expect(screen.getByText(/الحالة الصحية: مرض — حساسية صدر/)).toBeVisible();
  expect(screen.getByText('28001011234567')).toBeVisible();expect(screen.getByText('29001011234567')).toBeVisible();
  expect(screen.getAllByText('يعمل — خياطة')[0]).toBeVisible();expect(screen.getByText(/حالة العمل: يعمل — تمريض/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'طباعة الحالة' })).toBeVisible();
  expect(await screen.findByRole('heading',{name:'سجل المساعدات المنصرفة'})).toBeVisible();
  expect(document.querySelector('.case-print-document')).toHaveTextContent('مكان ختم الجمعية');
});

it('highlights the member matched from case search and scrolls their row into view',async()=>{
 render(route('/cases/f1?matchedMember=p1#member-p1',false));
 const match=await screen.findByText('مطابقة البحث');
 expect(match.closest('li')).toHaveAttribute('id','member-p1');
 expect(match.closest('li')).toHaveClass('matched-member');
});

it('highlights the parent matched by a case search',async()=>{
 render(route('/cases/f1?matchedContact=mother#contact-mother',false));
 const match=await screen.findByText('مطابقة البحث');
 expect(match.closest('div')).toHaveAttribute('id','contact-mother');
 expect(match.closest('div')).toHaveClass('matched-member');
});

it('requires a reason when changing a file to held or rejected', async () => {
  render(route()); fireEvent.click(await screen.findByRole('button', { name: 'تعديل الملف' }));
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  expect(screen.getByLabelText('سبب الرفض')).toBeRequired();
  fireEvent.submit(screen.getByRole('button', { name: 'حفظ التعديلات' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('اكتب سبب إيقاف أو رفض الملف.');
  expect(saveCaseFile).not.toHaveBeenCalled();
});

it('does not change an existing case file branch when a branch is reactivated', async () => {
  render(route());
  fireEvent.click(await screen.findByRole('button', { name: 'تعديل الملف' }));
  fireEvent.change(await screen.findByLabelText('الفرع أو المنطقة'), { target: { value: '__manage_branches__' } });
  fireEvent.click(await screen.findByRole('button', { name: 'إعادة تشغيل فرع فرع محفوظ' }));
  await waitFor(() => expect(branchServiceState.reactivateBranch).toHaveBeenCalledWith('branch-old'));
  expect(screen.getByLabelText('الفرع أو المنطقة')).toHaveValue('فرع وسط البلد');
});

it('redirects an old case ID to its current single file', async () => {
  render(route('/cases/old-case', false));
  expect(await screen.findByRole('heading', { name: /F-0001/ })).toBeVisible();
  await waitFor(() => expect(findCaseFileForLegacyId).toHaveBeenCalledWith('old-case'));
});

it('creates a file from the new-case page without a family-name field', async () => {
  render(route('/cases/new'));
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('رقم الموبايل 1'), { target: { value: '01012345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith(null, expect.objectContaining({ motherName:'منى',categories:['أرملة'] })));
});

it('requires a clear archive confirmation and returns to active cases after archiving', async () => {
  render(<MemoryRouter initialEntries={['/cases/f1']}><Routes><Route path="/cases/:id" element={<CaseDetailsPage canWrite canArchive />} /><Route path="/cases" element={<p>قائمة الحالات النشطة</p>} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name:'حذف الحالة' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('F-0001');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('يقدر يسترجعها');
  fireEvent.click(screen.getByRole('button', { name:'تأكيد الأرشفة' }));
  expect(await screen.findByText('قائمة الحالات النشطة')).toBeVisible();
  expect(archiveCaseFile).toHaveBeenCalledWith('f1');
});
