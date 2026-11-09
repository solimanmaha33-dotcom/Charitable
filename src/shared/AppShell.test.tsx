import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StaffProfile } from '../features/auth/permissions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { Router } from '../app/Router';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => vi.unstubAllGlobals());

describe('Arabic application shell', () => {
  it('keeps one cases entry and places sign-out beside the theme control', () => {
    const onSignOut = vi.fn();
    const manager: StaffProfile={id:'gm',employeeCode:'GM-1',displayName:'مدير',role:'general_manager',active:true,permissions:{casesRead:true,casesWrite:true,donationsRead:false,donationsWrite:false,assistantUse:false}};
    render(<MemoryRouter><AppShell staff={manager} onSignOut={onSignOut}><p>محتوى الصفحة</p></AppShell></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'القائمة الرئيسية' });
    expect(within(nav).getByRole('link', { name: 'الحالات' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'الأسر' })).not.toBeInTheDocument();
    const tools = screen.getByRole('button', { name: 'تسجيل الخروج' }).parentElement;
    expect(within(tools!).getByRole('button', { name: /الوضع الليلي|الوضع النهاري/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الخروج' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('gives its content Arabic language, RTL direction, and a named navigation', () => {
    render(<MemoryRouter><AppShell><p>محتوى الصفحة</p></AppShell></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(main.closest('[lang="ar"][dir="rtl"]')).not.toBeNull();
    expect(screen.getByText('مرام الخير')).toBeVisible();
    expect(within(main).getByText('محتوى الصفحة')).toBeVisible();
    expect(screen.getByRole('img', { name: 'شعار جمعية مرام الخير' })).toHaveAttribute('src', '/brand/maram-logo.png');
    const navigation = screen.getByRole('navigation', { name: 'القائمة الرئيسية' });
    expect(within(navigation).getByRole('link', { name: 'الحالات' })).toHaveAttribute('href', '/cases');
    expect(within(navigation).queryByRole('link', { name: 'الأسر' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'تسجيل الدخول' })).not.toBeInTheDocument();
  });

  it.each(['/', '/families', '/cases', '/donations', '/assistant', '/staff'])('asks signed-out staff to sign in on %s', (path) => {
    render(<MemoryRouter initialEntries={[path]}><Router /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'روح لتسجيل الدخول' })).toHaveAttribute('href', '/login');
  });

  it('shows the family workspace for signed-in managers', () => {
    render(<MemoryRouter initialEntries={['/families']}><Router session={{ id: 'synthetic', employeeCode: 'E1', displayName: 'Synthetic', role: 'manager', active: true, permissions: { casesRead: true, casesWrite: true, donationsRead: false, donationsWrite: false, assistantUse: false } }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'الحالات' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'إضافة حالة جديدة' })).toHaveAttribute('href', '/cases/new');
  });

  it('exposes the employee login form', () => {
    render(<MemoryRouter initialEntries={['/login']}><Router /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'كود الموظف' })).toBeVisible();
  });

  it('shows only pages available to the signed-in employee', () => {
    const employee: StaffProfile = {
      id: 'id', employeeCode: 'E1', displayName: 'موظف', role: 'employee', active: true,
      permissions: { casesRead: true, casesWrite: false, donationsRead: false, donationsWrite: false, assistantUse: true },
    };
    render(<MemoryRouter><AppShell staff={employee}><p>محتوى الصفحة</p></AppShell></MemoryRouter>);
    expect(screen.getByText('موظف')).toBeVisible();
    const navigation = screen.getByRole('navigation', { name: 'القائمة الرئيسية' });
    expect(within(navigation).getByRole('link', { name: 'الحالات' })).toBeVisible();
    expect(within(navigation).queryByRole('link', { name: 'الأسر' })).not.toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'المساعد الذكي' })).toBeVisible();
    expect(within(navigation).queryByRole('link', { name: 'التبرعات والكفالات' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'الموظفين' })).not.toBeInTheDocument();
  });

  it('keeps the login screen focused on signing in', () => {
    render(<MemoryRouter initialEntries={['/login']}><AppShell staff={null}><p>تسجيل الدخول</p></AppShell></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'القائمة الرئيسية' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/login');
  });

  it('shows the global offline warning and hides it again when connection returns',()=>{
    render(<MemoryRouter><AppShell staff={null}><p>سجّل دخولك</p></AppShell></MemoryRouter>);
    act(()=>window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('النت فاصل دلوقتي.. ما تقفلش الصفحة واستنى لما يرجع عشان البيانات اللي كتبتها ما تضيعش');
    act(()=>window.dispatchEvent(new Event('online')));
    expect(screen.queryByText('النت فاصل دلوقتي.. ما تقفلش الصفحة واستنى لما يرجع عشان البيانات اللي كتبتها ما تضيعش')).not.toBeInTheDocument();
  });

  it('uses the full content width when a signed-out visitor has no navigation rail', () => {
    const { container } = render(<MemoryRouter><AppShell staff={null}><p>سجّل دخولك</p></AppShell></MemoryRouter>);
    expect(container.querySelector('.app-layout')).toHaveClass('no-navigation');
  });

  it('remembers the staff member’s dark theme choice after remount', () => {
    const view = render(<MemoryRouter><AppShell staff={null}><p>سجّل دخولك</p></AppShell></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الوضع الليلي' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('maram-theme')).toBe('dark');
    view.unmount();
    render(<MemoryRouter><AppShell staff={null}><p>سجّل دخولك</p></AppShell></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'تفعيل الوضع النهاري' })).toBeVisible();
  });

  it('starts from the device theme when the staff member has not chosen one', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<MemoryRouter><AppShell staff={null}><p>سجّل دخولك</p></AppShell></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'تفعيل الوضع النهاري' })).toBeVisible();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
});
