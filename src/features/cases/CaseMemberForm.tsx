import {useState,type FormEvent} from 'react';
import {addMember,updateMemberDemographics,uploadCaseAttachment,type Member} from '../../services/cases';
import {validateDocument,openPdf} from '../files/documentText';
import {FilePreview} from '../files/FilePreview';
import {cairoToday} from './idExpiry';
import {ageOn} from './memberAge';
import {parseMemberIdText,type MemberGender} from './memberDemographics';

export function CaseMemberForm({caseFileId,onAdded,member}:{caseFileId:string;onAdded:()=>void|Promise<void>;member?:Member}){
 const editing=!!member;
 const [name,setName]=useState(member?.people.name??'');const [relationship,setRelationship]=useState(member?.relationship??'');
 const [nationalId,setNationalId]=useState('');const [birthDate,setBirthDate]=useState(member?.people.date_of_birth??'');const [gender,setGender]=useState<MemberGender|null>(member?.people.gender??null);
 const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const today=cairoToday();
 function applyIdText(text:string){
  const suggestion=parseMemberIdText(text);
  if(suggestion.nationalId)setNationalId(suggestion.nationalId);
  if(suggestion.birthDate)setBirthDate(suggestion.birthDate);
  if(suggestion.gender)setGender(suggestion.gender);
  if(suggestion.birthDate||suggestion.gender)setMessage('راجع تاريخ الميلاد والنوع على البطاقة قبل الإضافة.');
  else setMessage('مطلعناش البيانات؛ اكتب تاريخ الميلاد والنوع يدويًا.');
 }
 function updateNationalId(value:string){
  setNationalId(value);
  const suggestion=parseMemberIdText(value);
  if(suggestion.birthDate)setBirthDate(suggestion.birthDate);
  if(suggestion.gender)setGender(suggestion.gender);
 }
 async function chooseFile(selected:File|null){
  setError('');setMessage('');if(!selected)return;setFile(null);
  try{validateDocument(selected);if(selected.type==='application/pdf'){const pdf=await openPdf(selected);await pdf.cleanup();}setFile(selected);}
  catch{setError('اختار صورة أو PDF صالح، بحد أقصى ٢٠ ميجابايت و٢٠ صفحة.');}
 }
 async function submit(event:FormEvent){
  event.preventDefault();setError('');setMessage('');
  if(birthDate>today){setError('تاريخ الميلاد ماينفعش يكون في المستقبل.');return;}
  setBusy(true);
  try{if(member)await updateMemberDemographics(member.person_id,gender,birthDate||null);else await addMember(caseFileId,name.trim(),relationship.trim(),gender,birthDate||null);}
  catch{setError(editing?'تعذّر حفظ بيانات السن. راجع البيانات وحاول تاني.':'تعذّرت إضافة الفرد. راجع البيانات وحاول تاني.');setBusy(false);return;}
  let uploadFailed=false;try{if(file)await uploadCaseAttachment(caseFileId,file);}catch{uploadFailed=true;}
  if(!editing){setName('');setRelationship('');setNationalId('');setBirthDate('');setGender(null);setFile(null);}
  try{await onAdded();}catch{/* The saved member stays saved even if refreshing its list fails. */}
  setMessage(uploadFailed?(editing?'اتحفظت بيانات السن، لكن تعذّر رفع البطاقة. تقدر ترفعها من مرفقات الأسرة.':'اتضاف الفرد، لكن تعذّر رفع البطاقة. تقدر ترفعها من مرفقات الأسرة.'):(editing?'اتحفظت بيانات السن.':'اتضاف الفرد للأسرة.'));
  setBusy(false);
 }
 return <form className="domain-form member-form" onSubmit={event=>void submit(event)}>
  <h3>{editing?'تعديل بيانات السن':'إضافة فرد للأسرة'}</h3>
  {!editing&&<div className="form-grid"><label>اسم الفرد<input required maxLength={200} value={name} onChange={event=>setName(event.target.value)} /></label><label>صلة القرابة<input required maxLength={100} value={relationship} onChange={event=>setRelationship(event.target.value)} /></label></div>}
  <fieldset className="member-demographics"><legend>بيانات السن</legend>
   <label>الرقم القومي للمساعدة في قراءة البيانات<input inputMode="numeric" maxLength={24} value={nationalId} onChange={event=>updateNationalId(event.target.value)} /></label>
   <p className="form-help">هنستخدم الرقم لاقتراح البيانات، ومش هيتحفظ في ملف الفرد.</p>
   <label>صورة البطاقة أو PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void chooseFile(event.target.files?.[0]??null);event.currentTarget.value='';}} /></label>
   {file&&<FilePreview key={`${file.name}-${file.size}`} file={file} onText={applyIdText}/>}
   <div className="form-grid"><label>تاريخ الميلاد<input type="date" max={today} value={birthDate} onChange={event=>setBirthDate(event.target.value)} /></label><label>النوع<select value={gender??''} onChange={event=>setGender((event.target.value||null) as MemberGender|null)}><option value="">اختار النوع</option><option value="female">بنت</option><option value="male">ولد</option></select></label></div>
   {birthDate&&birthDate<=today&&<p className="member-age-preview" role="status">العمر: {new Intl.NumberFormat('ar-EG').format(ageOn(birthDate,today))} سنة</p>}
  </fieldset>
  {message&&<p role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}
  <button disabled={busy||(!editing&&(!name.trim()||!relationship.trim()))}>{busy?'جاري الحفظ…':editing?'حفظ بيانات السن':'إضافة الفرد'}</button>
 </form>;
}
