import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { archiveCaseFile, findCaseFileForLegacyId, getCaseFile, listCaseAttachments, listCaseFileHistory, listMembers, type CaseAttachment, type CaseFile, type CaseFileHistory, type Member } from '../../services/cases';
import { CaseAttachmentsPanel } from './CaseAttachmentsPanel';
import { CaseMemberForm } from './CaseMemberForm';
import { ageOn } from './memberAge';
import { cairoToday } from './idExpiry';
import { CasePrintDocument } from './CasePrintDocument';
import { CaseIntakeForm } from './CaseIntakeForm';
import { CaseDisbursementsPanel } from './CaseDisbursementsPanel';
import { listCaseDisbursements, type CaseDisbursement } from '../../services/disbursements';

const formatCount = new Intl.NumberFormat('ar-EG').format;
const statusClass = { 'نشط':'case-status-active','موقوف':'case-status-hold','تحت المراجعة':'case-status-review','مرفوض':'case-status-rejected' };
function householdCount(file: CaseFile, members: Member[]) {
  const widow=file.case_file_categories.some(({category})=>category==='أرملة');
  const names = new Set([...(widow?[]:[file.father_name]),file.mother_name, ...members.map((member) => member.people.name)].map((name) => name?.trim().toLocaleLowerCase()).filter(Boolean));
  return names.size;
}

