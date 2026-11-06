import { useState, type FormEvent } from 'react';
import { saveSponsorship, utcToday, type Donor } from '../../services/donations';
import type { Family } from '../../services/cases';
export function SponsorshipForm({donors,families,onSaved}:{donors:Donor[];families:Family[];onSaved:()=>Promise<void>}) {
 const [donor,setDonor]=useState('');const [family,setFamily]=useState('');const [amount,setAmount]=useState('');
 const [start,setStart]=useState(utcToday);const [end,setEnd]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent) {
  e.preventDefault();setBusy(true);setError('');
  try {await saveSponsorship({donor_id:donor,family_id:family,monthly_amount:Number(amount),start_date:start,end_date:end||null});setAmount('');await onSaved();}
  catch {setError('تعذّر حفظ الكفالة. راجع البيانات وصلاحية التبرعات وقراءة الحالات.');}finally{setBusy(false);}
 }
 return <form className="domain-form" onSubmit={submit}><h2>إضافة كفالة شهرية</h2>
  <label>متبرع الكفالة<select required value={donor} onChange={e=>setDonor(e.target.value)}><option value="">اختار المتبرع</option>{donors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
  <label>أسرة الكفالة<select required value={family} onChange={e=>setFamily(e.target.value)}><option value="">اختار الأسرة</option>{families.map(f=><option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}</select></label>
  <label>مبلغ الكفالة الشهري (جنيه مصري)<input required type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
  <label>بداية الكفالة<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
  <label>نهاية الكفالة (اختياري)<input type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
  <p>الدفعة في يوم البداية كل شهر، أو آخر يوم للشهر الأقصر. يوم النهاية مشمول.</p>
  <button disabled={busy}>حفظ الكفالة</button>{error?<p role="alert">{error}</p>:null}
 </form>;
}
