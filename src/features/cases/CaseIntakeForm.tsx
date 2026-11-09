import { useEffect, useRef, useState, type FormEvent } from 'react';
import { saveCaseFile, uploadCaseAttachment, type CaseFile, type CaseFileInput, type CaseFileStatus, type EmploymentStatus, type Member } from '../../services/cases';
import { addBranch, deactivateBranch as deactivateCaseBranch, listBranches, listInactiveBranches, reactivateBranch as reactivateCaseBranch, type CaseBranch } from '../../services/branches';
import { FieldSuggestions } from '../assistant/FieldSuggestions';
import { FilePicker } from '../files/FilePicker';
import { CASE_CATEGORIES, hasConflictingCaseCategories, isCaseCategory, updateCaseCategorySelection, type CaseCategory } from './categories';
import { HEALTH_STATUSES, type HealthStatus } from './healthStatus';
import { normalizeEgyptianNationalIdInput, parseEgyptianNationalId, parseNationalIdScan } from './nationalIdScan';
import { ageOn } from './memberAge';
import { cairoToday } from './idExpiry';
import { calculatePerCapitaNetIncome } from './caseMetrics';
import type { MemberGender } from './memberDemographics';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value: string) {
  return [...value].map((char) => {
    const arabic = arabicDigits.indexOf(char); if (arabic >= 0) return String(arabic);
    const persian = persianDigits.indexOf(char); return persian >= 0 ? String(persian) : char;
  }).join('');
}
function digitsOnly(value: string) { return latinDigits(value).replace(/\D/g, ''); }
const statuses: CaseFileStatus[] = ['نشط', 'موقوف', 'تحت المراجعة', 'مرفوض'];
const employmentOptions = ['يعمل', 'لا يعمل', 'طفل', 'طفلة'];

