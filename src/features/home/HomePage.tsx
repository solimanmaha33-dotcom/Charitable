import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasPermission, type StaffProfile } from '../auth/permissions';
import { countCaseFiles, listAgeThresholdMembers, listAllMembers, listCaseFiles, listCaseFileIdExpirationsBy, type CaseFileIdExpiry, type MemberAgeProfile } from '../../services/cases';
import { countDonations } from '../../services/donations';
import { addDateOnlyDays, cairoToday, groupIdExpirations } from '../cases/idExpiry';
import { findMemberAgeAlerts, type MemberAgeAlert } from '../cases/memberAge';
import { countCaseMembers } from '../cases/caseMetrics';

const formatCount = new Intl.NumberFormat('ar-EG').format;
const caseFileLabel = (row: CaseFileIdExpiry) => [row.father_name && `الأب: ${row.father_name}`, row.mother_name && `الأم: ${row.mother_name}`].filter(Boolean).join(' · ') || 'ملف حالة';

type Action = { label: string; description: string; to: string; primary?: boolean };

export function HomePage({ staff }: { staff: StaffProfile }) {
  const canReadCases = hasPermission(staff, 'casesRead');
  const canReadDonations = hasPermission(staff, 'donationsRead');
  const [counts, setCounts] = useState<{cases: number|null; children: number|null; orphans: number|null; donations: number|null}>({cases:null,children:null,orphans:null,donations:null});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [idExpiryRows,setIdExpiryRows]=useState<CaseFileIdExpiry[]>([]);
  const [loadingIdExpiry,setLoadingIdExpiry]=useState(true);
  const [idExpiryError,setIdExpiryError]=useState(false);
  const [memberAgeAlerts,setMemberAgeAlerts]=useState<MemberAgeAlert[]>([]);
  const [loadingMemberAgeAlerts,setLoadingMemberAgeAlerts]=useState(true);
  const [memberAgeError,setMemberAgeError]=useState(false);

  useEffect(() => {
    let active = true;
    setLoadingCounts(true);
    const unavailable = Promise.resolve(undefined);
    Promise.all([
      canReadCases ? countCaseFiles().catch(() => null) : unavailable,
      canReadCases ? listCaseFiles().catch(() => null) : unavailable,
      canReadCases ? listAllMembers().catch(() => null) : unavailable,
      canReadDonations ? countDonations().catch(() => null) : unavailable,
    ]).then(([cases,caseRows,members,donations]) => {
      const memberTotals = caseRows && members ? countCaseMembers(caseRows, members, cairoToday()) : null;
      if (active) setCounts({cases:cases ?? null,children:memberTotals?.children ?? null,orphans:memberTotals?.orphans ?? null,donations:donations ?? null});
    }).finally(() => { if (active) setLoadingCounts(false); });
    return () => { active = false; };
  }, [staff.id, canReadCases, canReadDonations]);

  useEffect(()=>{
    let active=true;
    if(!canReadCases){setIdExpiryRows([]);setIdExpiryError(false);setLoadingIdExpiry(false);return()=>{active=false;};}
    setLoadingIdExpiry(true);setIdExpiryError(false);
    void listCaseFileIdExpirationsBy(addDateOnlyDays(cairoToday(),90)).then(rows=>{if(active)setIdExpiryRows(rows);}).catch(()=>{if(active)setIdExpiryError(true);}).finally(()=>{if(active)setLoadingIdExpiry(false);});
    return()=>{active=false;};
  },[staff.id,canReadCases]);

  useEffect(()=>{
    let active=true;
    if(!canReadCases){setMemberAgeAlerts([]);setMemberAgeError(false);setLoadingMemberAgeAlerts(false);return()=>{active=false;};}
    setLoadingMemberAgeAlerts(true);setMemberAgeError(false);
    void listAgeThresholdMembers().then(rows=>{if(active)setMemberAgeAlerts(findMemberAgeAlerts(toAgeCandidates(rows),cairoToday()));}).catch(()=>{if(active)setMemberAgeError(true);}).finally(()=>{if(active)setLoadingMemberAgeAlerts(false);});
    return()=>{active=false;};
  },[staff.id,canReadCases]);

  const expiryGroups=groupIdExpirations(idExpiryRows,cairoToday());
  const formatDate=(date:string)=>new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(`${date}T12:00:00`));

  const actions: Action[] = [];
  if (canReadCases) {
    actions.push({ label: 'الحالات', description: 'دور على حالة وافتح ملفها', to: '/cases' });
  }
  if (hasPermission(staff, 'casesWrite')) {
    actions.unshift({ label: 'إضافة حالة جديدة', description: 'سجّل الأسرة والحالة مع بعض', to: '/cases/new', primary: true });
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
          <article className="summary-card"><span>الحالات المسجلة</span><strong data-testid="summary-cases">{loadingCounts ? 'جاري التحميل…' : counts.cases === null ? 'تعذّر التحميل' : formatCount(counts.cases)}</strong></article>
          <article className="summary-card"><span>الأطفال أقل من ١٨ سنة</span><strong data-testid="summary-children">{loadingCounts ? 'جاري التحميل…' : counts.children === null ? 'تعذّر التحميل' : formatCount(counts.children)}</strong></article>
          <article className="summary-card"><span>الأيتام أقل من ١٨ سنة</span><strong data-testid="summary-orphans">{loadingCounts ? 'جاري التحميل…' : counts.orphans === null ? 'تعذّر التحميل' : formatCount(counts.orphans)}</strong></article>
        </> : null}
        {canReadDonations ? <article className="summary-card"><span>التبرعات المسجلة</span><strong data-testid="summary-donations">{loadingCounts ? 'جاري التحميل…' : counts.donations === null ? 'تعذّر التحميل' : formatCount(counts.donations)}</strong></article> : null}
      </section> : null}
      {canReadCases?<section className="section-block id-expiry-alerts" aria-labelledby="id-expiry-title">
        <div className="section-heading"><h2 id="id-expiry-title">متابعة انتهاء بطاقات الرقم القومي</h2><span>خلال ٩٠ يوم</span></div>
        <p className="form-help">التنبيه بيظهر للبطاقات اللي تاريخ انتهائها متسجل في ملف الأسرة.</p>
        {loadingIdExpiry&&<p role="status">جاري تحميل مواعيد انتهاء البطاقات…</p>}
        {idExpiryError&&<p className="error-message" role="alert">تعذّر تحميل مواعيد البطاقات. حاول تحدّث الصفحة.</p>}
        {!loadingIdExpiry&&!idExpiryError&&!expiryGroups.expired.length&&!expiryGroups.upcoming.length&&<div className="empty-state">مفيش بطاقات منتهية أو هتنتهي خلال ٩٠ يوم من اللي متسجل تاريخها.</div>}
        {!loadingIdExpiry&&!idExpiryError&&(expiryGroups.expired.length>0||expiryGroups.upcoming.length>0)&&<ul className="record-list">
          {expiryGroups.expired.map(row=><li key={row.id}><div><Link to={`/cases/${row.id}`}>{caseFileLabel(row)} <span className="family-code">{row.code}</span></Link><small>انتهت يوم {formatDate(row.national_id_expires_on)}</small></div><strong className="expiry-status expiry-status-expired">منتهية</strong></li>)}
          {expiryGroups.upcoming.map(row=><li key={row.id}><div><Link to={`/cases/${row.id}`}>{caseFileLabel(row)} <span className="family-code">{row.code}</span></Link><small>تاريخ الانتهاء {formatDate(row.national_id_expires_on)}</small></div><strong className="expiry-status">{row.daysLeft===0?'هتنتهي النهارده':`هتنتهي خلال ${new Intl.NumberFormat('ar-EG').format(row.daysLeft)} يوم`}</strong></li>)}
        </ul>}
      </section>:null}
      {canReadCases?<section className="section-block member-age-alerts" aria-labelledby="member-age-title">
        <div className="section-heading"><h2 id="member-age-title">متابعة السن</h2><span>قبل السن المحدد بـ٩٠ يوم</span></div>
        <p className="form-help">لما تاريخ الميلاد والنوع يكونوا متسجلين في ملف الفرد.</p>
        {loadingMemberAgeAlerts&&<p role="status">جاري مراجعة أعمار أفراد الأسر…</p>}
        {memberAgeError&&<p className="error-message" role="alert">تعذّر تحميل أعمار الأفراد. حاول تحدّث الصفحة.</p>}
        {!loadingMemberAgeAlerts&&!memberAgeError&&!memberAgeAlerts.length&&<div className="empty-state">مفيش أفراد هيكملوا السن المحدد خلال ٩٠ يوم من بيانات الميلاد المسجلة.</div>}
        {!loadingMemberAgeAlerts&&!memberAgeError&&memberAgeAlerts.length>0&&<ul className="record-list">{memberAgeAlerts.map(alert=><li key={alert.personId}><div><Link to={`/cases/${alert.caseFileId}`}>{alert.name} · {alert.caseFileLabel} <span className="family-code">{alert.caseFileCode}</span></Link><small>العمر الحالي {new Intl.NumberFormat('ar-EG').format(alert.age)} سنة · هيكمل {new Intl.NumberFormat('ar-EG').format(alert.targetAge)} سنة يوم {formatDate(alert.thresholdDate)}</small></div><strong className="expiry-status">{alert.daysUntilThreshold===0?'النهارده':`خلال ${new Intl.NumberFormat('ar-EG').format(alert.daysUntilThreshold)} يوم`}</strong></li>)}</ul>}
      </section>:null}
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

function toAgeCandidates(rows:MemberAgeProfile[]){
 return rows.map(row=>({personId:row.person_id,name:row.people.name,gender:row.people.gender,birthDate:row.people.date_of_birth,caseFileId:row.family_id,caseFileLabel:[row.case_file.father_name&&`الأب: ${row.case_file.father_name}`,row.case_file.mother_name&&`الأم: ${row.case_file.mother_name}`].filter(Boolean).join(' · ')||'ملف حالة',caseFileCode:row.case_file.code}));
}
