import { useState, type FormEvent } from 'react';
import { saveCaseFile, uploadCaseAttachment, type CaseFile, type CaseFileInput, type CaseFileStatus, type Member } from '../../services/cases';
import { FieldSuggestions } from '../assistant/FieldSuggestions';
import { FilePicker } from '../files/FilePicker';
import { CASE_CATEGORIES, isCaseCategory, type CaseCategory } from './categories';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value: string) {
  return [...value].map((char) => {
    const arabic = arabicDigits.indexOf(char); if (arabic >= 0) return String(arabic);
    const persian = persianDigits.indexOf(char); return persian >= 0 ? String(persian) : char;
  }).join('');
}
const statuses: CaseFileStatus[] = ['نشط', 'موقوف', 'تحت المراجعة', 'مرفوض'];

export function CaseIntakeForm({ onSaved, initial, initialMembers = [] }: { onSaved: (caseFileId: string) => void; initial?: CaseFile; initialMembers?: Member[] }) {
  const [fatherName, setFatherName] = useState(initial?.father_name ?? '');
  const [motherName, setMotherName] = useState(initial?.mother_name ?? '');
  const [guardianName, setGuardianName] = useState(initial?.contact_name ?? '');
  const [guardianRelationship, setGuardianRelationship] = useState(initial?.contact_relationship ?? '');
  const [guardianAge, setGuardianAge] = useState(initial?.contact_age?.toString() ?? '');
  const [nationalId, setNationalId] = useState(initial?.national_id ?? '');
  const [nationalIdExpiresOn, setNationalIdExpiresOn] = useState(initial?.national_id_expires_on ?? '');
  const [phones, setPhones] = useState([initial?.phone ?? '', initial?.phone_2 ?? '', initial?.phone_3 ?? '']);
  const [address, setAddress] = useState(initial?.address ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthly_income?.toString() ?? '');
  const [healthCondition, setHealthCondition] = useState(initial?.health_condition ?? '');
  const [branchArea, setBranchArea] = useState(initial?.branch_area ?? '');
  const [fileStatus, setFileStatus] = useState<CaseFileStatus>(initial?.file_status ?? 'تحت المراجعة');
  const [statusReason, setStatusReason] = useState(initial?.status_reason ?? '');
  const [familyNotes, setFamilyNotes] = useState(initial?.notes ?? '');
  const [categories, setCategories] = useState<CaseCategory[]>(initial?.case_file_categories.map(({ category }) => category).filter(isCaseCategory) ?? []);
  const preservedCategories = initial?.case_file_categories.map(({ category }) => category).filter((category) => !isCaseCategory(category)) ?? [];
  const [files, setFiles] = useState<File[]>([]);
  const [savedFileId, setSavedFileId] = useState(initial?.id ?? null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const householdCount = new Set([fatherName, motherName, ...initialMembers.map((member) => member.people.name)].map((name) => name.trim().toLocaleLowerCase()).filter(Boolean)).size;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!motherName.trim() && !initial) { setError('اسم الأم مطلوب.'); return; }
    if (!categories.length && !preservedCategories.length) { setError('اختار نوع حالة واحد على الأقل.'); return; }
    const normalizedAge = latinDigits(guardianAge.trim());
    const normalizedId = latinDigits(nationalId.trim());
    const normalizedIncome = latinDigits(monthlyIncome.trim()).replaceAll('٬', '').replaceAll(',', '');
    if (normalizedAge && (!/^\d{1,3}$/.test(normalizedAge) || Number(normalizedAge) > 120)) { setError('سن المسؤول لازم يكون من ٠ لحد ١٢٠ سنة.'); return; }
    if (normalizedId && !/^\d{14}$/.test(normalizedId)) { setError('الرقم القومي لازم يكون ١٤ رقم.'); return; }
    if (normalizedIncome && (!/^\d+(\.\d{1,2})?$/.test(normalizedIncome) || Number(normalizedIncome) < 0)) { setError('الدخل الشهري اكتب فيه رقم صحيح من غير سالب.'); return; }
    if ((fileStatus === 'موقوف' || fileStatus === 'مرفوض') && !statusReason.trim()) { setError('اكتب سبب إيقاف أو رفض الملف.'); return; }

    const input: CaseFileInput = {
      fatherName: fatherName.trim(), motherName: motherName.trim(), contactName: guardianName.trim(), contactRelationship: guardianRelationship.trim(),
      contactAge: normalizedAge ? Number(normalizedAge) : null, nationalId: normalizedId, nationalIdExpiresOn,
      phones: phones.map((phone) => phone.trim()), notes: familyNotes.trim(), address: address.trim(),
      monthlyIncome: normalizedIncome ? Number(normalizedIncome) : null, healthCondition: healthCondition.trim(), branchArea: branchArea.trim(),
      fileStatus, statusReason: statusReason.trim(), categories,
    };
    setBusy(true);
    try {
      const id = await saveCaseFile(savedFileId, input);
      setSavedFileId(id);
      for (const file of files) { await uploadCaseAttachment(id, file); setFiles((current) => current.filter((item) => item !== file)); }
      onSaved(id);
    } catch {
      setError('تعذّر حفظ كل البيانات أو المرفقات. البيانات المحفوظة هتفضل موجودة؛ اضغط حفظ تاني لإكمال الباقي.');
    } finally { setBusy(false); }
  }

  return <form className="domain-form case-intake-form" onSubmit={(event) => void submit(event)}>
    <p className="form-help">كل البيانات دي بتتسجل في ملف واحد له كود ثابت. الأب ممكن تسيبه فاضي.</p>
    <section className="form-section">
      <h2>١. نوع الحالة وحالة الملف</h2>
      <fieldset><legend>اختار نوع الحالة</legend>{CASE_CATEGORIES.map((category) => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={(event) => setCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} /> {category}</label>)}{preservedCategories.map((category) => <span className="category-label" key={category}>تصنيف قديم محفوظ: {category}</span>)}</fieldset>
      <div className="form-grid">
        <label>حالة الملف<select value={fileStatus} onChange={(event) => setFileStatus(event.target.value as CaseFileStatus)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        {(fileStatus === 'موقوف' || fileStatus === 'مرفوض') && <label>سبب {fileStatus === 'موقوف' ? 'الإيقاف' : 'الرفض'}<textarea required maxLength={1000} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} /></label>}
      </div>
    </section>
    <section className="form-section">
      <h2>٢. بيانات الأب والأم</h2>
      <p className="form-help">عدد أفراد الأسرة المسجلين حاليًا: {new Intl.NumberFormat('ar-EG').format(householdCount)}. بنحسب اسم الأب والأم مرة واحدة حتى لو كانوا موجودين ضمن الأفراد.</p>
      <div className="form-grid">
        <label>اسم الأب <span className="muted-cell">(اختياري)</span><input maxLength={200} value={fatherName} onChange={(event) => setFatherName(event.target.value)} /></label>
        <label>اسم الأم {!initial && <span className="muted-cell">(مطلوب)</span>}<input required={!initial} maxLength={200} value={motherName} onChange={(event) => setMotherName(event.target.value)} /></label>
      </div>
    </section>
    <section className="form-section">
      <h2>٣. المسؤول عن التربية</h2>
      <div className="form-grid">
        <label>اسم المسؤول<input maxLength={200} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
        <label>صلة القرابة<input maxLength={100} placeholder="مثال: الأم، الجد، الخالة" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} /></label>
        <label>سن المسؤول <span className="muted-cell">(اختياري)</span><input inputMode="numeric" value={guardianAge} onChange={(event) => setGuardianAge(latinDigits(event.target.value))} /></label>
        <label>الرقم القومي <span className="muted-cell">(اختياري)</span><input inputMode="numeric" maxLength={14} value={nationalId} onChange={(event) => setNationalId(latinDigits(event.target.value))} /></label>
        <label>انتهاء البطاقة <span className="muted-cell">(اختياري)</span><input type="date" value={nationalIdExpiresOn} onChange={(event) => setNationalIdExpiresOn(event.target.value)} /></label>
      </div>
    </section>
    <section className="form-section">
      <h2>٤. العنوان والتواصل</h2>
      <label>العنوان<input maxLength={1000} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
      <div className="form-grid">{phones.map((phone, index) => <label key={index}>رقم التليفون {['١', '٢', '٣'][index]} <span className="muted-cell">(اختياري)</span><input type="tel" maxLength={40} value={phone} onChange={(event) => setPhones((current) => current.map((value, item) => item === index ? event.target.value : value))} /></label>)}</div>
      <div className="form-grid">
        <label>الدخل الشهري بالجنيه<input inputMode="decimal" value={monthlyIncome} onChange={(event) => setMonthlyIncome(latinDigits(event.target.value))} /></label>
        <label>الحالة الصحية<textarea maxLength={2000} value={healthCondition} onChange={(event) => setHealthCondition(event.target.value)} /></label>
        <label>الفرع أو المنطقة<input maxLength={200} value={branchArea} onChange={(event) => setBranchArea(event.target.value)} /></label>
      </div>
      <label>ملاحظات الملف<textarea maxLength={4000} value={familyNotes} onChange={(event) => setFamilyNotes(event.target.value)} /></label>
    </section>
    <section className="form-section">
      <h2>٥. صور ومستندات الملف</h2>
      <p className="form-help">ارفع صور أو ملفات PDF؛ راجع النص المستخرج قبل استخدامه.</p>
      <FilePicker files={files} onChange={setFiles} onText={setDraft} />
    </section>
    {draft && <FieldSuggestions text={draft} onApply={(field, value) => {
      if (field === 'notes' && value.trim()) { setFamilyNotes(value); return true; }
      if (field === 'case_categories' && CASE_CATEGORIES.includes(value as CaseCategory)) { setCategories((current) => current.includes(value as CaseCategory) ? current : [...current, value as CaseCategory]); return true; }
      return false;
    }} />}
    <div className="form-actions"><button disabled={busy}>{busy ? 'جاري الحفظ…' : initial ? 'حفظ التعديلات' : 'حفظ ملف الحالة'}</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>;
}
