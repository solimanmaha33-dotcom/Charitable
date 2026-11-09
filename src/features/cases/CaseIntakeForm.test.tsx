import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseIntakeForm } from './CaseIntakeForm';
import { saveCaseFile } from '../../services/cases';

vi.mock('../../services/cases', () => ({ saveCaseFile: vi.fn().mockResolvedValue('file-1'), uploadCaseAttachment: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });

it('creates one file without a family-name field and saves status, reason and profile in one call', async () => {
  const onSaved = vi.fn(); render(<CaseIntakeForm onSaved={onSaved} />);
  expect(screen.queryByLabelText(/اسم الأسرة/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'موقوف' } });
  fireEvent.change(screen.getByLabelText('سبب الإيقاف'), { target: { value: 'مراجعة الأوراق' } });
  fireEvent.change(screen.getByLabelText('العنوان'), { target: { value: 'شارع النيل' } });
  fireEvent.change(screen.getByLabelText('الدخل الشهري بالجنيه'), { target: { value: '2500' } });
  fireEvent.change(screen.getByLabelText('الحالة الصحية'), { target: { value: 'تحتاج متابعة' } });
  fireEvent.change(screen.getByLabelText('رقم التليفون ٢ (اختياري)'), { target: { value: '01000000002' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('file-1'));
  expect(saveCaseFile).toHaveBeenCalledWith(null, expect.objectContaining({ motherName: 'منى', fatherName: '', address: 'شارع النيل', monthlyIncome: 2500, healthCondition: 'تحتاج متابعة', phones: ['', '01000000002', ''], fileStatus: 'موقوف', statusReason: 'مراجعة الأوراق', categories: ['أرملة'] }));
});

it('requires a category and makes a reason mandatory for hold or rejection', async () => {
  render(<CaseIntakeForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأم (مطلوب)'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'نشط' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('اختار نوع حالة واحد على الأقل.');
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  expect(screen.getByLabelText('سبب الرفض')).toBeRequired();
  fireEvent.change(screen.getByLabelText('سبب الرفض'), { target: { value: 'بيانات ناقصة' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الحالة' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith(null, expect.objectContaining({ fileStatus:'مرفوض',statusReason:'بيانات ناقصة' })));
});

it('edits the current file instead of creating a second one', async () => {
  const initial = { id:'f1',code:'F-0001',phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:null,contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'تحت المراجعة' as const,status_reason:null,case_file_categories:[{category:'يتيم الأم' as const}] };
  const onSaved = vi.fn(); render(<CaseIntakeForm initial={initial} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('حالة الملف'), { target: { value: 'مرفوض' } });
  fireEvent.change(screen.getByLabelText('سبب الرفض'), { target: { value: 'مستند ناقص' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith('f1', expect.objectContaining({ fileStatus:'مرفوض',statusReason:'مستند ناقص',categories:['يتيم الأم'] })));
  expect(onSaved).toHaveBeenCalledWith('file-1');
});

it('keeps removed historical categories visible but never resubmits them as new choices', async () => {
  const initial = { id:'f1',code:'F-0001',phone:null,phone_2:null,phone_3:null,father_name:null,mother_name:'منى',contact_name:null,contact_relationship:null,contact_age:null,national_id:null,national_id_expires_on:null,notes:'',address:null,monthly_income:null,health_condition:null,branch_area:null,file_status:'نشط' as const,status_reason:null,case_file_categories:[{category:'وفاة' as const},{category:'أرملة' as const}] };
  render(<CaseIntakeForm initial={initial} onSaved={vi.fn()} />);
  expect(screen.getByText('تصنيف قديم محفوظ: وفاة')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
  await waitFor(() => expect(saveCaseFile).toHaveBeenCalledWith('f1', expect.objectContaining({ categories:['أرملة'] })));
});
