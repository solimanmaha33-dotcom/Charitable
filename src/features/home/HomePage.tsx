import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasPermission, type StaffProfile } from '../auth/permissions';
import { countCases, countFamilies } from '../../services/cases';
import { countDonations } from '../../services/donations';

type Action = { label: string; description: string; to: string; primary?: boolean };

export function HomePage({ staff }: { staff: StaffProfile }) {
  const canReadCases = hasPermission(staff, 'casesRead');
  const canReadDonations = hasPermission(staff, 'donationsRead');
  const [counts, setCounts] = useState<{families: number|null; cases: number|null; donations: number|null}>({families:null,cases:null,donations:null});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingCounts(true);
    const unavailable = Promise.resolve(undefined);
    Promise.all([
      canReadCases ? countFamilies().catch(() => null) : unavailable,
      canReadCases ? countCases().catch(() => null) : unavailable,
      canReadDonations ? countDonations().catch(() => null) : unavailable,
    ]).then(([families,cases,donations]) => {
      if (active) setCounts({families:families ?? null,cases:cases ?? null,donations:donations ?? null});
    }).finally(() => { if (active) setLoadingCounts(false); });
    return () => { active = false; };
  }, [staff.id, canReadCases, canReadDonations]);

  const actions: Action[] = [];
  if (canReadCases) {
    actions.push({ label: 'الأسر', description: 'دور على أسرة وافتح ملفها', to: '/families' });
    actions.push({ label: 'الحالات', description: 'راجع الحالات المسجلة', to: '/cases' });
  }
  if (hasPermission(staff, 'casesWrite')) {
    actions.unshift({ label: 'إضافة أسرة', description: 'سجّل أسرة جديدة وافتح ملفها', to: '/families?add=1', primary: true });
    actions.push({ label: 'تسجيل حالة', description: 'أضف حالة وارفق صور أو ملفات', to: '/cases/new' });
  }
  if (canReadDonations) {
    actions.push({ label: 'التبرعات والكفالات', description: 'راجع التبرعات والدفعات الشهرية', to: '/donations' });
  }
  if (hasPermission(staff, 'donationsWrite') && hasPermission(staff, 'donationsRead')) {
    actions.push({ label: 'تسجيل تبرع', description: 'أضف تبرع أو كفالة جديدة', to: '/donations?add=donation', primary: true });
  }
  if (hasPermission(staff, 'assistantUse')) {
    actions.push({ label: 'المساعد الذكي', description: 'اسأل عن البيانات المسموح لك بيها', to: '/assistant' });
  }
  if (staff.role !== 'employee') {
    actions.push({ label: 'الموظفين', description: 'إدارة الموظفين وصلاحياتهم', to: '/staff' });
  }

  return (
    <section className="page-card home-page">
      <header className="page-heading">
        <div>
          <h1>أهلاً بيك، {staff.displayName}</h1>
          <p>اختار الشغل اللي عايز تعمله.</p>
        </div>
      </header>
      {(canReadCases || canReadDonations) ? <section className="workspace-summary" aria-label="ملخص السجلات">
        {canReadCases ? <>
          <article className="summary-card"><span>الأسر المسجلة</span><strong data-testid="summary-families">{loadingCounts ? 'جاري التحميل…' : counts.families ?? 'تعذّر التحميل'}</strong></article>
          <article className="summary-card"><span>الحالات المسجلة</span><strong data-testid="summary-cases">{loadingCounts ? 'جاري التحميل…' : counts.cases ?? 'تعذّر التحميل'}</strong></article>
        </> : null}
        {canReadDonations ? <article className="summary-card"><span>التبرعات المسجلة</span><strong data-testid="summary-donations">{loadingCounts ? 'جاري التحميل…' : counts.donations ?? 'تعذّر التحميل'}</strong></article> : null}
      </section> : null}
      <section aria-labelledby="home-actions-title" className="home-actions-section">
        <h2 id="home-actions-title">ابدأ من هنا</h2>
        {actions.length ? (
          <div className="home-actions">
            {actions.map((action) => (
              <Link className={`home-action${action.primary ? ' home-action-primary' : ''}`} key={`${action.label}-${action.to}`} to={action.to}>
                <span><strong>{action.label}</strong><small>{action.description}</small></span>
                <span aria-hidden="true" className="home-action-arrow">←</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">مفيش صفحات متاحة لحسابك دلوقتي. اطلب من المدير يراجع صلاحياتك.</div>
        )}
      </section>
    </section>
  );
}
