import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseListPage } from './CaseListPage';

const service = vi.hoisted(() => ({ listCaseFiles: vi.fn(), listAllMembers: vi.fn() }));
vi.mock('../../services/cases', () => service);
beforeEach(() => {
  service.listCaseFiles.mockResolvedValue([
    { id:'f1',code:'F-1001',phone:'0100 111 2222',phone_2:null,phone_3:null,father_name:'أحمد',mother_name:'منى',contact_name:null,address:'شارع النيل',branch_area:'فرع الجيزة',file_status:'نشط',status_reason:null,case_file_categories:[{category:'أرملة'}] },
    { id:'f2',code:'F-1002',phone:'0100 333 4444',phone_2:null,phone_3:'0100 555 6666',father_name:'محمود',mother_name:'سعاد',contact_name:null,address:'شارع آخر',branch_area:'فرع القاهرة',file_status:'موقوف',status_reason:'مراجعة',case_file_categories:[{category:'يتيم الأب'},{category:'كبار السن (٦٠ سنة فأكثر)'}] },
  ]);
  service.listAllMembers.mockResolvedValue([
    {family_id:'f1',person_id:'p1',relationship:'ابن',people:{name:'كريم',gender:'male',date_of_birth:'2010-01-01'}},
    {family_id:'f2',person_id:'p2',relationship:'بنت',people:{name:'مريم',gender:'female',date_of_birth:'2012-01-01'}},
    {family_id:'f2',person_id:'p3',relationship:'أب',people:{name:'محمود',gender:'male',date_of_birth:'1960-01-01'}},
  ]);
});

describe('one-file case directory', () => {
  it('shows one row per code and gives staff simple steps', async () => {
    render(<MemoryRouter><CaseListPage canWrite /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name:'الحالات' })).toBeVisible();
    expect(screen.getByText('خطوات الشغل')).toBeVisible();
    expect(screen.getAllByRole('link', { name:'فتح الملف' })[0]).toHaveAttribute('href','/cases/f1');
    expect(screen.getByRole('link', { name:'إضافة حالة جديدة' })).toHaveAttribute('href','/cases/new');
    expect(screen.queryByText('اسم الأسرة')).not.toBeInTheDocument();
  });
  it('searches by parent, member, code, phone, address and area', async () => {
    render(<MemoryRouter><CaseListPage canWrite={false} /></MemoryRouter>);
    const search = await screen.findByRole('searchbox', { name:'بحث عن حالة' });
    for (const term of ['أحمد','كريم','F-1001','0100 111','شارع النيل','فرع الجيزة']) {
      fireEvent.change(search,{target:{value:term}}); expect(screen.getByRole('link',{name:/F-1001/})).toBeVisible();
      expect(screen.queryByRole('link',{name:/F-1002/})).not.toBeInTheDocument();
    }
  });
  it('filters by profile category and file status', async () => {
    render(<MemoryRouter><CaseListPage canWrite /></MemoryRouter>);
    fireEvent.change(await screen.findByRole('combobox',{name:'نوع الحالة'}),{target:{value:'يتيم الأب'}});
    expect(screen.getByRole('link',{name:/F-1002/})).toBeVisible();
    fireEvent.change(screen.getByRole('combobox',{name:'حالة الملف'}),{target:{value:'نشط'}});
    await waitFor(()=>expect(screen.getByText('ملقيناش حالات مطابقة')).toBeVisible());
  });
  it('shows all profile counts and filters by orphan and age boundaries', async () => {
    render(<MemoryRouter><CaseListPage canWrite /></MemoryRouter>);
    expect(await screen.findByTestId('case-directory-cases')).toHaveTextContent('٢');
    expect(screen.getByTestId('case-directory-children')).toHaveTextContent('٢');
    expect(screen.getByTestId('case-directory-orphans')).toHaveTextContent('١');
    const filter=screen.getByRole('combobox',{name:'فلترة حسب سن أفراد الحالة'});
    fireEvent.change(filter,{target:{value:'orphans'}});expect(screen.getByRole('link',{name:/F-1002/})).toBeVisible();expect(screen.queryByRole('link',{name:/F-1001/})).not.toBeInTheDocument();
    fireEvent.change(filter,{target:{value:'elderly'}});expect(screen.getByRole('link',{name:/F-1002/})).toBeVisible();
    fireEvent.change(filter,{target:{value:'under18'}});expect(screen.getByRole('link',{name:/F-1001/})).toBeVisible();expect(screen.getByRole('link',{name:/F-1002/})).toBeVisible();
  });
  it('combines category and age filters', async () => {
    render(<MemoryRouter><CaseListPage canWrite /></MemoryRouter>);
    fireEvent.change(await screen.findByRole('combobox',{name:'فلترة حسب سن أفراد الحالة'}),{target:{value:'under18'}});
    fireEvent.change(screen.getByRole('combobox',{name:'نوع الحالة'}),{target:{value:'أرملة'}});
    expect(screen.getByRole('link',{name:/F-1001/})).toBeVisible();expect(screen.queryByRole('link',{name:/F-1002/})).not.toBeInTheDocument();
  });
  it('lists current profile status and its reason', async () => {
    render(<MemoryRouter><CaseListPage canWrite={false} /></MemoryRouter>);
    const table=await screen.findByRole('table',{name:'قائمة الحالات'});
    expect(within(table).getByText('موقوف')).toBeVisible();expect(within(table).getByText('مراجعة')).toBeVisible();
  });
});
