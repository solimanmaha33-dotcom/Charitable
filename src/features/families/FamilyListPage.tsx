import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFamily, listAllMembers, listCases, listFamilies, listMembers, type Family, type FamilyProfile, type FamilyMember, type Member, type CaseRecord } from '../../services/cases';
import { normalizeArabicSearch } from '../cases/arabicSearch';
import { CASE_CATEGORIES, isCaseCategory } from '../cases/categories';
import type { CaseCategory } from '../cases/categories';
import { countCaseMembers, matchesCaseDirectoryFilter, type CaseAgeFilter } from './caseMetrics';
import { FamilyForm } from './FamilyForm';
import { FamilyFilesPanel } from './FamilyFilesPanel';
import { FamilyMemberForm } from './FamilyMemberForm';
import { ageOn } from './memberAge';
import { cairoToday } from './idExpiry';

const formatCount = new Intl.NumberFormat('ar-EG').format;

export function FamilyListPage({ canWrite }: { canWrite: boolean }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CaseCategory | ''>('');
  const [ageFilter, setAgeFilter] = useState<CaseAgeFilter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const tableWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listFamilies(), listCases(), listAllMembers()])
      .then(([familyRows, caseRows, memberRows]) => {
        if (!alive) return;
        setFamilies(familyRows);
        setCases(caseRows);
        setMembers(memberRows);
        setError('');
      })
      .catch(() => { if (alive) setError('تعذّر تحميل الحالات. حاول تحدّث الصفحة.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const categoriesByFamily = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const record of cases) {
      const values = result.get(record.family_id) ?? [];
      for (const item of record.case_categories) if (isCaseCategory(item.category) && !values.includes(item.category)) values.push(item.category);
      result.set(record.family_id, values);
    }
    return result;
  }, [cases]);
  const memberNamesByFamily = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const member of members) result.set(member.family_id, [...(result.get(member.family_id) ?? []), member.people.name]);
    return result;
  }, [members]);
  const today = cairoToday();
  const memberCounts = useMemo(() => countCaseMembers(cases, members, today), [cases, members, today]);
  const term = normalizeArabicSearch(search);
  const matches = useMemo(() => families.filter((family) => {
    const text = [family.name, family.code, family.phone ?? '', family.phone_2 ?? '', family.phone_3 ?? '', ...(memberNamesByFamily.get(family.id) ?? [])].map(normalizeArabicSearch);
    return (!term || text.some((value) => value.includes(term))) &&
      matchesCaseDirectoryFilter(family.id, cases, members, ageFilter, category, today);
  }), [families, memberNamesByFamily, term, cases, members, ageFilter, category, today]);
  useEffect(() => {
    if (!loading && window.matchMedia?.('(max-width: 680px)').matches && tableWrap.current) {
      tableWrap.current.scrollLeft = tableWrap.current.scrollWidth;
    }
  }, [loading, matches.length]);
  return (
    <section className="page-card">
      <header className="page-heading">
        <div><h1>الحالات</h1><p>ابحث عن الأسرة وافتح ملفها لمراجعة أفرادها وحالاتها.</p></div>
        {canWrite&&<Link className="primary-link" to="/cases/new">إضافة حالة جديدة</Link>}
      </header>

      <aside className="staff-steps" aria-label="خطوات تسجيل الحالة"><strong>خطوات الشغل</strong><ol><li>اضغط «إضافة حالة جديدة» وسجّل الأسرة والحالة مع بعض.</li><li>اكتب بيانات الأب والأم والمسؤول عن التربية.</li><li>أضف أرقام التليفون والملاحظات وارفع الصور أو ملفات PDF.</li><li>افتح الملف لمراجعة البيانات والطباعة.</li></ol></aside>

      <div className="toolbar">
        <label className="search-control">بحث عن حالة
          <input type="search" role="searchbox" aria-label="بحث عن حالة" placeholder="اكتب اسم الأسرة أو الفرد أو الكود أو رقم التليفون" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-control">نوع الحالة
          <select aria-label="نوع الحالة" value={category} onChange={(event) => setCategory(isCaseCategory(event.target.value) ? event.target.value : '')}>
            <option value="">كل الحالات</option>
            {CASE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-control">سن أفراد الحالة
          <select aria-label="فلترة حسب سن أفراد الحالة" value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as CaseAgeFilter)}>
            <option value="all">كل الحالات</option>
            <option value="orphans">الأيتام</option>
            <option value="under18">أقل من ١٨ سنة</option>
            <option value="under21">أقل من ٢١ سنة</option>
            <option value="elderly">كبار السن (٦٠ سنة فأكثر)</option>
          </select>
        </label>
      </div>

      {!loading && !error ? <div className="workspace-summary case-directory-summary" aria-label="ملخص الحالات">
        <article className="summary-card"><span>عدد الحالات</span><strong data-testid="case-directory-cases">{formatCount(families.length)}</strong></article>
        <article className="summary-card"><span>عدد الأطفال أقل من ١٨</span><strong data-testid="case-directory-children">{formatCount(memberCounts.children)}</strong></article>
        <article className="summary-card"><span>عدد الأيتام أقل من ١٨</span><strong data-testid="case-directory-orphans">{formatCount(memberCounts.orphans)}</strong></article>
      </div> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {loading ? <p className="empty-state" role="status">جاري تحميل الحالات…</p> : null}
      {!loading && !error && families.length === 0 ? <div className="empty-state"><strong>لسه مفيش ملفات حالات</strong>{canWrite ? 'ابدأ بإضافة ملف أسرة جديد.' : 'الملفات الجديدة هتظهر هنا.'}</div> : null}
      {!loading && !error && families.length > 0 && matches.length === 0 ? <div className="empty-state"><strong>ملقيناش حالات مطابقة</strong>جرّب كلمة تانية أو غيّر نوع الحالة.</div> : null}
      {!loading && !error && matches.length > 0 ? (
        <>
          <div className="table-caption">ملفات الحالات المعروضة: {matches.length}</div>
          <div className="data-table-wrap" ref={tableWrap}>
            <table className="data-table" aria-label="قائمة الحالات">
              <thead><tr><th scope="col">كود الأسرة</th><th scope="col">اسم الأسرة</th><th scope="col">رقم التليفون</th><th scope="col">نوع الحالة</th><th scope="col"><span className="sr-only">فتح الملف</span></th></tr></thead>
              <tbody>{matches.map((family) => (
                <tr key={family.id}>
                  <td><span className="family-code">{family.code}</span></td>
                  <td><Link to={`/cases/family/${family.id}`}>{family.name}</Link></td>
                  <td>{[family.phone,family.phone_2,family.phone_3].filter((phone):phone is string=>!!phone).length ? <span className="family-list-phones">{[family.phone,family.phone_2,family.phone_3].filter((phone):phone is string=>!!phone).map(phone=><bdi dir="ltr" key={phone}>{phone}</bdi>)}</span> : <span className="muted-cell">مش متسجل</span>}</td>
                  <td>{(categoriesByFamily.get(family.id) ?? []).length ? (categoriesByFamily.get(family.id) ?? []).map((item) => <span className="category-label" key={item}>{item}</span>) : <span className="muted-cell">مفيش تصنيف</span>}</td>
                  <td><Link className="table-action" to={`/cases/family/${family.id}`}>فتح الملف</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function FamilyDetailsPage({ canWrite }: { canWrite: boolean }) {
  const { id } = useParams();
  const [family, setFamily] = useState<FamilyProfile>();
  const [members, setMembers] = useState<Member[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingMemberId,setEditingMemberId]=useState<string|null>(null);
  const [fileRefreshKey,setFileRefreshKey]=useState(0);
  const today=cairoToday();

  async function refresh() {
    if (!id) return;
    const [found, people, records] = await Promise.all([getFamily(id), listMembers(id), listCases(id)]);
    setFamily(found ?? undefined);
    setMembers(people);
    setCases(records);
  }
  useEffect(() => {
    let alive = true;
    void refresh().catch(() => { if (alive) setError('تعذّر تحميل ملف الأسرة. حاول تحدّث الصفحة.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  return (
    <section className="page-card">
      <p><Link to="/cases">رجوع لقائمة الحالات</Link></p>
      {loading ? <p role="status">جاري تحميل ملف الأسرة…</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {!loading && !family && !error ? <div className="empty-state"><strong>ملف الأسرة مش موجود</strong><Link to="/cases">ارجع لقائمة الحالات</Link></div> : null}
      {family ? <>
        <header className="page-heading family-detail-heading">
          <div><h1>ملف الحالة</h1><div className="family-summary">
            <div><span className="family-code">{family.code}</span><h2>{family.name}</h2>
              <div className="family-contact-summary">{family.father_name&&<p>الأب: {family.father_name}</p>}{family.mother_name&&<p>الأم: {family.mother_name}</p>}{family.contact_name&&<p>المسؤول عن التربية: {family.contact_name}{family.contact_relationship?` · صلة القرابة: ${family.contact_relationship}`:''}</p>}{family.contact_age!==null&&<p>سن المسؤول: {new Intl.NumberFormat('ar-EG').format(family.contact_age)} سنة</p>}{family.national_id&&<p>الرقم القومي للمسؤول: <bdi dir="ltr">{family.national_id}</bdi></p>}{family.national_id_expires_on&&<p>انتهاء البطاقة: <time dateTime={family.national_id_expires_on}>{new Intl.DateTimeFormat('ar-EG',{dateStyle:'long'}).format(new Date(`${family.national_id_expires_on}T12:00:00`))}</time></p>}</div>
              <div className="family-detail-phones">{[family.phone,family.phone_2,family.phone_3].map((phone,index)=>phone?<p key={index}>رقم التليفون {['١','٢','٣'][index]}: <bdi dir="ltr">{phone}</bdi></p>:null)}{![family.phone,family.phone_2,family.phone_3].some(Boolean)&&<p>مفيش رقم تليفون متسجل</p>}</div>
            </div>
          </div></div>
          {canWrite ? <div className="heading-actions"><button type="button" className="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'إلغاء التعديل' : 'تعديل بيانات الأسرة'}</button><Link className="primary-link" to={`/cases/new?family=${family.id}`}>إضافة حالة</Link></div> : null}
        </header>
        {editing ? <div className="section-block"><FamilyForm family={family} onSaved={() => { setEditing(false); void refresh().catch(() => setError('اتحفظت البيانات، بس تعذّر تحديث الملف.')); }} /></div> : null}
        {family&&<FamilyFilesPanel family={family} canWrite={canWrite} refreshKey={fileRefreshKey} onFamilyUpdated={()=>{void refresh().catch(()=>setError('اتحفظت البيانات، بس تعذّر تحديث ملف الأسرة.'));}}/>}
        <section className="section-block" aria-labelledby="family-notes-title"><h2 id="family-notes-title">ملاحظات الأسرة</h2><p className="family-notes">{family.notes||'مفيش ملاحظات متسجلة للأسرة.'}</p></section>
        <section className="section-block" aria-labelledby="family-members-title">
          <div className="section-heading"><h2 id="family-members-title">أفراد الأسرة</h2><span>{members.length} أفراد</span></div>
          {members.length ? <ul className="record-list">{members.map((member) => <li key={member.person_id}><div><strong>{member.people.name}</strong><small>{member.relationship}{member.people.gender?` · ${member.people.gender==='female'?'بنت':'ولد'}`:''}{member.people.date_of_birth?` · العمر: ${new Intl.NumberFormat('ar-EG').format(ageOn(member.people.date_of_birth,today))} سنة`:''}</small>{editingMemberId===member.person_id&&id&&<FamilyMemberForm familyId={id} member={member} onAdded={async()=>{setFileRefreshKey(value=>value+1);await refresh();}}/>}</div>{canWrite&&<button type="button" className="secondary" aria-label={`تعديل بيانات السن ${member.people.name}`} onClick={()=>setEditingMemberId(current=>current===member.person_id?null:member.person_id)}>{editingMemberId===member.person_id?'إغلاق':'تعديل السن'}</button>}</li>)}</ul> : <div className="empty-state">لسه مفيش أفراد مضافين للأسرة.</div>}
          {canWrite&&id ? <FamilyMemberForm familyId={id} onAdded={async()=>{setFileRefreshKey(value=>value+1);await refresh();}}/> : null}
        </section>
        <section className="section-block" aria-labelledby="family-cases-title">
          <div className="section-heading"><h2 id="family-cases-title">حالات الأسرة</h2><span>{cases.length} حالات</span></div>
          {cases.length ? <ul className="record-list">{cases.map((record) => <li key={record.id}><div className="case-summary"><Link to={`/cases/${record.id}`}>{record.case_categories.map((item) => item.category).join('، ') || 'حالة من غير تصنيف'}</Link><small>{record.notes || 'مفيش ملاحظات'}</small></div><Link className="table-action" to={`/cases/${record.id}`}>فتح الحالة</Link></li>)}</ul> : <div className="empty-state">لسه مفيش حالات مسجلة للأسرة.</div>}
        </section>
      </> : null}
    </section>
  );
}
