import {useEffect,useRef,useState} from 'react';
import {updateCaseFileIdentity,updateCaseParentIdentityProfile,uploadCaseAttachment,type CaseFile} from '../../services/cases';
import {validateDocument,openPdf} from '../files/documentText';
import {FilePreview} from '../files/FilePreview';
import {normalizeEgyptianNationalIdInput,parseEgyptianNationalId,parseNationalIdScan} from './nationalIdScan';
import {hasValidNationalIdForExpiry} from './caseIdentity';
import {ageOn} from './memberAge';
import type {MemberGender} from './memberDemographics';
import {cairoToday} from './idExpiry';

type IdentityTarget='father'|'mother'|'guardian';
type IdentityDetails={nationalId:string;expiresOn:string;birthDate:string;gender:MemberGender|null;age:number|null};
const digits='٠١٢٣٤٥٦٧٨٩';const persian='۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value:string){return [...value].map(char=>{const arabic=digits.indexOf(char);if(arabic>=0)return String(arabic);const other=persian.indexOf(char);return other>=0?String(other):char;}).join('');}
function identityDetails(caseFile:CaseFile,target:IdentityTarget,today:string):IdentityDetails{
 if(target==='father')return{nationalId:caseFile.father_national_id??'',expiresOn:caseFile.father_national_id_expires_on??'',birthDate:caseFile.father_date_of_birth??parseEgyptianNationalId(caseFile.father_national_id??'',today)?.birthDate??'',gender:caseFile.father_gender??null,age:null};
 if(target==='mother')return{nationalId:caseFile.mother_national_id??'',expiresOn:caseFile.mother_national_id_expires_on??'',birthDate:caseFile.mother_date_of_birth??parseEgyptianNationalId(caseFile.mother_national_id??'',today)?.birthDate??'',gender:caseFile.mother_gender??null,age:null};
 return{nationalId:caseFile.national_id??'',expiresOn:caseFile.national_id_expires_on??'',birthDate:caseFile.contact_date_of_birth??parseEgyptianNationalId(caseFile.national_id??'',today)?.birthDate??'',gender:caseFile.contact_gender??null,age:caseFile.contact_age};
}

