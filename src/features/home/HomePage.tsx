import { Link } from 'react-router-dom';
import { hasPermission, type StaffProfile } from '../auth/permissions';

type Action = { label: string; description: string; to: string; primary?: boolean };

export function HomePage({ staff }: { staff: StaffProfile }) {
  const actions: Action[] = [];
  if (hasPermission(staff, 'casesRead')) {
    actions.push({ label: 'الأسر', description: 'دور على أسرة وافتح ملفها', to: '/families' });
    actions.push({ label: 'الحالات', description: 'راجع الحالات المسجلة', to: '/cases' });
  }
  if (hasPermission(staff, 'casesWrite')) {
    actions.unshift({ label: 'إضافة أسرة', description: 'سجّل أسرة جديدة وافتح ملفها', to: '/families?add=1', primary: true });
    actions.push({ label: 'تسجيل حالة', description: 'أضف حالة وارفق صور أو ملفات', to: '/cases/new' });
  }
  if (hasPermission(staff, 'donationsRead')) {
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
