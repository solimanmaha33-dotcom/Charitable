import { useState, type FormEvent } from 'react';
import { saveFamily, type FamilyProfile, type FamilyProfileInput } from '../../services/cases';

const arabicDigits='٠١٢٣٤٥٦٧٨٩'; const persianDigits='۰۱۲۳۴۵۶۷۸۹';
function latinDigits(value:string) { return [...value].map(digit=>{const a=arabicDigits.indexOf(digit);if(a>=0)return String(a);const p=persianDigits.indexOf(digit);return p>=0?String(p):digit;}).join(''); }

export function FamilyForm({ family, onSaved }: { family?: FamilyProfile; onSaved: (id: string) => void }) {
 const [name,setName]=useState(family?.name ?? '');
 const [contactName,setContactName]=useState(family?.contact_name ?? '');
 const [age,setAge]=useState(family?.contact_age?.toString() ?? '');
 const [nationalId,setNationalId]=useState(family?.national_id ?? '');
 const [phones,setPhones]=useState([family?.phone ?? '',family?.phone_2 ?? '',family?.phone_3 ?? '']);
 const [notes,setNotes]=useState(family?.notes ?? '');
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e: FormEvent) {
  e.preventDefault(); setError('');
  const normalizedAge=latinDigits(age.trim()); const normalizedId=latinDigits(nationalId.trim());
  if(normalizedAge && (!/^\d{1,3}$/.test(normalizedAge) || Number(normalizedAge)>120)){setError('السن لازم يكون من ٠ لحد ١٢٠ سنة.');return;}
  if(normalizedId && !/^\d{14}$/.test(normalizedId)){setError('الرقم القومي لازم يكون ١٤ رقم.');return;}
  const input:FamilyProfileInput={name:name.trim(),contactName:contactName.trim(),contactAge:normalizedAge?Number(normalizedAge):null,nationalId:normalizedId,phones:phones.map(phone=>phone.trim()),notes:notes.trim()};
  setBusy(true);try { onSaved(await saveFamily(family?.id ?? null,input)); } catch { setError('تعذّر حفظ بيانات الأسرة. حاول تاني.'); } finally { setBusy(false); }
 }
 return <form className="domain-form family-form" onSubmit={submit}>
  <section className="form-section"><h2>بيانات الأسرة</h2>
   <label>اسم الأسرة<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} /></label>
   <div className="form-grid"><label>اسم مسؤول الأسرة <span className="muted-cell">(اختياري)</span><input maxLength={200} value={contactName} onChange={e=>setContactName(e.target.value)} /></label>
    <label>سن مسؤول الأسرة <span className="muted-cell">(اختياري)</span><input inputMode="numeric" value={age} onChange={e=>setAge(latinDigits(e.target.value))} /></label>
    <label>الرقم القومي لمسؤول الأسرة <span className="muted-cell">(اختياري)</span><input inputMode="numeric" maxLength={14} value={nationalId} onChange={e=>setNationalId(latinDigits(e.target.value))} /></label></div>
   <div className="form-grid">{phones.map((phone,index)=><label key={index}>رقم التليفون {['١','٢','٣'][index]} <span className="muted-cell">(اختياري)</span><input type="tel" maxLength={40} value={phone} onChange={e=>setPhones(current=>current.map((value,i)=>i===index?e.target.value:value))} /></label>)}</div>
   <label>ملاحظات الأسرة <span className="muted-cell">(اختياري)</span><textarea maxLength={4000} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
  </section>
  <button disabled={busy || !name.trim()}>{busy ? 'جاري الحفظ…' : 'حفظ بيانات الأسرة'}</button>{error && <p className="error-message" role="alert">{error}</p>}
 </form>;
}
