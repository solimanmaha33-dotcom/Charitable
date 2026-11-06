import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import {
  hasPermission,
  type EmployeePermission,
  type StaffProfile,
} from '../features/auth/permissions';
import { currentStaff, getSupabase, signOut } from '../services/supabase';
const applicationRoutes = [
  ['/', 'الرئيسية', null],
  ['/families', 'الأسر', 'casesRead'],
  ['/cases', 'الحالات', 'casesRead'],
  ['/donations', 'التبرعات والكفالات', 'donationsRead'],
  ['/assistant', 'المساعد', 'assistantUse'],
  ['/staff', 'الموظفين', null],
] as const;
function SignInPrompt() {
  return (
    <section className="page-card">
      <h1>سجّل دخولك الأول</h1>
      <p>عشان تفتح الصفحة دي، محتاج تدخل بحسابك.</p>
      <Link className="primary-link" to="/login">
        روح لتسجيل الدخول
      </Link>
    </section>
  );
}
export function Router({ session }: { session?: StaffProfile | null }) {
  const [verified, setVerified] = useState<StaffProfile | null>(null);
  const [error, setError] = useState('');
  const staff = session === undefined ? verified : session;
  async function refresh() {
    setVerified(await currentStaff());
  }
  useEffect(() => {
    if (session !== undefined || !getSupabase()) return;
    let alive = true;
    const refreshProfile = () => {
      void currentStaff().then((profile) => {
        if (alive) setVerified(profile);
      });
    };
    refreshProfile();
    const { data } = getSupabase()!.auth.onAuthStateChange(() => {
      setTimeout(refreshProfile, 0);
    });
    window.addEventListener('focus', refreshProfile);
    const timer = window.setInterval(refreshProfile, 60000);
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      window.removeEventListener('focus', refreshProfile);
      window.clearInterval(timer);
    };
  }, [session]);
  async function logout() {
    try {
      await signOut();
      setVerified(null);
      setError('');
    } catch {
      setError('تعذّر تسجيل الخروج. حاول تاني.');
    }
  }
  function allowed(path: string, permission: keyof EmployeePermission | null) {
    return (
      !!staff?.active &&
      (path === '/staff'
        ? staff.role !== 'employee'
        : !permission || hasPermission(staff, permission))
    );
  }
  return (
    <>
      {staff?.active ? <button onClick={logout}>تسجيل الخروج</button> : null}
      {error ? <p role="alert">{error}</p> : null}
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              onSignedIn={() => {
                void refresh();
              }}
            />
          }
        />
        {applicationRoutes.map(([path, title, permission]) => (
          <Route
            key={path}
            path={path}
            element={
              !staff?.active ? (
                <SignInPrompt />
              ) : allowed(path, permission) ? (
                <section className="page-card">
                  <h1>{title}</h1>
                  <p>الصفحة دي هتكون جاهزة قريب.</p>
                </section>
              ) : (
                <section className="page-card">
                  <h1>معندكش صلاحية للصفحة دي</h1>
                </section>
              )
            }
          />
        ))}
        <Route
          path="*"
          element={
            <section className="page-card">
              <h1>الصفحة دي مش موجودة</h1>
              <Link to="/">ارجع للرئيسية</Link>
            </section>
          }
        />
      </Routes>
    </>
  );
}
