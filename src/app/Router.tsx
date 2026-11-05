import { Link, Route, Routes } from 'react-router-dom';

// This UI seam is replaced with the verified staff session in Task 2.
// Server and database authorization are required before any records are added.
type ShellSession = { employeeId: string };

const applicationRoutes = [
  ['/', 'الرئيسية'], ['/families', 'الأسر'], ['/cases', 'الحالات'],
  ['/donations', 'التبرعات والكفالات'], ['/assistant', 'المساعد'], ['/staff', 'الموظفين'],
] as const;

function SignInPrompt() {
  return <section className="page-card"><h1>سجّل دخولك الأول</h1><p>عشان تفتح الصفحة دي، محتاج تدخل بحسابك.</p><Link className="primary-link" to="/login">روح لتسجيل الدخول</Link></section>;
}

export function Router({ session = null }: { session?: ShellSession | null }) {
  return (
    <Routes>
      <Route path="/login" element={<section className="page-card"><h1>تسجيل الدخول</h1><p>الدخول بحساب الموظف هيتجهز في الخطوة الجاية.</p></section>} />
      {applicationRoutes.map(([path, title]) => <Route key={path} path={path} element={session
        ? <section className="page-card"><h1>{title}</h1><p>الصفحة دي هتكون جاهزة قريب.</p></section>
        : <SignInPrompt />} />)}
      <Route path="*" element={<section className="page-card"><h1>الصفحة دي مش موجودة</h1><Link to="/">ارجع للرئيسية</Link></section>} />
    </Routes>
  );
}
