import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllMembers, listCaseFiles, type CaseFile, type CaseFileStatus, type CaseFileMember } from '../../services/cases';
import { normalizeArabicSearch } from './arabicSearch';
import { CASE_CATEGORIES, isCaseCategory } from './categories';
import type { CaseCategory } from './categories';
import { countCaseMembers, matchesCaseDirectoryFilter, type CaseAgeFilter } from './caseMetrics';
import { cairoToday } from './idExpiry';

const formatCount = new Intl.NumberFormat('ar-EG').format;
const statuses: CaseFileStatus[] = ['نشط', 'موقوف', 'تحت المراجعة', 'مرفوض'];
const statusClass: Record<CaseFileStatus,string> = { 'نشط':'case-status-active','موقوف':'case-status-hold','تحت المراجعة':'case-status-review','مرفوض':'case-status-rejected' };

export function CaseListPage({ canWrite, canArchive=false }: { canWrite: boolean; canArchive?:boolean }) {
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [members, setMembers] = useState<CaseFileMember[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CaseCategory | ''>('');
  const [ageFilter, setAgeFilter] = useState<CaseAgeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CaseFileStatus | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const tableWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listCaseFiles(), listAllMembers()])
      .then(([rows, memberRows]) => { if (alive) { setFiles(rows); setMembers(memberRows); setError(''); } })
      .catch(() => { if (alive) setError('تعذّر تحميل الحالات. حاول تحدّث الصفحة.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const today = cairoToday();
  const membersByFile = useMemo(() => {
    const result = new Map<string, CaseFileMember[]>();
    for (const member of members) result.set(member.family_id, [...(result.get(member.family_id) ?? []), member]);
    return result;
  }, [members]);
  const memberCounts = useMemo(() => countCaseMembers(files, members, today), [files, members, today]);
  const term = normalizeArabicSearch(search);
  const matches = useMemo(() => files.filter((file) => {
    const fileMembers = membersByFile.get(file.id) ?? [];
    const text = [file.code, file.father_name ?? '', file.father_national_id ?? '', file.mother_name ?? '', file.mother_national_id ?? '', file.contact_name ?? '', file.phone ?? '', file.phone_2 ?? '', file.phone_3 ?? '', file.address ?? '', file.branch_area ?? '', ...fileMembers.flatMap((member) => [member.people.name, member.people.national_id ?? ''])].map(normalizeArabicSearch);
    const kinds = file.case_file_categories.map((item) => item.category);
    return (!term || text.some((value) => value.includes(term))) &&
      (!category || kinds.includes(category)) &&
      (!statusFilter || file.file_status === statusFilter) &&
      matchesCaseDirectoryFilter(file.id, files, members, ageFilter, today);
  }), [files, membersByFile, term, category, statusFilter, members, ageFilter, today]);

  function caseHref(file: CaseFile) {
    const matchedContact = term ? ([
      ['father', [file.father_name ?? '', file.father_national_id ?? '']],
      ['mother', [file.mother_name ?? '', file.mother_national_id ?? '']],
    ] as const).find(([, values]) => values.map(normalizeArabicSearch).some((value) => value.includes(term)))?.[0] : undefined;
    if (matchedContact) return `/cases/${file.id}?matchedContact=${matchedContact}#contact-${matchedContact}`;
    const matchedMember = term ? (membersByFile.get(file.id) ?? []).find((member) => [member.people.name, member.people.national_id ?? ''].map(normalizeArabicSearch).some((value) => value.includes(term))) : undefined;
    return matchedMember ? `/cases/${file.id}?matchedMember=${encodeURIComponent(matchedMember.person_id)}#member-${encodeURIComponent(matchedMember.person_id)}` : `/cases/${file.id}`;
  }

  useEffect(() => {
    if (!loading && window.matchMedia?.('(max-width: 680px)').matches && tableWrap.current) tableWrap.current.scrollLeft = tableWrap.current.scrollWidth;
  }, [loading, matches.length]);

  return <section className="page-card">
    <header className="page-heading">
      <div><h1>الحالات</h1><p>كل ملف له كود واحد، ومنه تراجع بيانات الأسرة والأفراد والمرفقات.</p></div>
      <div className="heading-actions">{canArchive&&<Link className="button secondary" to="/cases/archive">الحالات المؤرشفة</Link>}{canWrite && <Link className="primary-link" to="/cases/new">إضافة حالة جديدة</Link>}</div>
    </header>
    <aside className="staff-steps" aria-label="خطوات تسجيل الحالة"><strong>خطوات الشغل</strong><ol><li>اضغط «إضافة حالة جديدة».</li><li>اختار نوع الحالة وسجّل بيانات الأم والأب والعنوان.</li><li>حدد حالة الملف؛ واكتب السبب لو اخترت موقوف أو مرفوض.</li><li>ارفع الصور أو PDF، وبعدها افتح الملف للمراجعة والطباعة.</li></ol></aside>
    <div className="toolbar">
      <label className="search-control">بحث عن حالة<input type="search" role="searchbox" aria-label="بحث عن حالة" placeholder="اكتب الكود أو اسم الأب أو الأم أو العنوان أو رقم التليفون" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="filter-control">نوع الحالة<select aria-label="نوع الحالة" value={category} onChange={(event) => setCategory(isCaseCategory(event.target.value) ? event.target.value : '')}><option value="">كل أنواع الحالات</option>{CASE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="filter-control">حالة الملف<select aria-label="حالة الملف" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CaseFileStatus | '')}><option value="">كل الحالات</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="filter-control">سن أفراد الحالة<select aria-label="فلترة حسب سن أفراد الحالة" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as CaseAgeFilter)}><option value="all">كل الأعمار</option><option value="orphans">الأيتام</option><option value="under18">أقل من ١٨ سنة</option><option value="under21">أقل من ٢١ سنة</option><option value="elderly">كبار السن (٦٠ سنة فأكثر)</option></select></label>
    </div>
    {!loading && !error && <div className="workspace-summary case-directory-summary" aria-label="ملخص الحالات"><article className="summary-card"><span>عدد الحالات</span><strong data-testid="case-directory-cases">{formatCount(files.length)}</strong></article><article className="summary-card"><span>عدد الأطفال أقل من ١٨</span><strong data-testid="case-directory-children">{formatCount(memberCounts.children)}</strong></article><article className="summary-card"><span>عدد الأيتام أقل من ١٨</span><strong data-testid="case-directory-orphans">{formatCount(memberCounts.orphans)}</strong></article></div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {loading && <p className="empty-state" role="status">جاري تحميل الحالات…</p>}
    {!loading && !error && files.length === 0 && <div className="empty-state"><strong>لسه مفيش ملفات حالات</strong>{canWrite ? 'ابدأ بإضافة ملف حالة جديد.' : 'الملفات الجديدة هتظهر هنا.'}</div>}
    {!loading && !error && files.length > 0 && matches.length === 0 && <div className="empty-state"><strong>ملقيناش حالات مطابقة</strong>جرّب كلمة تانية أو غيّر الفلاتر.</div>}
    {!loading && !error && matches.length > 0 && <><div className="table-caption">ملفات الحالات المعروضة: {formatCount(matches.length)}</div><p className="table-scroll-help">اسحب الجدول يمين وشمال لعرض باقي البيانات.</p><div className="data-table-wrap" ref={tableWrap}><table className="data-table" aria-label="قائمة الحالات">
      <thead><tr><th scope="col">كود الملف</th><th scope="col">الأب والأم</th><th scope="col">التليفونات</th><th scope="col">نوع الحالة</th><th scope="col">حالة الملف</th><th scope="col"><span className="sr-only">فتح الملف</span></th></tr></thead>
      <tbody>{matches.map((file) => {
        const kinds = file.case_file_categories.map((item) => item.category);
        const href=caseHref(file);
        return <tr key={file.id}><td><Link to={href}><span className="family-code">{file.code}</span></Link></td>
          <td><Link to={href}>{[file.father_name && `الأب: ${file.father_name}`, file.mother_name && `الأم: ${file.mother_name}`].filter(Boolean).join(' · ') || <span className="muted-cell">الأسماء مش متسجلة</span>}</Link></td>
          <td>{[file.phone,file.phone_2,file.phone_3].filter((phone):phone is string=>!!phone).length ? <span className="family-list-phones">{[file.phone,file.phone_2,file.phone_3].filter((phone):phone is string=>!!phone).map((phone,index)=><bdi dir="ltr" key={index}>{phone}</bdi>)}</span> : <span className="muted-cell">مش متسجل</span>}</td>
          <td>{kinds.length ? kinds.map((item) => <span className="category-label" key={item}>{item}</span>) : <span className="muted-cell">مفيش تصنيف</span>}</td>
          <td><span className={`status-label case-file-status ${statusClass[file.file_status]}`}>{file.file_status}</span>{file.status_reason && <small className="status-reason">{file.status_reason}</small>}</td>
          <td><Link className="table-action" to={href}>فتح الملف</Link></td></tr>;
      })}</tbody>
    </table></div></>}
  </section>;
}
