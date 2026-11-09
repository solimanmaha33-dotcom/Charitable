import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseDetailsPage } from './CaseDetailsPage';
import { archiveCaseFile, findCaseFileForLegacyId, getCaseFile, listMembers, listCaseAttachments, listCaseFileHistory, saveCaseFile } from '../../services/cases';

const file = { id:'f1',code:'F-0001',phone:'0100',phone_2:'0101',phone_3:null,father_name:'أحمد',mother_name:'منى',contact_name:'منى',contact_relationship:'الأم',contact_age:40,national_id:null,national_id_expires_on:null,notes:'ملاحظة حالية',address:'شارع النيل',monthly_income:2000,health_condition:'مستقرة',branch_area:'فرع وسط البلد',file_status:'تحت المراجعة' as const,status_reason:null,case_file_categories:[{category:'أرملة' as const}] };
vi.mock('../../services/cases', () => ({
  findCaseFileForLegacyId: vi.fn(async (id: string) => id === 'old-case' ? 'f1' : null),
  getCaseFile: vi.fn(async (id: string) => id === 'f1' ? file : null),
  listMembers: vi.fn().mockResolvedValue([{ person_id:'p1',relationship:'ابنة',people:{name:'ريم',gender:'female',date_of_birth:'2010-01-01'} }]),
  listCaseAttachments: vi.fn().mockResolvedValue([{id:'a1',family_id:'f1',storage_path:'f1/doc',file_name:'ملف.pdf',mime_type:'application/pdf',size_bytes:10,uploaded_by:'u1',extracted_text:null,created_at:'2026-11-09'}]),
  listCaseFileHistory: vi.fn().mockResolvedValue([{id:'h1',family_id:'f1',legacy_case_id:'old',notes:'متابعة سابقة',created_at:'2025-01-01',source:'قديم'}]),
  listAllMembers: vi.fn().mockResolvedValue([]), saveCaseFile: vi.fn().mockResolvedValue('f1'), archiveCaseFile: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => vi.clearAllMocks());
function route(path='/cases/f1', canWrite=true) { return <MemoryRouter initialEntries={[path]}><Routes><Route path="/cases/:id" element={<CaseDetailsPage canWrite={canWrite} />} /></Routes></MemoryRouter>; }

it('shows one canonical case file with status, profile fields, members, attachments and history', async () => {
  render(route());
  expect(await screen.findByRole('heading', { name: /ملف الحالة/ })).toBeVisible();
  expect(screen.getAllByText('F-0001')[0]).toBeVisible(); expect(screen.getAllByText('تحت المراجعة')).toHaveLength(2);
  expect(screen.getAllByText('شارع النيل')).toHaveLength(2); expect(screen.getAllByText('فرع وسط البلد')).toHaveLength(2);
  expect(screen.getAllByText('ريم')).toHaveLength(2); expect(screen.getByText('متابعة سابقة')).toBeVisible();
  expect(screen.getByRole('button', { name: 'طباعة الحالة' })).toBeVisible();
  expect(document.querySelector('.case-print-document')).toHaveTextContent('مكان ختم الجمعية');
});

it('requires a reason when changing a file to held or rejected', async () => {
  render(route()); fireEvent.click(await screen.findByRole('button', { name: 'تعديل الملف' }));
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  expect(screen.getByLabelText('سبب الرفض')).toBeRequired();
  fireEvent.submit(screen.getByRole('button', { name: 'حفظ التعديلات' }).closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('اكتب سبب إيقاف أو رفض الملف.');
  expect(saveCaseFile).not.toHaveBeenCalled();
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
