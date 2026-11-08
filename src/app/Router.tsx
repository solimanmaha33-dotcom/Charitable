import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { StaffPage } from '../features/staff/StaffPage';
import { HomePage } from '../features/home/HomePage';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { DonationListPage } from '../features/donations/DonationListPage';
import { LoginPage } from '../features/auth/LoginPage';
import { FamilyDetailsPage, FamilyListPage } from '../features/families/FamilyListPage';
import { CaseDetailsPage } from '../features/cases/CaseDetailsPage';
import {
  hasPermission,
  type EmployeePermission,
  type StaffProfile,
} from '../features/auth/permissions';
import { currentStaff, getSupabase } from '../services/supabase';
const applicationRoutes = [
  ['/', 'الرئيسية', null],
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
export function Router({ session, onStaffChange }: { session?: StaffProfile | null; onStaffChange?: (staff: StaffProfile | null) => void }) {
  const [verified, setVerified] = useState<StaffProfile | null>(null);
  const [error, setError] = useState('');
  const staff = session === undefined ? verified : session;
  async function refresh() {
    const profile = await currentStaff();
    setVerified(profile);
    onStaffChange?.(profile);
  }
  useEffect(() => {
    if (session !== undefined || !getSupabase()) return;
    let alive = true;
    const refreshProfile = () => {
      void currentStaff().then((profile) => {
        if (alive) {
          setVerified(profile);
          onStaffChange?.(profile);
        }
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
      {error ? <p className="error-message" role="alert">{error}</p> : null}
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
        <Route path="/families" element={<Navigate to="/cases" replace />} />
        <Route path="/families/:id" element={<LegacyFamilyRedirect />} />
        <Route path="/cases" element={!staff?.active ? <SignInPrompt /> : !allowed('/cases', 'casesRead') ? <section className="page-card"><h1>معندكش صلاحية للصفحة دي</h1></section> : <FamilyListPage canWrite={hasPermission(staff, 'casesWrite')} />} />
        <Route path="/cases/family/:id" element={!staff?.active ? <SignInPrompt /> : !allowed('/cases', 'casesRead') ? <section className="page-card"><h1>معندكش صلاحية للصفحة دي</h1></section> : <FamilyDetailsPage canWrite={hasPermission(staff, 'casesWrite')} />} />
        <Route path="/cases/new" element={!staff?.active ? <SignInPrompt /> : !allowed('/cases', 'casesRead') ? <section className="page-card"><h1>معندكش صلاحية للصفحة دي</h1></section> : <CaseDetailsPage canWrite={hasPermission(staff, 'casesWrite')} />} />
        <Route path="/cases/:id" element={!staff?.active ? <SignInPrompt /> : !allowed('/cases', 'casesRead') ? <section className="page-card"><h1>معندكش صلاحية للصفحة دي</h1></section> : <CaseDetailsPage canWrite={hasPermission(staff, 'casesWrite')} />} />
        {applicationRoutes.map(([path, , permission]) => (
          <Route
            key={path}
            path={path}
            element={
              !staff?.active ? (
                <SignInPrompt />
              ) : allowed(path, permission) ? (
                path === '/staff' ? <StaffPage role={staff.role} /> : path === '/assistant' ? <AssistantPanel /> : path === '/donations' ? <DonationListPage canWrite={hasPermission(staff, 'donationsWrite')} canReadCases={hasPermission(staff, 'casesRead')} /> : <HomePage staff={staff} />
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

function LegacyFamilyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/cases/family/${id}`} replace />;
}