export function CaseIdScanner({caseFile,onSaved}:{caseFile:CaseFile;onSaved:()=>void|Promise<void>}) {
 const today=cairoToday();
 const widow=caseFile.case_file_categories.some(({category})=>category==='أرملة');
 const guardianHidden=caseFile.case_file_categories.some(({category})=>['أرملة','مطلقة','هجر'].includes(category));
 const targets:IdentityTarget[]=[...(widow?[]:['father' as const]),'mother',...(guardianHidden?[]:['guardian' as const])];
 const [target,setTarget]=useState<IdentityTarget>(guardianHidden?'mother':'guardian');
 const validTarget=targets.includes(target)?target:targets[0]??'mother';
 const savedDetails=identityDetails(caseFile,validTarget,today);
 const [file,setFile]=useState<File|null>(null);
 const [nationalId,setNationalId]=useState(savedDetails.nationalId);
 const [expiresOn,setExpiresOn]=useState(savedDetails.expiresOn);
 const [birthDate,setBirthDate]=useState(savedDetails.birthDate);
 const [gender,setGender]=useState<MemberGender|null>(savedDetails.gender);
 const [age,setAge]=useState<number|null>(savedDetails.age);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const lastAppliedNationalId=useRef<string|null>(parseEgyptianNationalId(savedDetails.nationalId,today)?.nationalId??null);
 useEffect(()=>{
  const details=identityDetails(caseFile,validTarget,today);
  setNationalId(details.nationalId);setExpiresOn(details.expiresOn);setBirthDate(details.birthDate);setGender(details.gender);setAge(details.age);
  lastAppliedNationalId.current=parseEgyptianNationalId(details.nationalId,today)?.nationalId??null;
 },[caseFile,validTarget,today]);
 function applyId(value:string) {
  const parsed=parseEgyptianNationalId(value,today);
  if(!parsed)return;
  setNationalId(parsed.nationalId);
  if(parsed.nationalId===lastAppliedNationalId.current)return;
  lastAppliedNationalId.current=parsed.nationalId;setExpiresOn('');setBirthDate(parsed.birthDate);setGender(parsed.gender);if(validTarget==='guardian')setAge(parsed.age);
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
  try {validateDocument(file);if(file.type==='application/pdf'){const pdf=await openPdf(file);await pdf.cleanup();}setExpiresOn('');setFile(file);}
  catch {setError('اختار صورة أو PDF صالح، بحد أقصى ٢٠ ميجابايت و٢٠ صفحة.');}
 }
 async function saveAndAttach() {
  setBusy(true);setError('');setMessage('');
  const normalizedId=latinDigits(nationalId.trim());
  if(normalizedId&&!parseEgyptianNationalId(normalizedId,today)){setError('اتأكد إن الرقم القومي ١٤ رقم وتاريخ الميلاد والمحافظة فيه صحيحين.');setBusy(false);return;}
  if(!hasValidNationalIdForExpiry(normalizedId,expiresOn,today)){setError('سجّل رقم قومي صحيح قبل تاريخ انتهاء البطاقة للشخص ده.');setBusy(false);return;}
  try {
   if(validTarget==='guardian')await updateCaseFileIdentity(caseFile.id,normalizedId,expiresOn,{birthDate:birthDate||null,gender,age});
   else await updateCaseParentIdentityProfile(caseFile.id,validTarget,normalizedId,expiresOn,{birthDate:birthDate||null,gender});
  } catch {
   setError('ماعرفناش نحفظ البيانات. راجع الرقم والتاريخ وجرب تاني.');setBusy(false);return;
  }
  let uploadFailed=false;let refreshFailed=false;
  try {if(file)await uploadCaseAttachment(caseFile.id,file);if(file)setFile(null);}catch{uploadFailed=true;}
  try {await onSaved();}catch{refreshFailed=true;}
  if(uploadFailed)setError('اتحفظت بيانات البطاقة، بس ماعرفناش نرفع الملف. ارفعه من مرفقات الحالة.');
  else if(refreshFailed)setError('اتحفظت بيانات البطاقة، بس ماعرفناش نحدّث ملف الحالة. حدّث الصفحة وجرب تاني.');
  else setMessage(file?'اتحفظت بيانات البطاقة والملف في الحالة.':'اتحفظت بيانات البطاقة.');
  setBusy(false);
 }
 const holderName=validTarget==='father'?'الأب':validTarget==='mother'?'الأم':'المسؤول';
 return <section className="section-block family-id-scanner" aria-labelledby="family-id-scan-title">
  <h3 id="family-id-scan-title">قراءة بيانات البطاقة</h3>
  <p className="form-help">اختار صورة أو PDF. القراءة بتحصل على جهازك؛ راجع الرقم والتاريخ بنفسك قبل الحفظ.</p>
  <label>البطاقة تخص مين؟<select aria-label="البطاقة تخص مين؟" value={validTarget} onChange={event=>{setTarget(event.target.value as IdentityTarget);setFile(null);setMessage('');setError('');}}>{targets.map(item=><option key={item} value={item}>{item==='father'?'الأب':item==='mother'?'الأم':'المسؤول عن التربية'}</option>)}</select></label>
  <label>صورة البطاقة أو ملف PDF<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void choose(event.target.files?.[0]??null);event.currentTarget.value='';}} /></label>
  {file&&<FilePreview key={file.name+file.size} file={file} onText={readText}/>}
  <div className="form-grid"><label>الرقم القومي لـ{holderName}<input aria-label="الرقم القومي" inputMode="numeric" maxLength={14} value={nationalId} onChange={event=>{const value=latinDigits(event.target.value);if(normalizeEgyptianNationalIdInput(value)!==lastAppliedNationalId.current)setExpiresOn('');setNationalId(value);applyId(value);}} />{parseEgyptianNationalId(nationalId,today)&&<small className="form-help">المحافظة اللي باينة من الرقم القومي: {parseEgyptianNationalId(nationalId,today)?.governorate} (للمراجعة بس)</small>}</label><label>تاريخ انتهاء البطاقة<input aria-label="تاريخ انتهاء البطاقة" type="date" value={expiresOn} onChange={event=>setExpiresOn(event.target.value)} /></label>
   <label>تاريخ ميلاد {holderName}<input aria-label={`تاريخ ميلاد ${holderName}`} type="date" max={today} value={birthDate} onChange={event=>{setBirthDate(event.target.value);if(validTarget==='guardian')setAge(event.target.value?ageOn(event.target.value,today):null);}} /></label>
   <label>النوع (ذكر أو أنثى)<select aria-label="النوع (ذكر أو أنثى)" value={gender??''} onChange={event=>setGender((event.target.value||null) as MemberGender|null)}><option value="">اختار النوع</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label>
   {validTarget==='guardian'&&<label>سن المسؤول<input aria-label="سن المسؤول" type="number" min="0" max="120" value={age??''} onChange={event=>setAge(event.target.value===''?null:Number(event.target.value))} /></label>}
  </div>
  {message&&<p role="status">{message}</p>}{error&&<p className="error-message" role="alert">{error}</p>}
  <button type="button" disabled={busy||(!nationalId&&!expiresOn)} onClick={()=>void saveAndAttach()}>{busy?'جاري الحفظ…':'مراجعة البيانات وحفظها'}</button>
 </section>;
}
