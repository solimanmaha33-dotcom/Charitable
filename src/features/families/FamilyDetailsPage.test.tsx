import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyDetailsPage } from './FamilyListPage';

const service = vi.hoisted(() => ({ getFamily: vi.fn(), listMembers: vi.fn(), listCases: vi.fn(), addMember: vi.fn() }));
vi.mock('../../services/cases', () => service);

beforeEach(() => {
  service.getFamily.mockResolvedValue({ id: 'family-1', code: 'F-1001', name: 'أسرة أم أحمد', phone: null });
  service.listMembers.mockResolvedValue([]);
  service.listCases.mockResolvedValue([]);
});

describe('family record', () => {
  it('shows clear empty states without exposing editing to read-only staff', async () => {
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'أسرة أم أحمد' })).toBeVisible();
    expect(screen.getByText('رقم التليفون مش متسجل')).toBeVisible();
    expect(screen.getByText('لسه مفيش أفراد مضافين للأسرة.')).toBeVisible();
    expect(screen.getByText('لسه مفيش حالات مسجلة للأسرة.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'تعديل بيانات الأسرة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'إضافة حالة' })).not.toBeInTheDocument();
  });
});