export function CaseDetailsPage({ canWrite, canArchive=false }: { canWrite: boolean; canArchive?:boolean }) {
  const { id } = useParams(); const navigate = useNavigate(); const [searchParams] = useSearchParams();
  const matchedMember = searchParams.get('matchedMember');
  const contactMatch = searchParams.get('matchedContact');
  const matchedContact = contactMatch === 'father' || contactMatch === 'mother' ? contactMatch : null;
  const [file, setFile] = useState<CaseFile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [history, setHistory] = useState<CaseFileHistory[]>([]);
  const [disbursements,setDisbursements]=useState<CaseDisbursement[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState(id === 'new'); const [addingMember, setAddingMember] = useState(false);const [showMembers,setShowMembers]=useState(false);const [editingMemberId,setEditingMemberId]=useState<string|null>(null); const [confirmArchive,setConfirmArchive]=useState(false);const [archiving,setArchiving]=useState(false);
  const today = cairoToday();
  const widow=file?.case_file_categories.some(({category})=>category==='أرملة')??false;
  const hideGuardian=file?.case_file_categories.some(({category})=>['أرملة','مطلقة','هجر'].includes(category))??false;
  const showFatherStatus=file?.case_file_categories.some(({category})=>category==='أخرى')??false;

  async function refresh(caseFileId = id) {
    if (!caseFileId || caseFileId === 'new') return;
    const found = await getCaseFile(caseFileId);
    if (!found) {
      const canonicalId = await findCaseFileForLegacyId(caseFileId);
      if (canonicalId) { navigate(`/cases/${canonicalId}`, { replace: true }); return; }
      setFile(null); return;
    }
    const [people, files, oldRecords,aidRecords] = await Promise.all([listMembers(found.id), listCaseAttachments(found.id), listCaseFileHistory(found.id),listCaseDisbursements(found.id)]);
    setFile(found); setMembers(people); setAttachments(files); setHistory(oldRecords);setDisbursements(aidRecords);
  }
  async function confirmArchiveCase() {
    if(!id||id==='new')return;
    setArchiving(true);setError('');
    try {await archiveCaseFile(id);navigate('/cases',{replace:true});}
    catch {setError('ماعرفناش نأرشف الحالة. حاول تاني أو راجع صلاحيتك.');}
    finally {setArchiving(false);}
  }
  useEffect(() => {
    let alive = true; setLoading(true); setError(''); setEditing(id === 'new');
    void refresh().catch(() => { if (alive) setError('ماعرفناش نحمّل ملف الحالة. حدّث الصفحة وجرب تاني.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const target = matchedContact ? `contact-${matchedContact}` : matchedMember ? `member-${matchedMember}` : null;
    if (!target) return;
    if(matchedMember&&!showMembers){setShowMembers(true);return;}
    document.getElementById(target)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [matchedContact, matchedMember, members,showMembers]);

  if (!id) return <section className="page-card"><h1>افتح ملف الحالة من القائمة</h1><Link to="/cases">قائمة الحالات</Link></section>;
  if (id === 'new') return <section className="page-card">
    <p><Link to="/cases">رجوع لقائمة الحالات</Link></p><header className="page-heading"><div><h1>إضافة حالة جديدة</h1><p>سجّل بيانات الأسرة في ملف حالة واحد.</p></div></header>
    {!canWrite ? <p className="error-message">معندكش صلاحية لإضافة حالة.</p> : <CaseIntakeForm onSaved={(caseFileId) => navigate(`/cases/${caseFileId}`)} />}
  </section>;

  return <section className="page-card">
    <p><Link to="/cases">رجوع لقائمة الحالات</Link></p>
    {loading && <p role="status">بنحمّل ملف الحالة…</p>}{error && <p className="error-message" role="alert">{error}</p>}
    {!loading && !error && !file && <div className="empty-state"><strong>ملف الحالة مش موجود</strong><Link to="/cases">ارجع لقائمة الحالات</Link></div>}
    {file && <>
      <header className="page-heading"><div><h1>ملف الحالة <span className="family-code">{file.code}</span></h1><p>{[!widow&&file.father_name && `الأب: ${file.father_name}`, file.mother_name && `الأم: ${file.mother_name}`].filter(Boolean).join(' · ') || 'الأسماء مش متسجلة'}</p>
        <p><span className={`status-label case-file-status ${statusClass[file.file_status]}`}>{file.file_status}</span>{file.status_reason && ` — ${file.status_reason}`}</p></div>
        {!editing && <div className="heading-actions"><button type="button" className="secondary" onClick={() => window.print()}>طباعة الحالة</button>{canWrite && <button type="button" className="secondary" onClick={() => setEditing(true)}>تعديل الملف</button>}{canArchive&&<button type="button" className="danger" onClick={()=>setConfirmArchive(true)}>حذف الحالة</button>}</div>}
      </header>
      {confirmArchive&&<div className="archive-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="archive-confirmation-title">
        <h2 id="archive-confirmation-title">أرشفة الحالة {file.code}؟</h2>
        <p>ملف الحالة وأفراده ومرفقاته والكفالات هيفضلوا محفوظين. الحالة هتختفي من القوائم اليومية، والمدير العام يقدر يسترجعها من «الحالات المؤرشفة».</p>
        <div className="form-actions"><button type="button" className="danger" disabled={archiving} onClick={()=>void confirmArchiveCase()}>{archiving?'جاري الأرشفة…':'تأكيد الأرشفة'}</button><button type="button" className="secondary" disabled={archiving} onClick={()=>setConfirmArchive(false)}>إلغاء</button></div>
      </div>}
      {editing && canWrite ? <CaseIntakeForm initial={file} initialMembers={members} onSaved={async (savedId) => { setEditing(false); try { await refresh(savedId); } catch { setError('اتحفظ الملف بس ماعرفناش نحدّث العرض. حدّث الصفحة وجرب تاني.'); } }} /> : <>
        <section className="section-block"><h2>بيانات الملف</h2><dl className="profile-details">
          <div><dt>أنواع الحالة</dt><dd>{file.case_file_categories.map((item) => item.category).join('، ') || 'مش متحدد'}</dd></div>
          <div><dt>ميعاد إعادة البحث</dt><dd>{file.next_review_date ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(`${file.next_review_date}T12:00:00`)) : 'مش متحدد'}</dd></div>
          <div><dt>العنوان</dt><dd>{file.address || 'مش متسجل'}</dd></div>
          <div><dt>الدخل الشهري</dt><dd>{file.monthly_income === null ? 'مش متسجل' : `${new Intl.NumberFormat('ar-EG').format(file.monthly_income)} جنيه`}</dd></div>
          {!widow&&<div id="contact-father" className={matchedContact === 'father' ? 'matched-member' : undefined}><dt>بيانات الأب</dt><dd>{file.father_name || 'مش متسجل'} — الرقم القومي: <bdi dir="ltr">{file.father_national_id || 'مش متسجل'}</bdi> · انتهاء البطاقة: {file.father_national_id_expires_on ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(`${file.father_national_id_expires_on}T12:00:00`)) : 'مش متسجل'}{matchedContact === 'father' && <span className="member-match-label">مطابقة البحث</span>}</dd></div>}
          <div id="contact-mother" className={matchedContact === 'mother' ? 'matched-member' : undefined}><dt>بيانات الأم</dt><dd>{file.mother_name || 'مش متسجل'} — الرقم القومي: <bdi dir="ltr">{file.mother_national_id || 'مش متسجل'}</bdi> · انتهاء البطاقة: {file.mother_national_id_expires_on ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(`${file.mother_national_id_expires_on}T12:00:00`)) : 'مش متسجل'}{matchedContact === 'mother' && <span className="member-match-label">مطابقة البحث</span>}</dd></div>
          {!widow&&<div><dt>الحالة الصحية للأب</dt><dd>{[file.father_health_status,file.father_health_condition].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>}
          <div><dt>الحالة الصحية للأم</dt><dd>{[file.mother_health_status,file.mother_health_condition].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          {!widow&&<div><dt>حالة عمل الأب</dt><dd>{[file.father_employment_status,file.father_occupation].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>}
          <div><dt>حالة عمل الأم</dt><dd>{[file.mother_employment_status,file.mother_occupation].filter(Boolean).join(' — ') || 'مش متسجل'}</dd></div>
          <div><dt>الفرع أو المنطقة</dt><dd>{file.branch_area || 'مش متسجل'}</dd></div>
          <div><dt>عدد أفراد الأسرة</dt><dd>{formatCount(householdCount(file, members))}</dd></div>
          {!hideGuardian&&<div><dt>المسؤول عن التربية</dt><dd>{file.contact_name || 'مش متسجل'}{file.contact_relationship ? ` — ${file.contact_relationship}` : ''}</dd></div>}
          <div><dt>رقم الموبايل 1</dt><dd>{file.phone || 'مش متسجل'}</dd></div>
          <div><dt>رقم الموبايل 2</dt><dd>{file.phone_2 || 'مش متسجل'}</dd></div>
          <div><dt>رقم المنزل</dt><dd>{file.phone_3 || 'مش متسجل'}</dd></div>
          <div><dt>ملاحظات الملف</dt><dd>{file.notes || 'مفيش ملاحظات'}</dd></div>
        </dl></section>
        <section className="section-block" aria-labelledby="case-members-title"><div className="section-heading"><h2 id="case-members-title">أفراد الأسرة</h2><span>{formatCount(members.length)} أفراد مسجلين</span></div>
          <button className="secondary" type="button" aria-expanded={showMembers} onClick={()=>setShowMembers(value=>!value)}>{showMembers?'إخفاء أفراد الأسرة':'عرض أفراد الأسرة'}</button>
          {showMembers&&(members.length ? <ul className="record-list">{members.map((member) => {const matched=matchedMember===member.person_id;return <li key={member.person_id} id={`member-${member.person_id}`} className={matched?'matched-member':undefined} tabIndex={matched? -1:undefined}><div><strong>{member.people.name}</strong>{matched&&<span className="member-match-label">مطابقة البحث</span>}<small>{member.relationship}{member.people.gender ? ` · ${member.people.gender === 'female' ? 'بنت' : 'ولد'}` : ''}{member.people.date_of_birth ? ` · العمر: ${formatCount(ageOn(member.people.date_of_birth, today))} سنة` : ''}</small>{member.father_status&&<small>حالة الأب: {member.father_status}</small>}{(member.people.health_status||member.people.health_details||member.people.health_condition)&&<small>الحالة الصحية: {[member.people.health_status,member.people.health_details||member.people.health_condition].filter(Boolean).join(' — ')}</small>}{member.people.employment_status&&<small>حالة العمل: {[member.people.employment_status,member.people.employment_status==='يعمل'?member.people.occupation:null].filter(Boolean).join(' — ')}</small>}{canWrite&&<button type="button" className="secondary member-edit-button" onClick={()=>{setEditingMemberId(editingMemberId===member.person_id?null:member.person_id);setAddingMember(false);}}>{editingMemberId===member.person_id?'إلغاء التعديل':'تعديل بيانات الفرد'}</button>}{editingMemberId===member.person_id&&<CaseMemberForm caseFileId={file.id} member={member} showFatherStatus={showFatherStatus} onAdded={async()=>{setEditingMemberId(null);await refresh(file.id);}}/>}</div></li>})}</ul> : <div className="empty-state">لسه مفيش أفراد مضافين للملف.</div>)}
          {canWrite && <><button className="secondary" type="button" onClick={() => {setAddingMember((value) => !value);setEditingMemberId(null);}}>{addingMember ? 'إلغاء' : 'إضافة فرد للأسرة'}</button>{addingMember && <CaseMemberForm caseFileId={file.id} showFatherStatus={showFatherStatus} onAdded={async () => { setAddingMember(false); await refresh(file.id); }} />}</>}
        </section>
        <CaseDisbursementsPanel caseFile={file} records={disbursements} canWrite={canWrite} onChanged={()=>refresh(file.id)} />
        <CaseAttachmentsPanel caseFile={file} canWrite={canWrite} onCaseFileUpdated={() => { void refresh(file.id); }} />
        <section className="section-block"><h2>ملاحظات الحالة القديمة</h2>{history.length ? <ul className="record-list">{history.map((item) => <li key={item.id}><div><strong>{item.notes || 'مفيش ملاحظات'}</strong><small><time dateTime={item.created_at}>{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(item.created_at))}</time></small></div></li>)}</ul> : <p>مفيش ملاحظات قديمة محفوظة.</p>}</section>
        <CasePrintDocument caseFile={file} members={members} attachments={attachments} disbursements={disbursements} />
      </>}
    </>}
  </section>;
}
