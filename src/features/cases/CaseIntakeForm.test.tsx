import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CaseIntakeForm } from './CaseIntakeForm';
import { saveCase, saveFamily } from '../../services/cases';

vi.mock('../../services/cases', () => ({
  saveFamily: vi.fn().mockResolvedValue('family-1'),
  saveCase: vi.fn().mockResolvedValue('case-1'),
  uploadCaseFile: vi.fn(),
}));

beforeEach(() => { vi.clearAllMocks(); });

it('creates one family and case together, with an optional father and required mother and guardian relation', async () => {
  const onSaved = vi.fn();
  render(<CaseIntakeForm onSaved={onSaved} />);

  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة أحمد' } });
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('اسم الأم'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('اسم المسؤول عن التربية'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('صلة قرابة المسؤول'), { target: { value: 'الأم' } });
  fireEvent.change(screen.getAllByLabelText(/رقم التليفون/)[0], { target: { value: '01000000001' } });
  fireEvent.change(screen.getByLabelText('ملاحظات الحالة'), { target: { value: 'تحتاج متابعة' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الأسرة والحالة' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('case-1'));
  expect(saveFamily).toHaveBeenCalledWith(null, expect.objectContaining({
    name: 'أسرة أحمد', fatherName: '', motherName: 'منى', contactName: 'منى', contactRelationship: 'الأم',
  }));
  expect(saveCase).toHaveBeenCalledWith(null, 'family-1', 'تحتاج متابعة', ['أرملة']);
});

it('requires a case category before saving the family and case', async () => {
  render(<CaseIntakeForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة أحمد' } });
  fireEvent.change(screen.getByLabelText('اسم الأم'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('اسم المسؤول عن التربية'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('صلة قرابة المسؤول'), { target: { value: 'الأم' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الأسرة والحالة' }));
  expect(await screen.findByText('اختار نوع حالة واحد على الأقل.')).toBeVisible();
  expect(saveFamily).not.toHaveBeenCalled();
  expect(saveCase).not.toHaveBeenCalled();
});

it('updates the saved family profile when retrying after the case save fails', async () => {
  vi.mocked(saveCase).mockRejectedValueOnce(new Error('offline'));
  render(<CaseIntakeForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة أحمد' } });
  fireEvent.click(screen.getByLabelText('أرملة'));
  fireEvent.change(screen.getByLabelText('اسم الأم'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('اسم المسؤول عن التربية'), { target: { value: 'منى' } });
  fireEvent.change(screen.getByLabelText('صلة قرابة المسؤول'), { target: { value: 'الأم' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الأسرة والحالة' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('اضغط حفظ تاني');

  fireEvent.change(screen.getByLabelText(/اسم الأب/), { target: { value: 'أحمد' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ ملف الأسرة والحالة' }));
  await waitFor(() => expect(saveFamily).toHaveBeenCalledTimes(2));
  expect(saveFamily).toHaveBeenNthCalledWith(1, null, expect.objectContaining({ fatherName: '' }));
  expect(saveFamily).toHaveBeenNthCalledWith(2, 'family-1', expect.objectContaining({ fatherName: 'أحمد' }));
});
