import { useState, type FormEvent } from 'react';
import { saveDonation, utcToday, type Donor } from '../../services/donations';
import { donationTypes } from './donationTypes';
export function DonationForm({donors,onSaved}:{donors:Donor[];onSaved:()=>Promise<void>}) {
 const [donor,setDonor]=useState('');const [type,setType]=useState('cash');const [kind,setKind]=useState<'cash'|'in_kind'>('cash');
 const [amount,setAmount]=useState('');const [quantity,setQuantity]=useState('');const [unit,setUnit]=useState('');const [description,setDescription]=useState('');
 const [date,setDate]=useState(utcToday);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent) {
  e.preventDefault();setBusy(true);setError('');
  try {await saveDonation({donor_id:donor||null,donation_type:type,kind,amount:kind==='cash'?Number(amount):null,quantity:kind==='in_kind'?Number(quantity):null,unit:kind==='in_kind'?unit.trim():null,description:description.trim(),received_on:date});setAmount('');setQuantity('');setDescription('');await onSaved();}
  catch {setError('تعذّر حفظ التبرع. راجع البيانات والصلاحيات وحاول تاني.');}finally{setBusy(false);}
 }
 return <form className="domain-form" onSubmit={submit}><h2>تسجيل تبرع</h2>
  <label>متبرع التبرع<select value={donor} onChange={e=>setDonor(e.target.value)}><option value="">غير محدد</option>{donors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
  <label>نوع التبرع<select value={type} onChange={e=>setType(e.target.value)}>{donationTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <label>شكل التبرع<select value={kind} onChange={e=>setKind(e.target.value as 'cash'|'in_kind')}><option value="cash">نقدي</option><option value="in_kind">عيني</option></select></label>
  {kind==='cash'?<label>مبلغ التبرع (جنيه مصري)<input required type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>:<>
   <label>الكمية<input required type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <label>الوحدة<input required maxLength={100} value={unit} onChange={e=>setUnit(e.target.value)}/></label></>}
  <label>وصف الأصناف<input required={kind==='in_kind'} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
  <label>تاريخ التبرع<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  <button disabled={busy}>حفظ التبرع</button>{error?<p role="alert">{error}</p>:null}
 </form>;
}
