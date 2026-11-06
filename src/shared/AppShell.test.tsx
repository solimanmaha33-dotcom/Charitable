import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { Router } from '../app/Router';

describe('Arabic application shell', () => {
  it('gives its content Arabic language, RTL direction, and a named navigation', () => {
    render(<MemoryRouter><AppShell><p>محتوى الصفحة</p></AppShell></MemoryRouter>);
    const main = screen.getByRole('main');
    expect(main.closest('[lang="ar"][dir="rtl"]')).not.toBeNull();
    expect(screen.getByText('نظام الجمعية')).toBeVisible();
    expect(within(main).getByText('محتوى الصفحة')).toBeVisible();
    const navigation = screen.getByRole('navigation', { name: 'القائمة الرئيسية' });
    expect(within(navigation).getByRole('link', { name: 'الأسر' })).toHaveAttribute('href', '/families');
    expect(within(navigation).getByRole('link', { name: 'تسجيل الدخول' })).toHaveAttribute('href', '/login');
  });

  it.each(['/', '/families', '/cases', '/donations', '/assistant', '/staff'])('asks signed-out staff to sign in on %s', (path) => {
    render(<MemoryRouter initialEntries={[path]}><Router /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'سجّل دخولك الأول' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'روح لتسجيل الدخول' })).toHaveAttribute('href', '/login');
  });

  it('shows the family workspace for signed-in managers', () => {
    render(<MemoryRouter initialEntries={['/families']}><Router session={{ id: 'synthetic', employeeCode: 'E1', displayName: 'Synthetic', role: 'manager', active: true, permissions: { casesRead: false, casesWrite: false, donationsRead: false, donationsWrite: false, assistantUse: false } }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'الأسر' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'إضافة أسرة' })).toBeVisible();
  });

  it('exposes the employee login form', () => {
    render(<MemoryRouter initialEntries={['/login']}><Router /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'كود الموظف' })).toBeVisible();
  });
});
