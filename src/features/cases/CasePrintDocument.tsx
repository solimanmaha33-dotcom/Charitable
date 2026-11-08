import type { CaseFile, CaseRecord, FamilyProfile, Member } from '../../services/cases';
import { cairoToday } from '../families/idExpiry';
type CasePrintDocumentProps={family:FamilyProfile|null;record:CaseRecord;members:Member[];attachments:CaseFile[]};
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'long'}).format(new Date(`${value}T12:00:00`)) : 'غير مسجل';
const age = (birthDate: string | null) => {
  if (!birthDate) return 'غير مسجل';
  const today = new Date(); const born = new Date(`${birthDate}T12:00:00`);
  let years = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) years--;
  return `${new Intl.NumberFormat('ar-EG').format(years)} سنة`;
};
export function CasePrintDocument({family,record,members,attachments}:CasePrintDocumentProps){
  return <article className="case-print-document" dir="rtl" lang="ar">
    <header className="print-heading"><img src="/brand/maram-logo.png" alt="شعار جمعية مرام الخير"/><div><h1>جمعية مرام الخير</h1><p>نموذج بيانات حالة</p><small>المشهرة برقم 9287 لسنة 2013</small></div><div className="print-date">تاريخ الطباعة<br/>{date(cairoToday())}</div></header>
    <section><h2>بيانات الأسرة</h2><dl><div><dt>كود الأسرة</dt><dd>{family?.code ?? 'غير متاح'}</dd></div><div><dt>اسم الأسرة</dt><dd>{family?.name ?? 'غير متاح'}</dd></div><div><dt>الأب</dt><dd>{family?.father_name || 'غير مسجل'}</dd></div><div><dt>الأم</dt><dd>{family?.mother_name || 'غير مسجل'}</dd></div><div><dt>المسؤول عن التربية</dt><dd>{family?.contact_name || 'غير مسجل'}{family?.contact_relationship ? ` (${family.contact_relationship})` : ''}</dd></div><div><dt>رقم قومي للمسؤول</dt><dd>{family?.national_id || 'غير مسجل'}</dd></div><div><dt>انتهاء البطاقة</dt><dd>{date(family?.national_id_expires_on ?? null)}</dd></div><div><dt>أرقام التليفون</dt><dd>{[family?.phone,family?.phone_2,family?.phone_3].filter(Boolean).join('، ') || 'غير مسجل'}</dd></div></dl></section>
    <section><h2>بيانات الحالة</h2><p><strong>نوع الحالة:</strong> {record.case_categories.map(item=>item.category).join('، ') || 'غير محدد'}</p><p><strong>ملاحظات الحالة:</strong> {record.notes || 'لا توجد ملاحظات'}</p><p><strong>ملاحظات الأسرة:</strong> {family?.notes || 'لا توجد ملاحظات'}</p></section>
    <section><h2>أفراد الأسرة</h2>{members.length ? <table><thead><tr><th>الاسم</th><th>القرابة</th><th>النوع</th><th>السن</th></tr></thead><tbody>{members.map(member=><tr key={member.person_id}><td>{member.people.name}</td><td>{member.relationship}</td><td>{member.people.gender==='female'?'أنثى':member.people.gender==='male'?'ذكر':'غير مسجل'}</td><td>{age(member.people.date_of_birth)}</td></tr>)}</tbody></table> : <p>لا يوجد أفراد مسجلون.</p>}</section>
    <section><h2>المرفقات</h2>{attachments.length ? <ul>{attachments.map(file=><li key={file.id}>{file.file_name}</li>)}</ul> : <p>لا توجد مرفقات.</p>}</section>
    <footer className="print-signatures"><span>توقيع الموظف: __________________</span><span>توقيع المستفيد: __________________</span></footer>
  </article>;
}
