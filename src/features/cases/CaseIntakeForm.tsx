import { useState, type FormEvent } from 'react';
import { saveCase, saveFamily, uploadCaseFile, type FamilyProfileInput } from '../../services/cases';
import { FieldSuggestions } from '../assistant/FieldSuggestions';
import { FilePicker } from '../files/FilePicker';
import { CASE_CATEGORIES, type CaseCategory } from './categories';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value: string) {
  return [...value].map((char) => {
    const arabic = arabicDigits.indexOf(char);
    if (arabic >= 0) return String(arabic);
    const persian = persianDigits.indexOf(char);
    return persian >= 0 ? String(persian) : char;
  }).join('');
}

export function CaseIntakeForm({ onSaved }: { onSaved: (caseId: string) => void }) {
  const [familyName, setFamilyName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianAge, setGuardianAge] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationalIdExpiresOn, setNationalIdExpiresOn] = useState('');
  const [phones, setPhones] = useState(['', '', '']);
  const [familyNotes, setFamilyNotes] = useState('');
  const [categories, setCategories] = useState<CaseCategory[]>([]);
  const [caseNotes, setCaseNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!categories.length) { setError('اختار نوع حالة واحد على الأقل.'); return; }
    const normalizedAge = latinDigits(guardianAge.trim());
    const normalizedId = latinDigits(nationalId.trim());
    if (normalizedAge && (!/^\d{1,3}$/.test(normalizedAge) || Number(normalizedAge) > 120)) {
      setError('سن المسؤول لازم يكون من ٠ لحد ١٢٠ سنة.'); return;
    }
    if (normalizedId && !/^\d{14}$/.test(normalizedId)) { setError('الرقم القومي لازم يكون ١٤ رقم.'); return; }

    const familyInput: FamilyProfileInput = {
      name: familyName.trim(), fatherName: fatherName.trim(), motherName: motherName.trim(),
      contactName: guardianName.trim(), contactRelationship: guardianRelationship.trim(),
      contactAge: normalizedAge ? Number(normalizedAge) : null, nationalId: normalizedId,
      nationalIdExpiresOn, phones: phones.map((phone) => phone.trim()), notes: familyNotes.trim(),
    };

    setBusy(true);
    try {
      const savedFamilyId = await saveFamily(familyId, familyInput);
      setFamilyId(savedFamilyId);
      const savedCaseId = await saveCase(caseId, savedFamilyId, caseNotes.trim(), categories);
      setCaseId(savedCaseId);
      for (const file of files) {
        await uploadCaseFile(savedCaseId, file);
        setFiles((current) => current.filter((item) => item !== file));
      }
      onSaved(savedCaseId);
    } catch {
      setError('تعذّر حفظ كل البيانات أو المرفقات. بيانات الأسرة التي اتحفظت هتفضل محفوظة؛ اضغط حفظ تاني لإكمال الباقي.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="domain-form case-intake-form" onSubmit={(event) => void submit(event)}>
    <p className="form-help">هتسجل الأسرة والحالة مع بعض في خطوة واحدة.</p>
    <section className="form-section">
      <h2>١. اسم الأسرة ونوع الحالة</h2>
      <label>اسم الأسرة<input required maxLength={200} value={familyName} onChange={(event) => setFamilyName(event.target.value)} /></label>
      <fieldset><legend>اختار نوع الحالة</legend>{CASE_CATEGORIES.map((category) => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={(event) => setCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} /> {category}</label>)}</fieldset>
    </section>

    <section className="form-section">
      <h2>٢. بيانات الأب والأم</h2>
      <div className="form-grid">
        <label>اسم الأب <span className="muted-cell">(اختياري)</span><input maxLength={200} value={fatherName} onChange={(event) => setFatherName(event.target.value)} /></label>
        <label>اسم الأم<input required maxLength={200} value={motherName} onChange={(event) => setMotherName(event.target.value)} /></label>
      </div>
    </section>

    <section className="form-section">
      <h2>٣. المسؤول عن التربية</h2>
      <div className="form-grid">
        <label>اسم المسؤول عن التربية<input required maxLength={200} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
        <label>صلة قرابة المسؤول<input required maxLength={100} placeholder="مثال: الأم، الجد، الخالة" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} /></label>
      </div>
    </section>

    <section className="form-section">
      <h2>٤. باقي بيانات الأسرة</h2>
      <div className="form-grid">
        <label>سن المسؤول <span className="muted-cell">(اختياري)</span><input inputMode="numeric" value={guardianAge} onChange={(event) => setGuardianAge(latinDigits(event.target.value))} /></label>
        <label>الرقم القومي للمسؤول <span className="muted-cell">(اختياري)</span><input inputMode="numeric" maxLength={14} value={nationalId} onChange={(event) => setNationalId(latinDigits(event.target.value))} /></label>
        <label>تاريخ انتهاء البطاقة <span className="muted-cell">(اختياري)</span><input type="date" value={nationalIdExpiresOn} onChange={(event) => setNationalIdExpiresOn(event.target.value)} /></label>
      </div>
      <div className="form-grid">{phones.map((phone, index) => <label key={index}>رقم التليفون {['١', '٢', '٣'][index]} <span className="muted-cell">(اختياري)</span><input type="tel" maxLength={40} value={phone} onChange={(event) => setPhones((current) => current.map((value, item) => item === index ? event.target.value : value))} /></label>)}</div>
      <label>ملاحظات الأسرة <span className="muted-cell">(اختياري)</span><textarea maxLength={4000} value={familyNotes} onChange={(event) => setFamilyNotes(event.target.value)} /></label>
    </section>

    <section className="form-section">
      <h2>٥. ملاحظات الحالة ومرفقاتها</h2>
      <label>ملاحظات الحالة<textarea maxLength={4000} value={caseNotes} onChange={(event) => setCaseNotes(event.target.value)} /></label>
      <p className="form-help">ارفع صور أو ملفات PDF؛ راجع النص المستخرج قبل استخدامه.</p>
      <FilePicker files={files} onChange={setFiles} onText={setDraft} />
    </section>
    {draft && <FieldSuggestions text={draft} onApply={(field, value) => {
      if (field === 'notes' && value.trim()) { setCaseNotes(value); return true; }
      if (field === 'case_categories' && CASE_CATEGORIES.includes(value as CaseCategory)) { setCategories((current) => current.includes(value as CaseCategory) ? current : [...current, value as CaseCategory]); return true; }
      return false;
    }} />}
    <div className="form-actions"><button disabled={busy || !familyName.trim()}>{busy ? 'جاري الحفظ…' : 'حفظ ملف الأسرة والحالة'}</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>;
}
