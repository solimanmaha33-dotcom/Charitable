import {useEffect,useRef,useState} from 'react';
import {updateCaseFileIdentity,uploadCaseAttachment,type CaseFile} from '../../services/cases';
import {validateDocument,openPdf} from '../files/documentText';
import {FilePreview} from '../files/FilePreview';
import {parseEgyptianNationalId,parseNationalIdScan} from './nationalIdScan';
import {ageOn} from './memberAge';
import type {MemberGender} from './memberDemographics';
import {cairoToday} from './idExpiry';

const digits='٠١٢٣٤٥٦٧٨٩';const persian='۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value:string){return [...value].map(char=>{const arabic=digits.indexOf(char);if(arabic>=0)return String(arabic);const other=persian.indexOf(char);return other>=0?String(other):char;}).join('');}

export function CaseIdScanner({caseFile,onSaved}:{caseFile:CaseFile;onSaved:()=>void|Promise<void>}) {
 const [file,setFile]=useState<File|null>(null);
 const [nationalId,setNationalId]=useState(caseFile.national_id??'');
 const [expiresOn,setExpiresOn]=useState(caseFile.national_id_expires_on??'');
 const [birthDate,setBirthDate]=useState(caseFile.contact_date_of_birth??'');
 const [gender,setGender]=useState<MemberGender|null>(caseFile.contact_gender??null);
 const [age,setAge]=useState<number|null>(caseFile.contact_age);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const today=cairoToday();
 const lastAppliedNationalId=useRef<string|null>(parseEgyptianNationalId(caseFile.national_id??'',today)?.nationalId??null);
 useEffect(()=>{setNationalId(caseFile.national_id??'');setExpiresOn(caseFile.national_id_expires_on??'');setBirthDate(caseFile.contact_date_of_birth??'');setGender(caseFile.contact_gender??null);setAge(caseFile.contact_age);lastAppliedNationalId.current=parseEgyptianNationalId(caseFile.national_id??'',today)?.nationalId??null;},[caseFile.national_id,caseFile.national_id_expires_on,caseFile.contact_date_of_birth,caseFile.contact_gender,caseFile.contact_age,today]);
 function applyId(value:string) {
  const parsed=parseEgyptianNationalId(value,today);
  if(!parsed)return;
  setNationalId(parsed.nationalId);
  if(parsed.nationalId===lastAppliedNationalId.current)return;
  lastAppliedNationalId.current=parsed.nationalId;setBirthDate(parsed.birthDate);setGender(parsed.gender);setAge(parsed.age);
 }
 function readText(text:string) {
  const parsed=parseNationalIdScan(text);
  if(parsed.nationalId)applyId(parsed.nationalId);
  if(parsed.expiresOn)setExpiresOn(parsed.expiresOn);
  if(!parsed.nationalId&&!parsed.expiresOn)setMessage('مطلعناش بيانات واضحة. اكتبها بنفسك بعد مراجعة البطاقة.');
  else setMessage('راجع الرقم والتاريخ على البطاقة قبل الحفظ.');
 }
 async function choose(file:File|null) {
  setError('');setMessage('');if(!file)return;setFile(null);
  try {validateDocument(file);if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}setFile(file);}
  catch {setError('اختار صورة أو PDF صالح، بحد أقصى ٢٠ ميجابايت و٢٠ صفحة.');}
 }
 async function saveAndAttach() {
  setBusy(true);setError('');setMessage('');
  const normalizedId=latinDigits(nationalId.trim());
  if(normalizedId&&!/^\d{14}$/.test(normalizedId)){setError('الرقم القومي لازم يكون ١٤ رقم.');setBusy(false);return;}
  try {
   await updateCaseFileIdentity(caseFile.id,normalizedId,expiresOn,{birthDate:birthDate||null,gender,age});
  } catch {
   setError('تعذّر حفظ البيانات. راجع الرقم والتاريخ وحاول تاني.');setBusy(false);return;
  }
  let uploadFailed=false;let refreshFailed=false;
  try {if(file)await uploadCaseAttachment(caseFile.id,file);}catch{uploadFailed=true;}
  try {await onSaved();}catch{refreshFailed=true;}
  if(uploadFailed)setError('اتحفظت بيانات البطاقة، لكن تعذّر رفع الملف. حاول رفعه من مرفقات الأسرة.');
  else if(refreshFailed)setError('اتحفظت بيانات البطاقة، لكن تعذّر تحديث ملف الحالة. حدّث الصفحة.');
  else setMessage(file?'اتحفظت بيانات البطاقة والملف في الحالة.':'اتحفظت بيانات البطاقة.');
  setBusy(false);
 }
 return <section className="section-block family-id-scanner" aria-labelledby="family-id-scan-title">
  <h3 id="family-id-scan-title">قراءة بيانات البطاقة</h3>
  <p className="form-help">اختار صورة أو PDF. القراءة بتحصل على جهازك؛ راجع الرقم والتاريخ بنفسك قبل الحفظ.</p>
  <label>صورة البطاقة أو ملف PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void choose(event.target.files?.[0]??null);event.currentTarget.value='';}} /></label>
  {file&&<FilePreview key={file.name+file.size} file={file} onText={readText}/>}
  <div className="form-grid"><label>الرقم القومي<input aria-label="الرقم القومي" inputMode="numeric" maxLength={14} value={nationalId} onChange={event=>{const value=latinDigits(event.target.value);setNationalId(value);applyId(value);}} />{parseEgyptianNationalId(nationalId,today)&&<small className="form-help">المحافظة الظاهرة في الرقم: {parseEgyptianNationalId(nationalId,today)?.governorate} (للمراجعة بس)</small>}</label><label>تاريخ انتهاء البطاقة<input type="date" value={expiresOn} onChange={event=>setExpiresOn(event.target.value)} /></label>
   <label>تاريخ ميلاد المسؤول<input aria-label="تاريخ ميلاد المسؤول" type="date" max={today} value={birthDate} onChange={event=>{setBirthDate(event.target.value);setAge(event.target.value?ageOn(event.target.value,today):null);}} /></label>
   <label>نوع المسؤول<select aria-label="نوع المسؤول" value={gender??''} onChange={event=>setGender((event.target.value||null) as MemberGender|null)}><option value="">اختار النوع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
   <label>سن المسؤول<input aria-label="سن المسؤول" type="number" min="0" max="120" value={age??''} onChange={event=>setAge(event.target.value===''?null:Number(event.target.value))} /></label>
  </div>
  {message&&<p role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}
  <button type="button" disabled={busy||(!nationalId&&!expiresOn)} onClick={()=>void saveAndAttach()}>{busy?'جاري الحفظ…':'مراجعة البيانات وحفظها'}</button>
 </section>;
}
