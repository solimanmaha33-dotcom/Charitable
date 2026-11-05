import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const navigation = [
  ['/', 'الرئيسية'],
  ['/families', 'الأسر'],
  ['/cases', 'الحالات'],
  ['/donations', 'التبرعات والكفالات'],
  ['/assistant', 'المساعد'],
  ['/staff', 'الموظفين'],
  ['/login', 'تسجيل الدخول'],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell" lang="ar" dir="rtl">
      <a className="skip-link" href="#main-content">روح لمحتوى الصفحة</a>
      <header className="app-header">
        <div className="header-content">
          <span className="product-name">نظام الجمعية</span>
          <p>الأسر والحالات والتبرعات في مكان واحد</p>
        </div>
      </header>
      <div className="app-layout">
        <nav className="app-navigation" aria-label="القائمة الرئيسية">
          {navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <footer>مع بعض نسهّل شغل الجمعية</footer>
    </div>
  );
}
