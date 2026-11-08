import {useEffect,useState} from 'react';
import {saveFamily,uploadFamilyFile,type FamilyProfile,type FamilyProfileInput} from '../../services/cases';
import {validateDocument,openPdf} from '../files/documentText';
import {FilePreview} from '../files/FilePreview';
import {parseNationalIdScan} from './nationalIdScan';

const digits='٠١٢٣٤٥٦٧٨٩';const persian='۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value:string){return [...value].map(char=>{const arabic=digits.indexOf(char);if(arabic>=0)return String(arabic);const other=persian.indexOf(char);return other>=0?String(other):char;}).join('');}

export function FamilyIdScanner({family,onSaved}:{family:FamilyProfile;onSaved:()=>void|Promise<void>}) {
 const [file,setFile]=useState<File|null>(null);
 const [nationalId,setNationalId]=useState(family.national_id??'');
 const [expiresOn,setExpiresOn]=useState(family.national_id_expires_on??'');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 useEffect(()=>{setNationalId(family.national_id??'');setExpiresOn(family.national_id_expires_on??'');},[family.national_id,family.national_id_expires_on]);
 function readText(text:string) {
  const parsed=parseNationalIdScan(text);
  if(parsed.nationalId)setNationalId(parsed.nationalId);
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
  const input:FamilyProfileInput={name:family.name,fatherName:family.father_name??'',motherName:family.mother_name??'',contactName:family.contact_name??'',contactRelationship:family.contact_relationship??'',contactAge:family.contact_age,nationalId:normalizedId,nationalIdExpiresOn:expiresOn,phones:[family.phone??'',family.phone_2??'',family.phone_3??''],notes:family.notes};
  try {
   await saveFamily(family.id,input);
  } catch {
   setError('تعذّر حفظ البيانات. راجع الرقم والتاريخ وحاول تاني.');setBusy(false);return;
  }
  let uploadFailed=false;let refreshFailed=false;
  try {if(file)await uploadFamilyFile(family.id,file);}catch{uploadFailed=true;}
  try {await onSaved();}catch{refreshFailed=true;}
  if(uploadFailed)setError('اتحفظت بيانات البطاقة، لكن تعذّر رفع الملف. حاول رفعه من مرفقات الأسرة.');
  else if(refreshFailed)setError('اتحفظت بيانات البطاقة، لكن تعذّر تحديث الملف. حدّث الصفحة.');
  else setMessage(file?'اتحفظت بيانات البطاقة والملف في الأسرة.':'اتحفظت بيانات البطاقة.');
  setBusy(false);
 }
 return <section className="section-block family-id-scanner" aria-labelledby="family-id-scan-title">
  <h3 id="family-id-scan-title">قراءة بيانات البطاقة</h3>
  <p className="form-help">اختار صورة أو PDF. القراءة بتحصل على جهازك؛ راجع الرقم والتاريخ بنفسك قبل الحفظ.</p>
  <label>صورة البطاقة أو ملف PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void choose(event.target.files?.[0]??null);event.currentTarget.value='';}} /></label>
  {file&&<FilePreview key={file.name+file.size} file={file} onText={readText}/>}
  <div className="form-grid"><label>الرقم القومي<input inputMode="numeric" maxLength={14} value={nationalId} onChange={event=>setNationalId(latinDigits(event.target.value))} /></label><label>تاريخ انتهاء البطاقة<input type="date" value={expiresOn} onChange={event=>setExpiresOn(event.target.value)} /></label></div>
  {message&&<p role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}
  <button type="button" disabled={busy||(!nationalId&&!expiresOn)} onClick={()=>void saveAndAttach()}>{busy?'جاري الحفظ…':'مراجعة البيانات وحفظها'}</button>
 </section>;
}
