import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyDetailsPage } from './FamilyListPage';

const service = vi.hoisted(() => ({ getFamily: vi.fn(), listMembers: vi.fn(), listCases: vi.fn(), addMember: vi.fn(), listFamilyFiles: vi.fn(), uploadFamilyFile: vi.fn(), downloadFamilyFile: vi.fn(), removeFamilyFile: vi.fn() }));
vi.mock('../../services/cases', () => service);

beforeEach(() => {
  service.getFamily.mockResolvedValue({ id: 'family-1', code: 'F-1001', name: 'أسرة أم أحمد', contact_name: 'أم أحمد', contact_age: 44, national_id: '29001011234567', phone: '01000000001', phone_2: '01000000002', phone_3: null, notes: 'تحتاج متابعة' });
  service.listMembers.mockResolvedValue([]);
  service.listCases.mockResolvedValue([]);
  service.listFamilyFiles.mockResolvedValue([{ id: 'file-1', family_id: 'family-1', storage_path: 'family-1/path', file_name: 'بطاقة.png', mime_type: 'image/png', size_bytes: 5, uploaded_by: 'staff-1', created_at: '2026-11-07T12:00:00Z' }]);
  service.removeFamilyFile.mockResolvedValue(undefined);
});

describe('family record', () => {
  it('shows clear empty states without exposing editing to read-only staff', async () => {
    service.getFamily.mockResolvedValueOnce({ id: 'family-1', code: 'F-1001', name: 'أسرة أم أحمد', contact_name: null, contact_age: null, national_id: null, phone: null, phone_2: null, phone_3: null, notes: '' });
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'أسرة أم أحمد' })).toBeVisible();
    expect(screen.getByText('لسه مفيش أفراد مضافين للأسرة.')).toBeVisible();
    expect(screen.getByText('لسه مفيش حالات مسجلة للأسرة.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'تعديل بيانات الأسرة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'إضافة حالة' })).not.toBeInTheDocument();
  });

  it('shows the main contact profile and private family attachments to read-only staff', async () => {
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('مسؤول الأسرة: أم أحمد')).toBeVisible();
    expect(screen.getByText('السن: ٤٤ سنة')).toBeVisible();
    expect(screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === 'الرقم القومي: 29001011234567')).toBeVisible();
    expect(screen.getByText('ملاحظات الأسرة')).toBeVisible();
    expect(screen.getByText('تحتاج متابعة')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'مرفقات الأسرة' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'بطاقة.png' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'رفع المرفقات' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف بطاقة.png' })).not.toBeInTheDocument();
  });

  it('offers family file uploads to staff who can write', async () => {
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite />} /></Routes></MemoryRouter>);
    expect(await screen.findByLabelText('إضافة صور أو PDF للأسرة')).toBeVisible();
    expect(await screen.findByRole('button', { name: 'حذف بطاقة.png' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'حذف بطاقة.png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الحذف' }));
    await waitFor(() => expect(service.removeFamilyFile).toHaveBeenCalledWith('file-1'));
  });
});
