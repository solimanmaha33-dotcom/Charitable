import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyDetailsPage } from './FamilyListPage';

const service = vi.hoisted(() => ({ getFamily: vi.fn(), listMembers: vi.fn(), listCases: vi.fn(), addMember: vi.fn(), updateMemberDemographics:vi.fn(), listFamilyFiles: vi.fn(), uploadFamilyFile: vi.fn(), downloadFamilyFile: vi.fn(), removeFamilyFile: vi.fn(),saveFamily:vi.fn() }));
vi.mock('../../services/cases', () => service);

beforeEach(() => {
  service.getFamily.mockResolvedValue({ id: 'family-1', code: 'F-1001', name: 'أسرة أم أحمد', father_name: 'أحمد', mother_name: 'منى', contact_name: 'أم أحمد', contact_relationship: 'الأم', contact_age: 44, national_id: '29001011234567', national_id_expires_on: '2027-01-01', phone: '01000000001', phone_2: '01000000002', phone_3: null, notes: 'تحتاج متابعة' });
  service.listMembers.mockResolvedValue([]);
  service.listCases.mockResolvedValue([]);
  service.listFamilyFiles.mockResolvedValue([{ id: 'file-1', family_id: 'family-1', storage_path: 'family-1/path', file_name: 'بطاقة.png', mime_type: 'image/png', size_bytes: 5, uploaded_by: 'staff-1', created_at: '2026-11-07T12:00:00Z' }]);
  service.removeFamilyFile.mockResolvedValue(undefined);
  service.saveFamily.mockResolvedValue('family-1');
  service.addMember.mockResolvedValue(undefined);
  service.updateMemberDemographics.mockResolvedValue(undefined);
});

describe('family record', () => {
  it('shows clear empty states without exposing editing to read-only staff', async () => {
    service.getFamily.mockResolvedValueOnce({ id: 'family-1', code: 'F-1001', name: 'أسرة أم أحمد', father_name: null, mother_name: null, contact_name: null, contact_relationship: null, contact_age: null, national_id: null, national_id_expires_on: null, phone: null, phone_2: null, phone_3: null, notes: '' });
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'أسرة أم أحمد' })).toBeVisible();
    expect(screen.getByText('لسه مفيش أفراد مضافين للأسرة.')).toBeVisible();
    expect(screen.getByText('لسه مفيش حالات مسجلة للأسرة.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'تعديل بيانات الأسرة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'إضافة حالة' })).not.toBeInTheDocument();
  });

  it('shows the main contact profile and private family attachments to read-only staff', async () => {
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false} />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('الأب: أحمد')).toBeVisible();
    expect(screen.getByText('الأم: منى')).toBeVisible();
    expect(screen.getByText('المسؤول عن التربية: أم أحمد · صلة القرابة: الأم')).toBeVisible();
    expect(screen.getByText('سن المسؤول: ٤٤ سنة')).toBeVisible();
    expect(screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === 'الرقم القومي للمسؤول: 29001011234567')).toBeVisible();
    expect(screen.getByText((_text,element)=>element?.tagName==='P'&&element.textContent?.startsWith('انتهاء البطاقة:')===true)).toBeVisible();
    expect(screen.getByText('ملاحظات الأسرة')).toBeVisible();
    expect(screen.getByText('تحتاج متابعة')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'مرفقات الأسرة' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'بطاقة.png' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'رفع المرفقات' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف بطاقة.png' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading',{name:'قراءة بيانات البطاقة'})).not.toBeInTheDocument();
  });

  it('offers family file uploads to staff who can write', async () => {
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite />} /></Routes></MemoryRouter>);
    expect(await screen.findByLabelText('إضافة صور أو PDF للأسرة')).toBeVisible();
    expect(screen.getByRole('heading',{name:'قراءة بيانات البطاقة'})).toBeVisible();
    expect(screen.getByLabelText('تاريخ انتهاء البطاقة')).toHaveValue('2027-01-01');
    expect(await screen.findByRole('button', { name: 'حذف بطاقة.png' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'حذف بطاقة.png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد الحذف' }));
    await waitFor(() => expect(service.removeFamilyFile).toHaveBeenCalledWith('file-1'));
  });

  it('shows age from a family member birth date',async()=>{
    service.listMembers.mockResolvedValue([{person_id:'member-1',relationship:'بنت',people:{name:'ريم',gender:'female',date_of_birth:'2000-01-01'}}]);
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite={false}/>} /></Routes></MemoryRouter>);
    expect(await screen.findByText('ريم')).toBeVisible();
    expect(screen.getByText(/العمر:/)).toBeVisible();
  });

  it('lets staff add missing birth date and gender to an existing member',async()=>{
    service.listMembers.mockResolvedValue([{person_id:'member-1',relationship:'بنت',people:{name:'ريم',gender:null,date_of_birth:null}}]);
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite/>} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:'تعديل بيانات السن ريم'}));
    await waitFor(()=>expect(service.listFamilyFiles).toHaveBeenCalled());
    service.listFamilyFiles.mockClear();
    fireEvent.change(screen.getAllByLabelText('تاريخ الميلاد')[0],{target:{value:'2008-12-31'}});
    fireEvent.change(screen.getAllByLabelText('النوع')[0],{target:{value:'female'}});
    fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات السن'}));
    await waitFor(()=>expect(service.updateMemberDemographics).toHaveBeenCalledWith('member-1','female','2008-12-31'));
    await waitFor(()=>expect(service.listFamilyFiles).toHaveBeenCalledOnce());
  });

  it('keeps member editor open and shows an attachment upload failure',async()=>{
    service.listMembers.mockResolvedValue([{person_id:'member-1',relationship:'بنت',people:{name:'ريم',gender:'female',date_of_birth:'2008-12-31'}}]);
    service.uploadFamilyFile.mockRejectedValue(new Error('upload failed'));
    render(<MemoryRouter initialEntries={['/families/family-1']}><Routes><Route path="/families/:id" element={<FamilyDetailsPage canWrite/>} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:'تعديل بيانات السن ريم'}));
    const file=new File(['image'],'بطاقة ريم.png',{type:'image/png'});
    const memberForm=screen.getByRole('heading',{name:'تعديل بيانات السن'}).closest('form')!;
    fireEvent.change(within(memberForm).getByLabelText('صورة البطاقة أو PDF'),{target:{files:[file]}});
    await waitFor(()=>expect(within(memberForm).getByText('بطاقة ريم.png')).toBeVisible());
    fireEvent.click(screen.getByRole('button',{name:'حفظ بيانات السن'}));
    await waitFor(()=>expect(service.uploadFamilyFile).toHaveBeenCalledWith('family-1',file));
    expect(await screen.findByText(/اتحفظت بيانات السن، لكن تعذّر رفع البطاقة/)).toBeVisible();
    expect(within(memberForm).getByLabelText('تاريخ الميلاد')).toBeVisible();
  });
});
