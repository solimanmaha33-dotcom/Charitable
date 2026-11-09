import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyListPage } from './FamilyListPage';

const service = vi.hoisted(() => ({
  listFamilies: vi.fn(), listCases: vi.fn(), listAllMembers: vi.fn(),
  getFamily: vi.fn(), listMembers: vi.fn(), addMember: vi.fn(),
}));
vi.mock('../../services/cases', () => service);

beforeEach(() => {
  service.listFamilies.mockResolvedValue([
    { id: 'f1', code: 'F-1001', name: 'أسرة أم أحمد', phone: '0100 111 2222' },
    { id: 'f2', code: 'F-1002', name: 'أسرة محمود', phone: '0100 333 4444', phone_2: null, phone_3: '0100 555 6666' },
  ]);
  service.listCases.mockResolvedValue([
    { id: 'c1', family_id: 'f1', notes: '', case_categories: [{ category: 'أرملة' }] },
    { id: 'c2', family_id: 'f2', notes: '', case_categories: [{ category: 'يتيم الأب' }, { category: 'كبار السن (٦٠ سنة فأكثر)' }] },
  ]);
  service.listAllMembers.mockResolvedValue([
    { family_id: 'f1', person_id: 'p1', relationship: 'ابن', people: { name: 'كريم', gender: 'male', date_of_birth: '2010-01-01' } },
    { family_id: 'f2', person_id: 'p2', relationship: 'بنت', people: { name: 'مريم', gender: 'female', date_of_birth: '2012-01-01' } },
    { family_id: 'f2', person_id: 'p3', relationship: 'أب', people: { name: 'محمود', gender: 'male', date_of_birth: '1960-01-01' } },
  ]);
});

describe('family directory', () => {
  it('shows the family and case work together under the cases section with simple steps', async () => {
    render(<MemoryRouter initialEntries={['/cases']}><FamilyListPage canWrite /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'الحالات' })).toBeVisible();
    expect(screen.getByText('خطوات الشغل')).toBeVisible();
    expect(screen.getAllByRole('link', { name: /فتح الملف/ })[0]).toHaveAttribute('href', '/cases/family/f1');
    expect(screen.getByRole('link', { name: 'إضافة حالة جديدة' })).toHaveAttribute('href', '/cases/new');
    expect(screen.queryByRole('button', { name: 'إضافة ملف أسرة' })).not.toBeInTheDocument();
  });

    it('searches by family member name and shows matching family record', async () => {
    render(<MemoryRouter><FamilyListPage canWrite={false} /></MemoryRouter>);
    const search = await screen.findByRole('searchbox', { name: 'بحث عن حالة' });
    fireEvent.change(search, { target: { value: 'كريم' } });
    expect(await screen.findByRole('link', { name: 'أسرة أم أحمد' })).toHaveAttribute('href', '/cases/family/f1');
    expect(screen.queryByText('أسرة محمود')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إضافة أسرة' })).not.toBeInTheDocument();
  });

  it('filters by a current case category', async () => {
    render(<MemoryRouter><FamilyListPage canWrite /></MemoryRouter>);
    const filter = await screen.findByRole('combobox', { name: 'نوع الحالة' });
    fireEvent.change(filter, { target: { value: 'يتيم الأب' } });
    expect(await screen.findByText('أسرة محمود')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('أسرة أم أحمد')).not.toBeInTheDocument());
    const table = screen.getByRole('table', { name: 'قائمة الحالات' });
    expect(within(table).getByText('يتيم الأب')).toBeVisible();
  });

  it('shows one count for each family case, all children, and orphan children', async () => {
    render(<MemoryRouter><FamilyListPage canWrite /></MemoryRouter>);
    expect(await screen.findByTestId('case-directory-cases')).toHaveTextContent('٢');
    expect(screen.getByTestId('case-directory-children')).toHaveTextContent('٢');
    expect(screen.getByTestId('case-directory-orphans')).toHaveTextContent('١');
  });

  it('filters cases by age and orphan status while preserving one row per family', async () => {
    render(<MemoryRouter><FamilyListPage canWrite /></MemoryRouter>);
    const filter = await screen.findByRole('combobox', { name: 'فلترة حسب سن أفراد الحالة' });
    fireEvent.change(filter, { target: { value: 'orphans' } });
    expect(await screen.findByRole('link', { name: 'أسرة محمود' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'أسرة أم أحمد' })).not.toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'elderly' } });
    expect(await screen.findByRole('link', { name: 'أسرة محمود' })).toBeVisible();
    fireEvent.change(filter, { target: { value: 'under18' } });
    expect(await screen.findByRole('link', { name: 'أسرة أم أحمد' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'أسرة محمود' })).toBeVisible();
  });

  it('combines text search, age filter, and case category filters', async () => {
    render(<MemoryRouter><FamilyListPage canWrite /></MemoryRouter>);
    fireEvent.change(await screen.findByRole('combobox', { name: 'فلترة حسب سن أفراد الحالة' }), { target: { value: 'under18' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'نوع الحالة' }), { target: { value: 'أرملة' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'بحث عن حالة' }), { target: { value: 'كريم' } });
    expect(await screen.findByRole('link', { name: 'أسرة أم أحمد' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'أسرة محمود' })).not.toBeInTheDocument();
  });

  it('finds families by their unique code and phone number', async () => {
    render(<MemoryRouter><FamilyListPage canWrite={false} /></MemoryRouter>);
    const search = await screen.findByRole('searchbox', { name: 'بحث عن حالة' });
    fireEvent.change(search, { target: { value: 'F-1002' } });
    expect(await screen.findByRole('link', { name: 'أسرة محمود' })).toHaveAttribute('href', '/cases/family/f2');
    fireEvent.change(search, { target: { value: '0100 111' } });
    expect(await screen.findByRole('link', { name: 'أسرة أم أحمد' })).toHaveAttribute('href', '/cases/family/f1');
    expect(screen.queryByText('أسرة محمود')).not.toBeInTheDocument();
  });

  it('finds a family by its third phone number', async () => {
    render(<MemoryRouter><FamilyListPage canWrite={false} /></MemoryRouter>);
    const search = await screen.findByRole('searchbox', { name: 'بحث عن حالة' });
    fireEvent.change(search, { target: { value: '0100 555' } });
    expect(await screen.findByRole('link', { name: 'أسرة محمود' })).toHaveAttribute('href', '/cases/family/f2');
    expect(screen.queryByText('أسرة أم أحمد')).not.toBeInTheDocument();
  });
});
