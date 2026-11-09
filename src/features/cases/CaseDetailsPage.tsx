import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { archiveCaseFile, findCaseFileForLegacyId, getCaseFile, listCaseAttachments, listCaseFileHistory, listMembers, type CaseAttachment, type CaseFile, type CaseFileHistory, type Member } from '../../services/cases';
import { CaseAttachmentsPanel } from './CaseAttachmentsPanel';
import { CaseMemberForm } from './CaseMemberForm';
import { ageOn } from './memberAge';
import { cairoToday } from './idExpiry';
import { CasePrintDocument } from './CasePrintDocument';
import { CaseIntakeForm } from './CaseIntakeForm';

const formatCount = new Intl.NumberFormat('ar-EG').format;
const statusClass = { 'نشط':'case-status-active','موقوف':'case-status-hold','تحت المراجعة':'case-status-review','مرفوض':'case-status-rejected' };
function householdCount(file: CaseFile, members: Member[]) {
  const names = new Set([file.father_name, file.mother_name, ...members.map((member) => member.people.name)].map((name) => name?.trim().toLocaleLowerCase()).filter(Boolean));
  return names.size;
}

export function CaseDetailsPage({ canWrite, canArchive=false }: { canWrite: boolean; canArchive?:boolean }) {
  const { id } = useParams(); const navigate = useNavigate();
  const [file, setFile] = useState<CaseFile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [history, setHistory] = useState<CaseFileHistory[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState(id === 'new'); const [addingMember, setAddingMember] = useState(false); const [confirmArchive,setConfirmArchive]=useState(false);const [archiving,setArchiving]=useState(false);
  const today = cairoToday();

  async function refresh(caseFileId = id) {
    if (!caseFileId || caseFileId === 'new') return;
    const found = await getCaseFile(caseFileId);
    if (!found) {
      const canonicalId = await findCaseFileForLegacyId(caseFileId);
      if (canonicalId) { navigate(`/cases/${canonicalId}`, { replace: true }); return; }
      setFile(null); return;
    }
    const [people, files, oldRecords] = await Promise.all([listMembers(found.id), listCaseAttachments(found.id), listCaseFileHistory(found.id)]);
    setFile(found); setMembers(people); setAttachments(files); setHistory(oldRecords);
  }
  async function confirmArchiveCase() {
    if(!id||id==='new')return;
    setArchiving(true);setError('');
    try {await archiveCaseFile(id);navigate('/cases',{replace:true});}
    catch {setError('تعذّرت أرشفة الحالة. حاول تاني أو راجع صلاحيتك.');}
    finally {setArchiving(false);}
  }
  useEffect(() => {
    let alive = true; setLoading(true); setError(''); setEditing(id === 'new');
    void refresh().catch(() => { if (alive) setError('تعذّر تحميل ملف الحالة. حاول تحدّث الصفحة.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (!id) return <section className="page-card"><h1>افتح ملف الحالة من القائمة</h1><Link to="/cases">قائمة الحالات</Link></section>;
  if (id === 'new') return <section className="page-card">
    <p><Link to="/cases">رجوع لقائمة الحالات</Link></p><header className="page-heading"><div><h1>إضافة حالة جديدة</h1><p>سجّل الأسرة والحالة في ملف واحد.</p></div></header>
    {!canWrite ? <p className="error-message">معندكش صلاحية لإضافة حالة.</p> : <CaseIntakeForm onSaved={(caseFileId) => navigate(`/cases/${caseFileId}`)} />}
  </section>;

  return <section className="page-card">
    <p><Link to="/cases">رجوع لقائمة الحالات</Link></p>
    {loading && <p role="status">جاري تحميل ملف الحالة…</p>}{error && <p className="error-message" role="alert">{error}</p>}
    {!loading && !error && !file && <div className="empty-state"><strong>ملف الحالة مش موجود</strong><Link to="/cases">ارجع لقائمة الحالات</Link></div>}
    {file && <>
      <header className="page-heading"><div><h1>ملف الحالة <span className="family-code">{file.code}</span></h1><p>{[file.father_name && `الأب: ${file.father_name}`, file.mother_name && `الأم: ${file.mother_name}`].filter(Boolean).join(' · ') || 'الأسماء مش متسجلة'}</p>
        <p><span className={`status-label case-file-status ${statusClass[file.file_status]}`}>{file.file_status}</span>{file.status_reason && ` — ${file.status_reason}`}</p></div>
        {!editing && <div className="heading-actions"><button type="button" className="secondary" onClick={() => window.print()}>طباعة الحالة</button>{canWrite && <button type="button" className="secondary" onClick={() => setEditing(true)}>تعديل الملف</button>}{canArchive&&<button type="button" className="danger" onClick={()=>setConfirmArchive(true)}>حذف الحالة</button>}</div>}
      </header>
      {confirmArchive&&<div className="archive-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="archive-confirmation-title">
        <h2 id="archive-confirmation-title">أرشفة الحالة {file.code}؟</h2>
        <p>ملف الحالة وأفراده ومرفقاته والكفالات هيفضلوا محفوظين. الحالة هتختفي من القوائم اليومية، والمدير العام يقدر يسترجعها من «الحالات المؤرشفة».</p>
        <div className="form-actions"><button type="button" className="danger" disabled={archiving} onClick={()=>void confirmArchiveCase()}>{archiving?'جاري الأرشفة…':'تأكيد الأرشفة'}</button><button type="button" className="secondary" disabled={archiving} onClick={()=>setConfirmArchive(false)}>إلغاء</button></div>
      </div>}
      {editing && canWrite ? <CaseIntakeForm initial={file} initialMembers={members} onSaved={async (savedId) => { setEditing(false); try { await refresh(savedId); } catch { setError('اتحفظ الملف بس تعذّر تحديث العرض.'); } }} /> : <>
        <section className="section-block"><h2>بيانات الملف</h2><dl className="profile-details">
          <div><dt>أنواع الحالة</dt><dd>{file.case_file_categories.map((item) => item.category).join('، ') || 'غير محدد'}</dd></div>
          <div><dt>العنوان</dt><dd>{file.address || 'مش متسجل'}</dd></div>
          <div><dt>الدخل الشهري</dt><dd>{file.monthly_income === null ? 'مش متسجل' : `${new Intl.NumberFormat('ar-EG').format(file.monthly_income)} جنيه`}</dd></div>
          <div><dt>الرقم القومي للأب</dt><dd>{file.father_national_id || 'مش متسجل'}</dd></div>
          <div><dt>الرقم القومي للأم</dt><dd>{file.mother_national_id || 'مش متسجل'}</dd></div>
          <div><dt>الحالة الصحية للأب</dt><dd>{[file.father_health_status,file.father_health_condition].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          <div><dt>الحالة الصحية للأم</dt><dd>{[file.mother_health_status,file.mother_health_condition].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          <div><dt>الحالة الصحية العامة للأسرة</dt><dd>{file.health_condition || 'مش متسجل'}</dd></div>
          <div><dt>حالة عمل الأب</dt><dd>{[file.father_employment_status,file.father_occupation].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          <div><dt>حالة عمل الأم</dt><dd>{[file.mother_employment_status,file.mother_occupation].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          <div><dt>الفرع أو المنطقة</dt><dd>{file.branch_area || 'مش متسجل'}</dd></div>
          <div><dt>عدد أفراد الأسرة</dt><dd>{formatCount(householdCount(file, members))}</dd></div>
          <div><dt>المسؤول عن التربية</dt><dd>{file.contact_name || 'مش متسجل'}{file.contact_relationship ? ` — ${file.contact_relationship}` : ''}</dd></div>
          <div><dt>رقم الموبايل 1</dt><dd>{file.phone || 'مش متسجل'}</dd></div>
          <div><dt>رقم الموبايل 2</dt><dd>{file.phone_2 || 'مش متسجل'}</dd></div>
          <div><dt>رقم المنزل</dt><dd>{file.phone_3 || 'مش متسجل'}</dd></div>
          <div><dt>ملاحظات الملف</dt><dd>{file.notes || 'مفيش ملاحظات'}</dd></div>
        </dl></section>
        <section className="section-block" aria-labelledby="case-members-title"><div className="section-heading"><h2 id="case-members-title">أفراد الأسرة</h2><span>{formatCount(members.length)} أفراد مسجلين</span></div>
          {members.length ? <ul className="record-list">{members.map((member) => <li key={member.person_id}><div><strong>{member.people.name}</strong><small>{member.relationship}{member.people.gender ? ` · ${member.people.gender === 'female' ? 'بنت' : 'ولد'}` : ''}{member.people.date_of_birth ? ` · العمر: ${formatCount(ageOn(member.people.date_of_birth, today))} سنة` : ''}</small>{(member.people.health_status||member.people.health_details||member.people.health_condition)&&<small>الحالة الصحية: {[member.people.health_status,member.people.health_details||member.people.health_condition].filter(Boolean).join(' — ')}</small>}{member.people.employment_status&&<small>حالة العمل: {[member.people.employment_status,member.people.employment_status==='يعمل'?member.people.occupation:null].filter(Boolean).join(' — ')}</small>}</div></li>)}</ul> : <div className="empty-state">لسه مفيش أفراد مضافين للملف.</div>}
          {canWrite && <><button className="secondary" type="button" onClick={() => setAddingMember((value) => !value)}>{addingMember ? 'إلغاء' : 'إضافة فرد للأسرة'}</button>{addingMember && <CaseMemberForm caseFileId={file.id} onAdded={async () => { setAddingMember(false); await refresh(file.id); }} />}</>}
        </section>
        <CaseAttachmentsPanel caseFile={file} canWrite={canWrite} onCaseFileUpdated={() => { void refresh(file.id); }} />
        <section className="section-block"><h2>ملاحظات الحالة القديمة</h2>{history.length ? <ul className="record-list">{history.map((item) => <li key={item.id}><div><strong>{item.notes || 'مفيش ملاحظات'}</strong><small><time dateTime={item.created_at}>{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(item.created_at))}</time></small></div></li>)}</ul> : <p>مفيش ملاحظات قديمة محفوظة.</p>}</section>
        <CasePrintDocument caseFile={file} members={members} attachments={attachments} />
      </>}
    </>}
  </section>;
}
