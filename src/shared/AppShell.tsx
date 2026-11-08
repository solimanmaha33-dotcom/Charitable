import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { hasPermission, type StaffProfile } from '../features/auth/permissions';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem('maram-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Keep the app usable if browser storage is unavailable.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const navigation = [
  ['/', 'الرئيسية', 'home'],
  ['/cases', 'الحالات', 'cases'],
  ['/donations', 'التبرعات والكفالات', 'donations'],
  ['/assistant', 'المساعد الذكي', 'assistant'],
  ['/staff', 'الموظفين', 'staff'],
] as const;

function NavigationIcon({ name }: { name: (typeof navigation)[number][2] }) {
  const paths: Record<(typeof navigation)[number][2], ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    cases: <><path d="M7 3h10v3h3v15H4V6h3z" /><path d="M8 11h8M8 15h8" /></>,
    donations: <><path d="M12 20s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.4-8 10-8 10Z" /><path d="M3 21h18" /></>,
    assistant: <><path d="M4 4h7a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H4z" /><path d="M20 4h-1a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h1z" /></>,
    staff: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function AppShell({ children, staff, onSignOut, logoutError }: { children: ReactNode; staff?: StaffProfile | null; onSignOut?: () => void; logoutError?: string }) {
  const { pathname } = useLocation();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const loginPage = pathname === '/login';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('maram-theme', theme);
    } catch {
      // Applying the theme does not depend on browser storage.
    }
  }, [theme]);
  const visibleNavigation = staff === undefined
    ? navigation
    : navigation.filter(([to]) => {
        if (!staff?.active) return false;
        if (to === '/') return true;
        if (to === '/cases') return hasPermission(staff, 'casesRead');
        if (to === '/donations') return hasPermission(staff, 'donationsRead');
        if (to === '/assistant') return hasPermission(staff, 'assistantUse');
        if (to === '/staff') return staff.role !== 'employee';
        return false;
      });
  return (
    <div className="app-shell" lang="ar" dir="rtl">
      <a className="skip-link" href="#main-content">روح لمحتوى الصفحة</a>
      <header className="app-header">
        <div className="header-content">
          <Link className="brand" to="/" aria-label="مرام الخير - الرئيسية">
            <span className="brand-mark" aria-hidden="true">✿</span>
            <span><strong className="product-name">مرام الخير</strong><small>نظام إدارة الجمعية</small></span>
          </Link>
          <div className="header-tools">
            {staff?.active ? <span className="header-user"><strong>{staff.displayName}</strong><small>كود الموظف: <bdi dir="ltr">{staff.employeeCode}</bdi></small></span> : null}
            <button type="button" className="theme-toggle secondary" aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
              <span aria-hidden="true">{theme === 'dark' ? '☼' : '◐'}</span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            </button>
            {staff?.active && onSignOut ? <button type="button" className="secondary sign-out-button" onClick={onSignOut}>تسجيل الخروج</button> : null}
            {!staff?.active ? <Link className="header-login" to="/login">تسجيل الدخول</Link> : null}
          </div>
        </div>
      </header>
      {logoutError ? <p className="error-message header-error" role="alert">{logoutError}</p> : null}
      <div className={`app-layout${loginPage ? ' login-layout' : ''}${!loginPage && visibleNavigation.length === 0 ? ' no-navigation' : ''}`}>
        {!loginPage && visibleNavigation.length > 0 ? <nav className="app-navigation" aria-label="القائمة الرئيسية">
          <span className="navigation-caption">القائمة الرئيسية</span>
          {visibleNavigation.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><NavigationIcon name={icon} /><span>{label}</span></NavLink>)}
        </nav> : null}
        <main id="main-content" tabIndex={-1} className="app-main">{children}</main>
      </div>
      <footer>مع بعض نسهّل شغل الجمعية</footer>
    </div>
  );
}
