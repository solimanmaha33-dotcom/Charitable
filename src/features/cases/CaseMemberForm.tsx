import {useRef,useState,type FormEvent} from 'react';
import {addMember,updateMemberDemographics,uploadCaseAttachment,type EmploymentStatus,type Member} from '../../services/cases';
import {validateDocument,openPdf} from '../files/documentText';
import {FilePreview} from '../files/FilePreview';
import {cairoToday} from './idExpiry';
import {ageOn} from './memberAge';
import {parseMemberIdText,type MemberGender} from './memberDemographics';
import {normalizeEgyptianNationalIdInput,parseEgyptianNationalId} from './nationalIdScan';
import {HEALTH_STATUSES,type HealthStatus} from './healthStatus';

export function CaseMemberForm({caseFileId,onAdded,member}:{caseFileId:string;onAdded:()=>void|Promise<void>;member?:Member}){
 const editing=!!member;
 const [name,setName]=useState(member?.people.name??'');const [relationship,setRelationship]=useState(member?.relationship??'');
 const [nationalId,setNationalId]=useState(member?.people.national_id??'');const [birthDate,setBirthDate]=useState(member?.people.date_of_birth??'');const [gender,setGender]=useState<MemberGender|null>(member?.people.gender??null);
 const [healthStatus,setHealthStatus]=useState<HealthStatus|''>(member?.people.health_status??'');const [healthCondition,setHealthCondition]=useState(member?.people.health_details??member?.people.health_condition??'');
 const [employmentStatus,setEmploymentStatus]=useState<EmploymentStatus|null>(member?.people.employment_status??null);const [occupation,setOccupation]=useState(member?.people.occupation??'');
 const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const today=cairoToday();const lastAppliedNationalId=useRef<string|null>(parseEgyptianNationalId(member?.people.national_id??'',today)?.nationalId??null);const receivedOcrText=useRef(false);
 function applyIdText(text:string){
  const suggestion=parseMemberIdText(text);
  const hadReceivedOcrText=receivedOcrText.current;
  receivedOcrText.current=true;
  if(suggestion.nationalId){
   setNationalId(suggestion.nationalId);
   if(suggestion.nationalId!==lastAppliedNationalId.current){
    lastAppliedNationalId.current=suggestion.nationalId;
    if(suggestion.birthDate)setBirthDate(suggestion.birthDate);
    if(suggestion.gender)setGender(suggestion.gender);
   }
  }else if(!suggestion.nationalId&&!hadReceivedOcrText&&suggestion.birthDate)setBirthDate(suggestion.birthDate);
  if(suggestion.birthDate||suggestion.gender)setMessage('راجع تاريخ الميلاد والنوع على البطاقة قبل الإضافة.');
  else setMessage('مطلعناش البيانات؛ اكتب تاريخ الميلاد والنوع يدويًا.');
 }
 function updateNationalId(value:string){
  setNationalId(normalizeEgyptianNationalIdInput(value));
  const suggestion=parseEgyptianNationalId(value,today);
  if(suggestion&&suggestion.nationalId!==lastAppliedNationalId.current){lastAppliedNationalId.current=suggestion.nationalId;setBirthDate(suggestion.birthDate);setGender(suggestion.gender);}
 }
 async function chooseFile(selected:File|null){
  setError('');setMessage('');if(!selected)return;setFile(null);
  try{validateDocument(selected);if(selected.type==='application/pdf'){const pdf=await openPdf(selected);await pdf.cleanup();}setFile(selected);}
  catch{setError('اختار صورة أو PDF صالح، بحد أقصى ٢٠ ميجابايت و٢٠ صفحة.');}
 }
 async function submit(event:FormEvent){
  event.preventDefault();setError('');setMessage('');
  if(birthDate>today){setError('تاريخ الميلاد ماينفعش يكون في المستقبل.');return;}
  if(nationalId.trim()&&!parseEgyptianNationalId(nationalId,today)){setError('اتأكد إن الرقم القومي ١٤ رقم وتاريخ الميلاد صحيح.');return;}
  if(healthStatus&&healthStatus!=='حالة مستقرة'&&!healthCondition.trim()){setError('اكتب نوع العجز أو المرض.');return;}
  setBusy(true);
  try{if(member)await updateMemberDemographics(member.person_id,gender,birthDate||null,healthStatus||null,healthCondition.trim()||null,employmentStatus||null,occupation.trim()||null,nationalId.trim()||null);else await addMember(caseFileId,name.trim(),relationship.trim(),gender,birthDate||null,healthStatus||null,healthCondition.trim()||null,employmentStatus||null,occupation.trim()||null,nationalId.trim()||null);}
  catch{setError(editing?'تعذّر حفظ بيانات الفرد. راجع البيانات وحاول تاني.':'تعذّرت إضافة الفرد. راجع البيانات وحاول تاني.');setBusy(false);return;}
  let uploadFailed=false;try{if(file)await uploadCaseAttachment(caseFileId,file);}catch{uploadFailed=true;}
  if(!editing){setName('');setRelationship('');setNationalId('');setBirthDate('');setGender(null);setFile(null);}
  try{await onAdded();}catch{/* The saved member stays saved even if refreshing its list fails. */}
  setMessage(uploadFailed?(editing?'اتحفظت بيانات السن، لكن تعذّر رفع البطاقة. تقدر ترفعها من مرفقات الأسرة.':'اتضاف الفرد، لكن تعذّر رفع البطاقة. تقدر ترفعها من مرفقات الأسرة.'):(editing?'اتحفظت بيانات السن.':'اتضاف الفرد للأسرة.'));
  setBusy(false);
 }
 return <form className="domain-form member-form" onSubmit={event=>void submit(event)}>
  <h3>{editing?'تعديل بيانات الفرد':'إضافة فرد للأسرة'}</h3>
  {!editing&&<div className="form-grid"><label>اسم الفرد<input required maxLength={200} value={name} onChange={event=>setName(event.target.value)} /></label><label>صلة القرابة<input required maxLength={100} value={relationship} onChange={event=>setRelationship(event.target.value)} /></label></div>}
  <fieldset className="member-demographics"><legend>بيانات السن</legend>
   <label>الرقم القومي للفرد<input aria-label="الرقم القومي للفرد" inputMode="numeric" maxLength={14} value={nationalId} onChange={event=>updateNationalId(event.target.value)} />{parseEgyptianNationalId(nationalId,today)&&<small className="form-help">المحافظة الظاهرة في الرقم: {parseEgyptianNationalId(nationalId,today)?.governorate} (للمراجعة بس)</small>}</label>
   <p className="form-help">لو الرقم سليم هنقترح تاريخ الميلاد والنوع. راجع البيانات قبل الحفظ؛ الرقم هيتسجل عشان البحث.</p>
   <label>صورة البطاقة أو PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void chooseFile(event.target.files?.[0]??null);event.currentTarget.value='';}} /></label>
   {file&&<FilePreview key={`${file.name}-${file.size}`} file={file} onText={applyIdText}/>}
   <div className="form-grid"><label>تاريخ الميلاد<input type="date" max={today} value={birthDate} onChange={event=>setBirthDate(event.target.value)} /></label><label>النوع<select value={gender??''} onChange={event=>setGender((event.target.value||null) as MemberGender|null)}><option value="">اختار النوع</option><option value="female">بنت</option><option value="male">ولد</option></select></label></div>
   {birthDate&&birthDate<=today&&<p className="member-age-preview" role="status">العمر: {new Intl.NumberFormat('ar-EG').format(ageOn(birthDate,today))} سنة</p>}
  </fieldset>
  <label>الحالة الصحية للفرد<select aria-label="الحالة الصحية للفرد" value={healthStatus} onChange={event=>setHealthStatus((event.target.value||'') as HealthStatus|'')}><option value="">اختار الحالة الصحية</option>{HEALTH_STATUSES.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
  {healthStatus&&healthStatus!=='حالة مستقرة'&&<label>{healthStatus==='مرض'?'نوع المرض':'نوع العجز أو الإعاقة'}<textarea maxLength={2000} value={healthCondition} onChange={event=>setHealthCondition(event.target.value)} /></label>}
  <label>حالة العمل للفرد<select aria-label="حالة العمل للفرد" value={employmentStatus??''} onChange={event=>setEmploymentStatus((event.target.value||null) as EmploymentStatus|null)}><option value="">اختار حالة العمل</option><option value="يعمل">يعمل</option><option value="لا يعمل">لا يعمل</option><option value="طفل">طفل</option><option value="طفلة">طفلة</option></select></label>
  {employmentStatus==='يعمل'&&<label>نوع عمل الفرد<input aria-label="نوع عمل الفرد" maxLength={200} value={occupation} onChange={event=>setOccupation(event.target.value)} /></label>}
  {message&&<p role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}
  <button disabled={busy||(!editing&&(!name.trim()||!relationship.trim()))}>{busy?'جاري الحفظ…':editing?'حفظ بيانات الفرد':'إضافة الفرد'}</button>
 </form>;
}
