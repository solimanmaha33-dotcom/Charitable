import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FamilyForm } from './FamilyForm';

const save = vi.hoisted(() => vi.fn());
vi.mock('../../services/cases', () => ({ saveFamily: save }));

beforeEach(() => { save.mockReset().mockResolvedValue('family-1'); });

it('saves primary contact, optional age and ID, three phones and a family note', async () => {
  const onSaved = vi.fn();
  render(<FamilyForm onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة تجريبية' } });
  fireEvent.change(screen.getByLabelText(/اسم المسؤول عن التربية/), { target: { value: 'أحمد' } });
  fireEvent.change(screen.getByLabelText(/صلة قرابة المسؤول/), { target: { value: 'ابن' } });
  fireEvent.change(screen.getByLabelText(/سن المسؤول عن التربية/), { target: { value: '42' } });
  fireEvent.change(screen.getByLabelText(/الرقم القومي للمسؤول/), { target: { value: '٢٩٠٠١٠١١٢٣٤٥٦٧' } });
  fireEvent.change(screen.getByLabelText(/تاريخ انتهاء البطاقة/), { target: { value: '2027-01-15' } });
  fireEvent.change(screen.getByLabelText(/رقم التليفون ١/), { target: { value: '01000000001' } });
  fireEvent.change(screen.getByLabelText(/رقم التليفون ٢/), { target: { value: '01000000002' } });
  fireEvent.change(screen.getByLabelText(/رقم التليفون ٣/), { target: { value: '01000000003' } });
  fireEvent.change(screen.getByLabelText(/ملاحظات الأسرة/), { target: { value: 'ملاحظة تجريبية' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ بيانات الأسرة' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(null, {
    name: 'أسرة تجريبية', fatherName: '', motherName: '', contactName: 'أحمد', contactRelationship: 'ابن', contactAge: 42, nationalId: '29001011234567',
    nationalIdExpiresOn: '2027-01-15', phones: ['01000000001', '01000000002', '01000000003'], notes: 'ملاحظة تجريبية',
  }));
  expect(onSaved).toHaveBeenCalledWith('family-1');
});

it('keeps age and national ID optional but blocks invalid entered values', async () => {
  render(<FamilyForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة تجريبية' } });
  fireEvent.change(screen.getByLabelText(/صلة قرابة المسؤول/), { target: { value: 'ابن' } });
  fireEvent.change(screen.getByLabelText(/سن المسؤول عن التربية/), { target: { value: '121' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ بيانات الأسرة' }));
  expect(await screen.findByText('السن لازم يكون من ٠ لحد ١٢٠ سنة.')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it('rejects a national ID unless it has 14 digits', async () => {
  render(<FamilyForm onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('اسم الأسرة'), { target: { value: 'أسرة تجريبية' } });
  fireEvent.change(screen.getByLabelText(/الرقم القومي للمسؤول/), { target: { value: '12345' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ بيانات الأسرة' }));
  expect(await screen.findByText('الرقم القومي لازم يكون ١٤ رقم.')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});
