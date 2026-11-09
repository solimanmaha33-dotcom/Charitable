import type { CaseAttachment, CaseFile, Member } from '../../services/cases';
import { cairoToday } from './idExpiry';
import { ageOn } from './memberAge';
import type { CaseDisbursement } from '../../services/disbursements';
type CasePrintDocumentProps = { caseFile: CaseFile; members: Member[]; attachments: CaseAttachment[]; disbursements?:CaseDisbursement[] };
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`)) : 'غير مسجل';
const age = (birthDate: string | null) => birthDate ? `${new Intl.NumberFormat('ar-EG').format(ageOn(birthDate,cairoToday()))} سنة` : 'غير مسجل';
const nationalId = (value: string | null | undefined) => value ? new Intl.NumberFormat('ar-EG',{useGrouping:false}).format(Number(value)) : 'غير مسجل';
function countHousehold(caseFile: CaseFile, members: Member[]) {
  return new Set([caseFile.father_name, caseFile.mother_name, ...members.map((member) => member.people.name)].map((name) => name?.trim().toLocaleLowerCase()).filter(Boolean)).size;
}
export function CasePrintDocument({ caseFile, members, attachments,disbursements=[] }: CasePrintDocumentProps) {
  return <article className="case-print-document" dir="rtl" lang="ar">
    <header className="print-heading"><img src="/brand/maram-logo.png" alt="شعار جمعية مرام الخير"/><div><h1>جمعية مرام الخير</h1><p>نموذج بيانات حالة</p><small>المشهرة برقم 9287 لسنة 2013</small></div><div className="print-date">تاريخ الطباعة<br/>{date(cairoToday())}</div></header>
    <section><h2>بيانات الملف</h2><dl>
      <div><dt>كود الحالة</dt><dd>{caseFile.code}</dd></div><div><dt>الأب</dt><dd>{caseFile.father_name || 'غير مسجل'}</dd></div><div><dt>الأم</dt><dd>{caseFile.mother_name || 'غير مسجل'}</dd></div>
      <div><dt>نوع الحالة</dt><dd>{caseFile.case_file_categories.map((item) => item.category).join('، ') || 'غير محدد'}</dd></div>
      <div><dt>حالة الملف</dt><dd>{caseFile.file_status}{caseFile.status_reason ? ` — ${caseFile.status_reason}` : ''}</dd></div>
      <div><dt>ميعاد إعادة البحث</dt><dd>{date(caseFile.next_review_date??null)}</dd></div>
      <div><dt>العنوان</dt><dd>{caseFile.address || 'غير مسجل'}</dd></div><div><dt>الدخل الشهري</dt><dd>{caseFile.monthly_income === null ? 'غير مسجل' : `${new Intl.NumberFormat('ar-EG').format(caseFile.monthly_income)} جنيه`}</dd></div>
      <div><dt>الرقم القومي للأب</dt><dd>{nationalId(caseFile.father_national_id)}</dd></div><div><dt>الرقم القومي للأم</dt><dd>{nationalId(caseFile.mother_national_id)}</dd></div>
      <div><dt>الحالة الصحية للأب</dt><dd>{[caseFile.father_health_status,caseFile.father_health_condition].filter(Boolean).join(' — ') || 'غير مسجل'}</dd></div><div><dt>الحالة الصحية للأم</dt><dd>{[caseFile.mother_health_status,caseFile.mother_health_condition].filter(Boolean).join(' — ') || 'غير مسجل'}</dd></div>
      <div><dt>حالة عمل الأب</dt><dd>{[caseFile.father_employment_status,caseFile.father_occupation].filter(Boolean).join(' — ') || 'غير مسجل'}</dd></div><div><dt>حالة عمل الأم</dt><dd>{[caseFile.mother_employment_status,caseFile.mother_occupation].filter(Boolean).join(' — ') || 'غير مسجل'}</dd></div>
      <div><dt>الحالة الصحية العامة للأسرة</dt><dd>{caseFile.health_condition || 'غير مسجل'}</dd></div><div><dt>الفرع أو المنطقة</dt><dd>{caseFile.branch_area || 'غير مسجل'}</dd></div>
      <div><dt>عدد أفراد الأسرة</dt><dd>{new Intl.NumberFormat('ar-EG').format(countHousehold(caseFile, members))}</dd></div>
      <div><dt>المسؤول عن التربية</dt><dd>{caseFile.contact_name || 'غير مسجل'}{caseFile.contact_relationship ? ` (${caseFile.contact_relationship})` : ''}</dd></div>
      <div><dt>الرقم القومي للمسؤول</dt><dd>{caseFile.national_id || 'غير مسجل'}</dd></div><div><dt>انتهاء البطاقة</dt><dd>{date(caseFile.national_id_expires_on)}</dd></div>
      <div><dt>رقم الموبايل 1</dt><dd>{caseFile.phone || 'غير مسجل'}</dd></div>
      <div><dt>رقم الموبايل 2</dt><dd>{caseFile.phone_2 || 'غير مسجل'}</dd></div>
      <div><dt>رقم المنزل</dt><dd>{caseFile.phone_3 || 'غير مسجل'}</dd></div>
    </dl></section>
    <section><h2>ملاحظات الملف</h2><p>{caseFile.notes || 'لا توجد ملاحظات'}</p></section>
    <section><h2>أفراد الأسرة</h2>{members.length ? <table><thead><tr><th>الاسم</th><th>القرابة</th><th>النوع</th><th>السن</th><th>الحالة الصحية</th><th>حالة العمل</th></tr></thead><tbody>{members.map((member) => <tr key={member.person_id}><td>{member.people.name}</td><td>{member.relationship}</td><td>{member.people.gender === 'female' ? 'أنثى' : member.people.gender === 'male' ? 'ذكر' : 'غير مسجل'}</td><td>{age(member.people.date_of_birth)}</td><td>{[member.people.health_status,member.people.health_details||member.people.health_condition].filter(Boolean).join(' — ') || 'غير مسجل'}</td><td>{[member.people.employment_status,member.people.employment_status==='يعمل'?member.people.occupation:null].filter(Boolean).join(' — ') || 'غير مسجل'}</td></tr>)}</tbody></table> : <p>لا يوجد أفراد مسجلون.</p>}</section>
    <section><h2>المساعدات المنصرفة</h2>{disbursements.length?<table><thead><tr><th>نوع المساعدة</th><th>التاريخ</th><th>القيمة</th><th>الحالة / ملاحظات</th></tr></thead><tbody>{disbursements.map(item=><tr key={item.id}><td>{item.disbursement_type}{item.items_summary?` — ${item.items_summary}`:''}</td><td>{date(item.disbursed_on)}</td><td>{new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(item.amount)} جنيه</td><td>{item.is_voided?`ملغي — ${item.void_reason}`:item.notes||'منصرفة'}</td></tr>)}</tbody></table>:<p>لا توجد مساعدات منصرفة مسجلة.</p>}</section>
    <section><h2>المرفقات</h2>{attachments.length ? <ul>{attachments.map((file) => <li key={file.id}>{file.file_name}</li>)}</ul> : <p>لا توجد مرفقات.</p>}</section>
    <footer className="print-signatures"><span>توقيع الموظف: __________________</span><span>توقيع المستفيد: __________________</span><div className="association-stamp">مكان ختم الجمعية</div></footer>
  </article>;
}