export function CaseIntakeForm({ onSaved, initial, initialMembers = [] }: { onSaved: (caseFileId: string) => void; initial?: CaseFile; initialMembers?: Member[] }) {
  const [fatherName, setFatherName] = useState(initial?.father_name ?? '');
  const [motherName, setMotherName] = useState(initial?.mother_name ?? '');
  const [fatherNationalId, setFatherNationalId] = useState(initial?.father_national_id ?? '');
  const [motherNationalId, setMotherNationalId] = useState(initial?.mother_national_id ?? '');
  const [fatherDateOfBirth, setFatherDateOfBirth] = useState(initial?.father_date_of_birth ?? '');
  const [fatherGender, setFatherGender] = useState<MemberGender | null>(initial?.father_gender ?? null);
  const [motherDateOfBirth, setMotherDateOfBirth] = useState(initial?.mother_date_of_birth ?? '');
  const [motherGender, setMotherGender] = useState<MemberGender | null>(initial?.mother_gender ?? null);
  const [fatherHealthCondition, setFatherHealthCondition] = useState(initial?.father_health_condition ?? '');
  const [motherHealthCondition, setMotherHealthCondition] = useState(initial?.mother_health_condition ?? '');
  const [fatherHealthStatus, setFatherHealthStatus] = useState<HealthStatus | ''>(initial?.father_health_status ?? '');
  const [motherHealthStatus, setMotherHealthStatus] = useState<HealthStatus | ''>(initial?.mother_health_status ?? '');
  const [fatherEmploymentStatus, setFatherEmploymentStatus] = useState<EmploymentStatus|null>(initial?.father_employment_status ?? null);
  const [motherEmploymentStatus, setMotherEmploymentStatus] = useState<EmploymentStatus|null>(initial?.mother_employment_status ?? null);
  const [fatherOccupation, setFatherOccupation] = useState(initial?.father_occupation ?? '');
  const [motherOccupation, setMotherOccupation] = useState(initial?.mother_occupation ?? '');
  const [guardianName, setGuardianName] = useState(initial?.contact_name ?? '');
  const [guardianRelationship, setGuardianRelationship] = useState(initial?.contact_relationship ?? '');
  const [guardianAge, setGuardianAge] = useState(initial?.contact_age?.toString() ?? '');
  const [guardianDateOfBirth, setGuardianDateOfBirth] = useState(initial?.contact_date_of_birth ?? '');
  const [guardianGender, setGuardianGender] = useState<MemberGender | null>(initial?.contact_gender ?? null);
  const [nationalId, setNationalId] = useState(initial?.national_id ?? '');
  const [nationalIdExpiresOn, setNationalIdExpiresOn] = useState(initial?.national_id_expires_on ?? '');
  const [phones, setPhones] = useState([initial?.phone ?? '', initial?.phone_2 ?? '', initial?.phone_3 ?? ''].map(digitsOnly));
  const [address, setAddress] = useState(initial?.address ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(initial?.monthly_income?.toString() ?? '');
  const [fixedExpenses, setFixedExpenses] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState(initial?.next_review_date ?? '');
  const [healthCondition, setHealthCondition] = useState(initial?.health_condition ?? '');
  const [branchArea, setBranchArea] = useState(initial?.branch_area ?? '');
  const [branchOptions, setBranchOptions] = useState<CaseBranch[]>([]);
  const [inactiveBranchOptions, setInactiveBranchOptions] = useState<CaseBranch[]>([]);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchError, setBranchError] = useState('');
  const [branchBusy, setBranchBusy] = useState(false);
  const [fileStatus, setFileStatus] = useState<CaseFileStatus>(initial?.file_status ?? 'تحت المراجعة');
  const [statusReason, setStatusReason] = useState(initial?.status_reason ?? '');
  const [familyNotes, setFamilyNotes] = useState(initial?.notes ?? '');
  const [categories, setCategories] = useState<CaseCategory[]>(initial?.case_file_categories.map(({ category }) => category).filter(isCaseCategory) ?? []);
  const preservedCategories = initial?.case_file_categories.map(({ category }) => category).filter((category) => !isCaseCategory(category)) ?? [];
  const [files, setFiles] = useState<File[]>([]);
  const [savedFileId, setSavedFileId] = useState(initial?.id ?? null);
  const [draft, setDraft] = useState('');
  const [scanTarget, setScanTarget] = useState<'father'|'mother'|'guardian'>('mother');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const widowCase = categories.includes('أرملة');
  const hideGuardianFields = categories.some((category) => ['أرملة', 'هجر', 'مطلقة'].includes(category));
  const today = cairoToday();
  const householdPeople = [
    ...(!widowCase ? [{ name: fatherName, nationalId: initial?.father_national_id }] : []),
    { name: motherName, nationalId: initial?.mother_national_id },
    ...initialMembers.map((member) => ({ name: member.people.name, nationalId: member.people.national_id })),
  ];
  const seenNationalIds = new Set<string>();
  const householdCount = householdPeople.filter(({ name, nationalId }) => {
    if (!name.trim()) return false;
    const normalizedId = normalizeEgyptianNationalIdInput(nationalId ?? '');
    if (!/^\d{14}$/.test(normalizedId)) return true;
    if (seenNationalIds.has(normalizedId)) return false;
    seenNationalIds.add(normalizedId);
    return true;
  }).length;
  const lastAppliedFatherId = useRef<string | null>(parseEgyptianNationalId(initial?.father_national_id ?? '', today)?.nationalId ?? null);
  const lastAppliedMotherId = useRef<string | null>(parseEgyptianNationalId(initial?.mother_national_id ?? '', today)?.nationalId ?? null);
  const lastAppliedGuardianId = useRef<string | null>(parseEgyptianNationalId(initial?.national_id ?? '', today)?.nationalId ?? null);
  const fatherIdDetails = parseEgyptianNationalId(fatherNationalId, today);
  const motherIdDetails = parseEgyptianNationalId(motherNationalId, today);
  const guardianIdDetails = parseEgyptianNationalId(nationalId, today);

  function updateParentId(parent: 'father'|'mother', value: string) {
    const id = normalizeEgyptianNationalIdInput(value);
    if (parent === 'father') setFatherNationalId(id); else setMotherNationalId(id);
    const parsed = parseEgyptianNationalId(id, today);
    if (!parsed) return;
    const lastApplied = parent === 'father' ? lastAppliedFatherId : lastAppliedMotherId;
    if (parsed.nationalId === lastApplied.current) return;
    lastApplied.current = parsed.nationalId;
    if (parent === 'father') { setFatherDateOfBirth(parsed.birthDate); setFatherGender(parsed.gender); }
    else { setMotherDateOfBirth(parsed.birthDate); setMotherGender(parsed.gender); }
  }

  function updateGuardianId(value: string) {
    const id = normalizeEgyptianNationalIdInput(value);
    setNationalId(id);
    const parsed = parseEgyptianNationalId(id, today);
    if (!parsed || parsed.nationalId === lastAppliedGuardianId.current) return;
    lastAppliedGuardianId.current = parsed.nationalId;
    setGuardianDateOfBirth(parsed.birthDate); setGuardianGender(parsed.gender); setGuardianAge(String(parsed.age));
  }

  function useScannedIdentity() {
    const scannedId = parseNationalIdScan(draft).nationalId;
    if (!scannedId || !parseEgyptianNationalId(scannedId, today)) return;
    if (scanTarget === 'father') updateParentId('father', scannedId);
    else if (scanTarget === 'mother') updateParentId('mother', scannedId);
    else updateGuardianId(scannedId);
  }

  async function refreshBranchOptions() {
    const [active, inactive] = await Promise.all([listBranches(), listInactiveBranches()]);
    setBranchOptions(active);
    setInactiveBranchOptions(inactive);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([listBranches(), listInactiveBranches()]).then(([options, inactive]) => { if (active) { setBranchOptions(options); setInactiveBranchOptions(inactive); } }).catch(() => { if (active) setBranchError('تعذّر تحميل الفروع. حدّث الصفحة وحاول تاني.'); });
    return () => { active = false; };
  }, []);

  async function saveNewBranch() {
    setBranchBusy(true); setBranchError('');
    try {
      await addBranch(newBranchName);
      await refreshBranchOptions();
      setBranchArea(newBranchName.trim()); setNewBranchName('');
    } catch (caught) { setBranchError(caught instanceof Error ? caught.message : 'تعذّر إضافة الفرع.'); }
    finally { setBranchBusy(false); }
  }

  async function deactivateBranch(branch: CaseBranch) {
    setBranchBusy(true); setBranchError('');
    try {
      await deactivateCaseBranch(branch.id);
      await refreshBranchOptions();
      if (!initial && branchArea === branch.name) setBranchArea('');
    } catch { setBranchError('تعذّر إيقاف الفرع. تأكد من صلاحيتك وحاول تاني.'); }
    finally { setBranchBusy(false); }
  }

  async function reactivateBranch(branch: CaseBranch) {
    setBranchBusy(true); setBranchError('');
    try {
      await reactivateCaseBranch(branch.id);
      await refreshBranchOptions();
      if (!initial) setBranchArea(branch.name);
    } catch { setBranchError('تعذّر إعادة تشغيل الفرع. تأكد من صلاحيتك وحاول تاني.'); }
    finally { setBranchBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!motherName.trim() && !initial) { setError('اسم الأم مطلوب.'); return; }
    if (!categories.length && !preservedCategories.length) { setError('اختار نوع حالة واحد على الأقل.'); return; }
    if (hasConflictingCaseCategories(categories)) { setError('اختار نوع واحد بس من هجر أو أرملة أو مطلقة.'); return; }
    const normalizedAge = latinDigits(guardianAge.trim());
    const normalizedId = digitsOnly(nationalId.trim());
    const normalizedFatherId = digitsOnly(fatherNationalId.trim());
    const normalizedMotherId = digitsOnly(motherNationalId.trim());
    const normalizedIncome = latinDigits(monthlyIncome.trim());
    const normalizedExpenses = latinDigits(fixedExpenses.trim());
    if (normalizedAge && (!/^\d{1,3}$/.test(normalizedAge) || Number(normalizedAge) > 120)) { setError('سن المسؤول لازم يكون من ٠ لحد ١٢٠ سنة.'); return; }
    if (normalizedId && !/^\d{14}$/.test(normalizedId)) { setError('الرقم القومي لازم يكون ١٤ رقم.'); return; }
    if ((normalizedFatherId && !/^\d{14}$/.test(normalizedFatherId)) || (normalizedMotherId && !/^\d{14}$/.test(normalizedMotherId))) { setError('الرقم القومي للأب والأم لازم يكون ١٤ رقم.'); return; }
    if ((fatherDateOfBirth && fatherDateOfBirth > today) || (motherDateOfBirth && motherDateOfBirth > today) || (guardianDateOfBirth && guardianDateOfBirth > today)) { setError('تاريخ الميلاد ماينفعش يكون في المستقبل.'); return; }
    if (!phones.some((phone) => phone.trim())) { setError('اكتب رقم موبايل أو رقم منزل واحد على الأقل.'); return; }
    if (phones.slice(0, 2).some((phone) => phone.trim() && !/^\d{11}$/.test(phone.trim()))) { setError('رقم الموبايل لازم يكون ١١ رقم.'); return; }
    if (phones[2]?.trim() && !/^\d{10}$/.test(phones[2].trim())) { setError('رقم المنزل لازم يكون ١٠ أرقام.'); return; }
    if ((fatherHealthStatus && fatherHealthStatus !== 'حالة مستقرة' && !fatherHealthCondition.trim()) || (motherHealthStatus && motherHealthStatus !== 'حالة مستقرة' && !motherHealthCondition.trim())) { setError('اكتب نوع العجز أو المرض للشخص اللي اخترت له الحالة الصحية.'); return; }
    if (normalizedIncome && !/^\d+$/.test(normalizedIncome)) { setError('الدخل الشهري اكتب فيه أرقام بس من غير فواصل.'); return; }
    if (normalizedExpenses && !/^\d+$/.test(normalizedExpenses)) { setError('المصروفات اكتب فيها أرقام بس من غير فواصل.'); return; }
    if ((fileStatus === 'موقوف' || fileStatus === 'مرفوض') && !statusReason.trim()) { setError('اكتب سبب إيقاف أو رفض الملف.'); return; }

    const input: CaseFileInput = {
      fatherName: fatherName.trim(), motherName: motherName.trim(), contactName: guardianName.trim(), contactRelationship: guardianRelationship.trim(),
      contactAge: normalizedAge ? Number(normalizedAge) : null, nationalId: normalizedId, nationalIdExpiresOn,
      phones: phones.map((phone) => phone.trim()), notes: familyNotes.trim(), address: address.trim(),
      monthlyIncome: normalizedIncome ? Number(normalizedIncome) : null, healthCondition: healthCondition.trim(), branchArea: branchArea.trim(),
      fileStatus, statusReason: statusReason.trim(), categories, fatherNationalId: normalizedFatherId, motherNationalId: normalizedMotherId,nextReviewDate,
      fatherHealthCondition: fatherHealthCondition.trim(), motherHealthCondition: motherHealthCondition.trim(),
      fatherHealthStatus: fatherHealthStatus || undefined, motherHealthStatus: motherHealthStatus || undefined,
      fatherEmploymentStatus, motherEmploymentStatus, fatherOccupation, motherOccupation,
      fatherDateOfBirth, fatherGender, motherDateOfBirth, motherGender, contactDateOfBirth: guardianDateOfBirth, contactGender: guardianGender,
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
      <fieldset><legend>اختار نوع الحالة</legend>{CASE_CATEGORIES.map((category) => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={(event) => setCategories((current) => updateCaseCategorySelection(current, category, event.target.checked))} /> {category}</label>)}{preservedCategories.map((category) => <span className="category-label" key={category}>تصنيف قديم محفوظ: {category}</span>)}</fieldset>
      <div className="form-grid">
        <label>حالة الملف<select value={fileStatus} onChange={(event) => setFileStatus(event.target.value as CaseFileStatus)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        {(fileStatus === 'موقوف' || fileStatus === 'مرفوض') && <label>سبب {fileStatus === 'موقوف' ? 'الإيقاف' : 'الرفض'}<textarea required maxLength={1000} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} /></label>}
      </div>
    </section>
    <section className="form-section">
      <h2>٢. بيانات الأب والأم</h2>
      <p className="form-help">عدد أفراد الأسرة المسجلين حاليًا: {new Intl.NumberFormat('ar-EG').format(householdCount)}. لو نفس الرقم القومي متكرر بيتحسب الشخص مرة واحدة.</p>
      <div className="form-grid">
        {!widowCase && <label>اسم الأب <span className="muted-cell">(اختياري)</span><input maxLength={200} value={fatherName} onChange={(event) => setFatherName(event.target.value)} /></label>}
        <label>اسم الأم {!initial && <span className="muted-cell">(مطلوب)</span>}<input required={!initial} maxLength={200} value={motherName} onChange={(event) => setMotherName(event.target.value)} /></label>
        {!widowCase && <><label>الرقم القومي للأب <span className="muted-cell">(اختياري)</span><input aria-label="الرقم القومي للأب" inputMode="numeric" maxLength={14} value={fatherNationalId} onChange={(event) => updateParentId('father', event.target.value)} />{fatherIdDetails&&<small className="form-help">المحافظة الظاهرة في الرقم: {fatherIdDetails.governorate} (للمراجعة بس)</small>}</label>
        <label>تاريخ ميلاد الأب<input aria-label="تاريخ ميلاد الأب" type="date" max={today} value={fatherDateOfBirth} onChange={(event) => setFatherDateOfBirth(event.target.value)} /></label>
        <label>نوع الأب<select aria-label="نوع الأب" value={fatherGender ?? ''} onChange={(event) => setFatherGender((event.target.value || null) as MemberGender | null)}><option value="">اختار النوع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
        {fatherDateOfBirth && fatherDateOfBirth <= today && <p className="member-age-preview" role="status">العمر: {new Intl.NumberFormat('ar-EG').format(ageOn(fatherDateOfBirth, today))} سنة</p>}</>}
        <label>الرقم القومي للأم <span className="muted-cell">(اختياري)</span><input aria-label="الرقم القومي للأم" inputMode="numeric" maxLength={14} value={motherNationalId} onChange={(event) => updateParentId('mother', event.target.value)} />{motherIdDetails&&<small className="form-help">المحافظة الظاهرة في الرقم: {motherIdDetails.governorate} (للمراجعة بس)</small>}</label>
        <label>تاريخ ميلاد الأم<input aria-label="تاريخ ميلاد الأم" type="date" max={today} value={motherDateOfBirth} onChange={(event) => setMotherDateOfBirth(event.target.value)} /></label>
        <label>نوع الأم<select aria-label="نوع الأم" value={motherGender ?? ''} onChange={(event) => setMotherGender((event.target.value || null) as MemberGender | null)}><option value="">اختار النوع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
        {motherDateOfBirth && motherDateOfBirth <= today && <p className="member-age-preview" role="status">العمر: {new Intl.NumberFormat('ar-EG').format(ageOn(motherDateOfBirth, today))} سنة</p>}
        {!widowCase && <><label>الحالة الصحية للأب<select aria-label="الحالة الصحية للأب" value={fatherHealthStatus} onChange={(event) => setFatherHealthStatus((event.target.value || '') as HealthStatus | '')}><option value="">اختار الحالة الصحية</option>{HEALTH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{fatherHealthStatus && fatherHealthStatus !== 'حالة مستقرة' && <label>نوع العجز أو الإعاقة أو المرض للأب<textarea maxLength={2000} value={fatherHealthCondition} onChange={(event) => setFatherHealthCondition(event.target.value)} /></label>}</>}
        <label>الحالة الصحية للأم<select aria-label="الحالة الصحية للأم" value={motherHealthStatus} onChange={(event) => setMotherHealthStatus((event.target.value || '') as HealthStatus | '')}><option value="">اختار الحالة الصحية</option>{HEALTH_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        {motherHealthStatus && motherHealthStatus !== 'حالة مستقرة' && <label>نوع العجز أو الإعاقة أو المرض للأم<textarea maxLength={2000} value={motherHealthCondition} onChange={(event) => setMotherHealthCondition(event.target.value)} /></label>}
        {!widowCase && <label>حالة عمل الأب<select aria-label="حالة عمل الأب" value={fatherEmploymentStatus??''} onChange={(event) => setFatherEmploymentStatus((event.target.value||null) as EmploymentStatus|null)}><option value="">اختار حالة العمل</option>{employmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
        {fatherEmploymentStatus === 'يعمل' && !widowCase && <label>نوع عمل الأب<input aria-label="نوع عمل الأب" maxLength={200} value={fatherOccupation} onChange={(event) => setFatherOccupation(event.target.value)} /></label>}
        <label>حالة عمل الأم<select aria-label="حالة عمل الأم" value={motherEmploymentStatus??''} onChange={(event) => setMotherEmploymentStatus((event.target.value||null) as EmploymentStatus|null)}><option value="">اختار حالة العمل</option>{employmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        {motherEmploymentStatus === 'يعمل' && <label>نوع عمل الأم<input aria-label="نوع عمل الأم" maxLength={200} value={motherOccupation} onChange={(event) => setMotherOccupation(event.target.value)} /></label>}
      </div>
    </section>
    {!hideGuardianFields && <section className="form-section">
      <h2>٣. المسؤول عن التربية</h2>
      <div className="form-grid">
        <label>اسم المسؤول<input maxLength={200} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
        <label>صلة القرابة<input maxLength={100} placeholder="مثال: الأم، الجد، الخالة" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} /></label>
        <label>تاريخ ميلاد المسؤول<input aria-label="تاريخ ميلاد المسؤول" type="date" max={today} value={guardianDateOfBirth} onChange={(event) => { setGuardianDateOfBirth(event.target.value); setGuardianAge(event.target.value ? String(ageOn(event.target.value, today)) : ''); }} /></label>
        <label>نوع المسؤول<select aria-label="نوع المسؤول" value={guardianGender ?? ''} onChange={(event) => setGuardianGender((event.target.value || null) as MemberGender | null)}><option value="">اختار النوع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
        <label>سن المسؤول <span className="muted-cell">(اختياري)</span><input aria-label="سن المسؤول (اختياري)" type="number" min="0" max="120" value={guardianAge} onChange={(event) => setGuardianAge(latinDigits(event.target.value))} /></label>
        <label>الرقم القومي <span className="muted-cell">(اختياري)</span><input aria-label="الرقم القومي (اختياري)" inputMode="numeric" maxLength={14} value={nationalId} onChange={(event) => updateGuardianId(event.target.value)} />{guardianIdDetails&&<small className="form-help">المحافظة الظاهرة في الرقم: {guardianIdDetails.governorate} (للمراجعة بس)</small>}</label>
        <label>انتهاء البطاقة <span className="muted-cell">(اختياري)</span><input type="date" value={nationalIdExpiresOn} onChange={(event) => setNationalIdExpiresOn(event.target.value)} /></label>
      </div>
    </section>}
    <section className="form-section">
      <h2>٤. العنوان والتواصل</h2>
      <label>العنوان<input maxLength={1000} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
      <p className="form-help">اكتب رقم واحد على الأقل: رقم الموبايل ١١ رقم، ورقم المنزل ١٠ أرقام.</p>
      <div className="form-grid">{phones.map((phone, index) => {
        const label = ['رقم الموبايل 1', 'رقم الموبايل 2', 'رقم المنزل'][index];
        const maxLength = index === 2 ? 10 : 11;
        return <label key={index}>{label} <span className="muted-cell">{index === 2 ? '(اختياري)' : '(اختياري)'}</span><input aria-label={label} type="tel" inputMode="numeric" maxLength={maxLength} value={phone} onChange={(event) => setPhones((current) => current.map((value, item) => item === index ? digitsOnly(event.target.value).slice(0, maxLength) : value))} /></label>;
      })}</div>
      <div className="form-grid">
        <label>الدخل الشهري بالجنيه<input inputMode="numeric" value={monthlyIncome} onChange={(event) => setMonthlyIncome(digitsOnly(event.target.value))} /></label>
        <label>الحالة الصحية العامة للأسرة<textarea maxLength={2000} value={healthCondition} onChange={(event) => setHealthCondition(event.target.value)} /></label>
        <label>الفرع أو المنطقة<select value={branchArea} onChange={(event) => event.target.value === '__manage_branches__' ? (setBranchError(''), setBranchDialogOpen(true)) : setBranchArea(event.target.value)}>
          <option value="">اختار الفرع أو المنطقة</option>
          {!branchOptions.some((branch) => branch.name === branchArea) && branchArea && <option value={branchArea}>{branchArea} (فرع محفوظ)</option>}
          {branchOptions.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}
          <option value="__manage_branches__">إضافة فرع جديد</option>
        </select></label>
      </div>
      {branchError && !branchDialogOpen && <p className="error-message" role="alert">{branchError}</p>}
      <label>ملاحظات الملف<textarea maxLength={4000} value={familyNotes} onChange={(event) => setFamilyNotes(event.target.value)} /></label>
    </section>
    {branchDialogOpen && <div className="branch-dialog-backdrop"><section className="branch-dialog" role="dialog" aria-modal="true" aria-labelledby="branch-dialog-title">
      <div className="section-heading"><h2 id="branch-dialog-title">إدارة الفروع</h2><button type="button" className="secondary-button" onClick={() => setBranchDialogOpen(false)}>إغلاق</button></div>
      <p className="form-help">إيقاف الفرع يشيله من الاختيارات الجديدة، لكن اسمه يفضل محفوظ في ملفات الحالات القديمة. تقدر ترجّعه من قائمة الفروع المتوقفة.</p>
      <div className="branch-add-row"><label>اسم الفرع الجديد<input maxLength={100} value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} /></label><button type="button" disabled={branchBusy} onClick={() => void saveNewBranch()}>{branchBusy ? 'جاري الحفظ…' : 'إضافة الفرع'}</button></div>
      <h3>الفروع الحالية</h3>
      <ul className="branch-list">{branchOptions.map((branch) => <li key={branch.id}><span>{branch.name}</span><button type="button" className="secondary-button" disabled={branchBusy} aria-label={`إيقاف فرع ${branch.name}`} onClick={() => void deactivateBranch(branch)}>إيقاف الفرع</button></li>)}</ul>
      <h3>الفروع المتوقفة</h3>
      {inactiveBranchOptions.length ? <ul className="branch-list">{inactiveBranchOptions.map((branch) => <li key={branch.id}><span>{branch.name}</span><button type="button" className="secondary-button" disabled={branchBusy} aria-label={`إعادة تشغيل فرع ${branch.name}`} onClick={() => void reactivateBranch(branch)}>إعادة تشغيل الفرع</button></li>)}</ul> : <p className="form-help">مفيش فروع متوقفة.</p>}
      {branchError && <p className="error-message" role="alert">{branchError}</p>}
    </section></div>}
    <section className="form-section">
      <h2>٥. التقييم والمتابعة</h2>
      <div className="form-grid">
        <label>ميعاد إعادة بحث الحالة<input type="date" value={nextReviewDate} onChange={(event)=>setNextReviewDate(event.target.value)} /></label>
        <label>مصروفات الأسرة الشهرية الثابتة <span className="muted-cell">(للحساب بس)</span><input inputMode="numeric" value={fixedExpenses} onChange={(event)=>setFixedExpenses(digitsOnly(event.target.value))} /></label>
      </div>
      {initial&&monthlyIncome.trim()&&fixedExpenses.trim()&&calculatePerCapitaNetIncome(Number(latinDigits(monthlyIncome)),Number(latinDigits(fixedExpenses)),householdCount)!==null&&<p className="member-age-preview" role="status">متوسط دخل الفرد الصافي: {new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(calculatePerCapitaNetIncome(Number(latinDigits(monthlyIncome)),Number(latinDigits(fixedExpenses)),householdCount)!)} جنيه في الشهر · محسوب من الأفراد المسجلين، ومش بيتحفظ.</p>}
      {!initial&&<p className="form-help">احفظ الملف وسجّل أفراد الأسرة الأول عشان متوسط دخل الفرد يتحسب على عدد صحيح.</p>}
      <p className="form-help">اكتب ميعاد المتابعة لو الحالة محتاجة إعادة بحث. المصروفات هنا للحساب المؤقت ومش بتتسجل في الملف.</p>
    </section>
    <section className="form-section">
      <h2>٦. صور ومستندات الملف</h2>
      <p className="form-help">ارفع صور أو ملفات PDF؛ راجع النص المستخرج قبل استخدامه.</p>
      <FilePicker files={files} onChange={setFiles} onText={setDraft} />
    </section>
    {draft && parseEgyptianNationalId(parseNationalIdScan(draft).nationalId ?? '', today) && <div className="ocr-id-review"><p className="ocr-review-guidance">دي البيانات اللي اتقرت من المستند.. راجعها وعدل أي حاجة غلط قبل الحفظ</p><label>دي بطاقة مين؟<select aria-label="دي بطاقة مين؟" value={scanTarget} onChange={(event) => setScanTarget(event.target.value as 'father'|'mother'|'guardian')}><option value="mother">الأم</option>{!widowCase && <option value="father">الأب</option>}{!hideGuardianFields && <option value="guardian">المسؤول عن التربية</option>}</select></label><button type="button" className="secondary" onClick={useScannedIdentity}>استخدم البيانات المقروءة</button></div>}
    {draft && <FieldSuggestions text={draft} onApply={(field, value) => {
      if (field === 'notes' && value.trim()) { setFamilyNotes(value); return true; }
      if (field === 'case_categories' && CASE_CATEGORIES.includes(value as CaseCategory)) { setCategories((current) => current.includes(value as CaseCategory) ? current : [...current, value as CaseCategory]); return true; }
      return false;
    }} />}
    <div className="form-actions"><button disabled={busy}>{busy ? 'جاري الحفظ…' : initial ? 'حفظ التعديلات' : 'حفظ ملف الحالة'}</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>;
}
