import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addMember, getFamily, listAllMembers, listCases, listFamilies, listMembers, type Family, type FamilyProfile, type FamilyMember, type Member, type CaseRecord } from '../../services/cases';
import { normalizeArabicSearch } from '../cases/arabicSearch';
import { CASE_CATEGORIES } from '../cases/categories';
import { FamilyForm } from './FamilyForm';
import { FamilyFilesPanel } from './FamilyFilesPanel';

export function FamilyListPage({ canWrite }: { canWrite: boolean }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [adding, setAdding] = useState(searchParams.get('add') === '1');
  const tableWrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
      .catch(() => { if (alive) setError('تعذّر تحميل الأسر. حاول تحدّث الصفحة.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const categoriesByFamily = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const record of cases) {
      const values = result.get(record.family_id) ?? [];
      for (const item of record.case_categories) if (!values.includes(item.category)) values.push(item.category);
      result.set(record.family_id, values);
    }
    return result;
  }, [cases]);
  const memberNamesByFamily = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const member of members) result.set(member.family_id, [...(result.get(member.family_id) ?? []), member.people.name]);
    return result;
  }, [members]);
  const term = normalizeArabicSearch(search);
  const matches = families.filter((family) => {
    const text = [family.name, family.code, family.phone ?? '', family.phone_2 ?? '', family.phone_3 ?? '', ...(memberNamesByFamily.get(family.id) ?? [])].map(normalizeArabicSearch);
    return (!term || text.some((value) => value.includes(term))) && (!category || (categoriesByFamily.get(family.id) ?? []).includes(category));
  });
  useEffect(() => {
    if (!loading && window.matchMedia?.('(max-width: 680px)').matches && tableWrap.current) {
      tableWrap.current.scrollLeft = tableWrap.current.scrollWidth;
    }
  }, [loading, matches.length]);
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setAdding(true);
      searchParams.delete('add');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <section className="page-card">
      <header className="page-heading">
        <div><h1>الأسر</h1><p>دور على أسرة وافتح ملفها.</p></div>
        {canWrite ? <button type="button" onClick={() => setAdding((value) => !value)}>{adding ? 'إلغاء الإضافة' : 'إضافة أسرة'}</button> : null}
      </header>

      {adding ? <div className="section-block"><FamilyForm onSaved={(id) => navigate(`/families/${id}`)} /></div> : null}

      <div className="toolbar">
        <label className="search-control">بحث عن أسرة
          <input type="search" role="searchbox" aria-label="بحث عن أسرة" placeholder="اكتب الاسم أو الكود أو رقم التليفون" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-control">نوع الحالة
          <select aria-label="نوع الحالة" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">كل الحالات</option>
            {CASE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {loading ? <p className="empty-state" role="status">جاري تحميل الأسر…</p> : null}
      {!loading && !error && families.length === 0 ? <div className="empty-state"><strong>لسه مفيش أسر مسجلة</strong>{canWrite ? 'ابدأ بإضافة أول أسرة.' : 'لما تتسجل أسر هتظهر هنا.'}</div> : null}
      {!loading && !error && families.length > 0 && matches.length === 0 ? <div className="empty-state"><strong>ملقيناش أسر مطابقة</strong>جرّب كلمة تانية أو غيّر نوع الحالة.</div> : null}
      {!loading && !error && matches.length > 0 ? (
        <>
          <div className="table-caption">الأسر المعروضة: {matches.length}</div>
          <div className="data-table-wrap" ref={tableWrap}>
            <table className="data-table" aria-label="قائمة الأسر">
              <thead><tr><th scope="col">كود الأسرة</th><th scope="col">اسم الأسرة</th><th scope="col">رقم التليفون</th><th scope="col">نوع الحالة</th><th scope="col"><span className="sr-only">فتح الملف</span></th></tr></thead>
              <tbody>{matches.map((family) => (
                <tr key={family.id}>
                  <td><span className="family-code">{family.code}</span></td>
                  <td><Link to={`/families/${family.id}`}>{family.name}</Link></td>
                  <td>{[family.phone,family.phone_2,family.phone_3].filter((phone):phone is string=>!!phone).length ? <span className="family-list-phones">{[family.phone,family.phone_2,family.phone_3].filter((phone):phone is string=>!!phone).map(phone=><bdi dir="ltr" key={phone}>{phone}</bdi>)}</span> : <span className="muted-cell">مش متسجل</span>}</td>
                  <td>{(categoriesByFamily.get(family.id) ?? []).length ? (categoriesByFamily.get(family.id) ?? []).map((item) => <span className="category-label" key={item}>{item}</span>) : <span className="muted-cell">مفيش تصنيف</span>}</td>
                  <td><Link className="table-action" to={`/families/${family.id}`}>فتح الملف</Link></td>
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
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    setBusy(true); setError('');
    try { await addMember(id, name.trim(), relationship.trim()); setName(''); setRelationship(''); await refresh(); }
    catch { setError('تعذّر إضافة الفرد. راجع البيانات وحاول تاني.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="page-card">
      <p><Link to="/families">رجوع لقائمة الأسر</Link></p>
      {loading ? <p role="status">جاري تحميل ملف الأسرة…</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {!loading && !family && !error ? <div className="empty-state"><strong>ملف الأسرة مش موجود</strong><Link to="/families">ارجع لقائمة الأسر</Link></div> : null}
      {family ? <>
        <header className="page-heading family-detail-heading">
          <div><h1>ملف الأسرة</h1><div className="family-summary">
            <div><span className="family-code">{family.code}</span><h2>{family.name}</h2>
              <div className="family-contact-summary">{family.contact_name&&<p>مسؤول الأسرة: {family.contact_name}</p>}{family.contact_age!==null&&<p>السن: {new Intl.NumberFormat('ar-EG').format(family.contact_age)} سنة</p>}{family.national_id&&<p>الرقم القومي: <bdi dir="ltr">{family.national_id}</bdi></p>}</div>
              <div className="family-detail-phones">{[family.phone,family.phone_2,family.phone_3].map((phone,index)=>phone?<p key={index}>رقم التليفون {['١','٢','٣'][index]}: <bdi dir="ltr">{phone}</bdi></p>:null)}{![family.phone,family.phone_2,family.phone_3].some(Boolean)&&<p>مفيش رقم تليفون متسجل</p>}</div>
            </div>
          </div></div>
          {canWrite ? <div className="heading-actions"><button type="button" className="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'إلغاء التعديل' : 'تعديل بيانات الأسرة'}</button><Link className="primary-link" to={`/cases/new?family=${family.id}`}>إضافة حالة</Link></div> : null}
        </header>
        {editing ? <div className="section-block"><FamilyForm family={family} onSaved={() => { setEditing(false); void refresh().catch(() => setError('اتحفظت البيانات، بس تعذّر تحديث الملف.')); }} /></div> : null}
        {family&&<FamilyFilesPanel familyId={family.id} canWrite={canWrite}/>}
        <section className="section-block" aria-labelledby="family-notes-title"><h2 id="family-notes-title">ملاحظات الأسرة</h2><p className="family-notes">{family.notes||'مفيش ملاحظات متسجلة للأسرة.'}</p></section>
        <section className="section-block" aria-labelledby="family-members-title">
          <div className="section-heading"><h2 id="family-members-title">أفراد الأسرة</h2><span>{members.length} أفراد</span></div>
          {members.length ? <ul className="record-list">{members.map((member) => <li key={member.person_id}><strong>{member.people.name}</strong><span className="muted-cell">{member.relationship}</span></li>)}</ul> : <div className="empty-state">لسه مفيش أفراد مضافين للأسرة.</div>}
          {canWrite ? <form className="domain-form member-form" onSubmit={submit}><h3>إضافة فرد للأسرة</h3><div className="form-grid"><label>اسم الفرد<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label><label>صلة القرابة<input required maxLength={100} value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label></div><button disabled={busy || !name.trim() || !relationship.trim()}>{busy ? 'جاري الحفظ…' : 'إضافة فرد'}</button></form> : null}
        </section>
        <section className="section-block" aria-labelledby="family-cases-title">
          <div className="section-heading"><h2 id="family-cases-title">حالات الأسرة</h2><span>{cases.length} حالات</span></div>
          {cases.length ? <ul className="record-list">{cases.map((record) => <li key={record.id}><div className="case-summary"><Link to={`/cases/${record.id}`}>{record.case_categories.map((item) => item.category).join('، ') || 'حالة من غير تصنيف'}</Link><small>{record.notes || 'مفيش ملاحظات'}</small></div><Link className="table-action" to={`/cases/${record.id}`}>فتح الحالة</Link></li>)}</ul> : <div className="empty-state">لسه مفيش حالات مسجلة للأسرة.</div>}
        </section>
      </> : null}
    </section>
  );
}
