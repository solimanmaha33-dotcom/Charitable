import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listFamilies, type Family } from '../../services/cases';
import { endSponsorship, PaymentAlreadyReceivedError, generateInstallments, listDonations, listDonors, listPayments, listSponsorships, receivePayment, saveDonor, utcToday, type Donation, type Donor, type Sponsorship, type SponsorshipPayment } from '../../services/donations';
import { DonationForm } from './DonationForm';
import { SponsorshipForm } from './SponsorshipForm';
import { donationTypeLabel } from './donationTypes';
import { getSponsorshipStatus } from './sponsorshipStatus';

function CalendarDate({value}:{value:string}) { return <time dateTime={value} dir="ltr" style={{unicodeBidi:'isolate'}}>{value}</time>; }

type Data = {donors:Donor[];donations:Donation[];sponsorships:Sponsorship[];payments:SponsorshipPayment[];families:Family[]};
async function loadData(canReadCases:boolean):Promise<Data> {
 if(canReadCases)await generateInstallments();
 const [donors,donations,sponsorships,payments,families]=await Promise.all([
  listDonors(),listDonations(),canReadCases?listSponsorships():Promise.resolve([]),
  canReadCases?listPayments():Promise.resolve([]),canReadCases?listFamilies():Promise.resolve([]),
 ]);
 return {donors,donations,sponsorships,payments,families};
}
function DonorForm({onSaved}:{onSaved:()=>Promise<void>}) {
 const [name,setName]=useState('');const [phone,setPhone]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await saveDonor(name.trim(),phone.trim());setName('');setPhone('');await onSaved();}catch{setError('تعذّر حفظ المتبرع.');}finally{setBusy(false);}}
 return <form className="domain-form" onSubmit={submit}><h2>إضافة متبرع</h2><label>اسم المتبرع<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label>هاتف المتبرع (اختياري)<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label><button disabled={busy||!name.trim()}>حفظ المتبرع</button>{error?<p role="alert">{error}</p>:null}</form>;
}
function PaymentRow({payment,canWrite,onSaved}:{payment:SponsorshipPayment;canWrite:boolean;onSaved:()=>Promise<void>}) {
 const [date,setDate]=useState(utcToday);const [amount,setAmount]=useState(String(payment.amount_due));const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await receivePayment(payment.id,date,Number(amount));await onSaved();}catch(error){setError(error instanceof PaymentAlreadyReceivedError?error.message:'تعذّر تسجيل الاستلام.');}finally{setBusy(false);}}
 const status=getSponsorshipStatus(payment.due_date,payment.received_on,utcToday());
 const labels={due:'مستحقة',late:'متأخرة',received:'مستلمة'};
 return <li className="installment-row" data-testid={`installment-${payment.installment_month}`}><p><span className={`status-label status-${status}`}>{labels[status]}</span> استحقاق <CalendarDate value={payment.due_date}/> — {payment.amount_due} جنيه مصري</p>
  {payment.received_on?<p>تاريخ الاستلام: <CalendarDate value={payment.received_on}/> — المستلم: {payment.amount_received} جنيه مصري</p>:canWrite?<form className="domain-form" onSubmit={submit}><label>تاريخ استلام الدفعة<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>المبلغ المستلم (جنيه مصري)<input required type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button disabled={busy}>تسجيل الاستلام</button></form>:null}
  {error?<p role="alert">{error}</p>:null}
 </li>;
}
function SponsorshipCard({sponsorship,family,donor,payments,canWrite,onSaved}:{sponsorship:Sponsorship;family:Family|undefined;donor:Donor|undefined;payments:SponsorshipPayment[];canWrite:boolean;onSaved:()=>Promise<void>}) {
 const [end,setEnd]=useState(sponsorship.end_date??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await endSponsorship(sponsorship.id,end||null);await onSaved();}catch{setError('تعذّر حفظ نهاية الكفالة. لا يمكن جعل النهاية قبل دفعة مستلمة.');}finally{setBusy(false);}}
 return <article className="sponsorship-record"><h3>{donor?.name??'متبرع'} — {family?`${family.code} — ${family.name}`:'أسرة غير متاحة'}</h3><p>{sponsorship.monthly_amount} جنيه مصري شهرياً — البداية: <CalendarDate value={sponsorship.start_date}/> — النهاية: {sponsorship.end_date?<CalendarDate value={sponsorship.end_date}/>:'مستمرة'}</p>
  {canWrite?<form className="domain-form" onSubmit={submit}><label>تعديل نهاية الكفالة<input type="date" min={sponsorship.start_date} value={end} onChange={e=>setEnd(e.target.value)}/></label><button disabled={busy}>حفظ نهاية الكفالة</button></form>:null}
  {error?<p role="alert" className="error-message">{error}</p>:null}<ul className="installment-list">{payments.map(p=><PaymentRow key={p.id} payment={p} canWrite={canWrite} onSaved={onSaved}/>)}</ul>
 </article>;
}
export function DonationListPage({canWrite,canReadCases}:{canWrite:boolean;canReadCases:boolean}) {
 const [searchParams]=useSearchParams();
 const [donationFormOpen,setDonationFormOpen]=useState(searchParams.get('add')==='donation');
 const [data,setData]=useState<Data>({donors:[],donations:[],sponsorships:[],payments:[],families:[]});const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [saved,setSaved]=useState('');
 useEffect(()=>{let alive=true;setLoading(true);loadData(canReadCases).then(result=>{if(alive){setData(result);setError('');}}).catch(()=>{if(alive)setError('تعذّر تحميل التبرعات والكفالات.');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[canWrite,canReadCases]);
 async function refresh() {setSaved('تم الحفظ.');try{setData(await loadData(canReadCases));setError('');}catch{setError('تم الحفظ، لكن تعذّر تحديث القائمة. أعد تحميل الصفحة.');}}
 const donors=new Map(data.donors.map(d=>[d.id,d]));const families=new Map(data.families.map(f=>[f.id,f]));
 const payments=new Map<string,SponsorshipPayment[]>();for(const p of data.payments){const group=payments.get(p.sponsorship_id)??[];group.push(p);payments.set(p.sponsorship_id,group);}
 for(const group of payments.values())group.sort((a,b)=>a.due_date.localeCompare(b.due_date));
 return <section className="page-card"><header className="page-heading"><div><h1>التبرعات والكفالات</h1><p>سجّل التبرعات وتابع الكفالات والدفعات الشهرية.</p></div></header>{loading?<p role="status">جاري تحميل البيانات…</p>:null}{saved?<p className="success-message" role="status">{saved}</p>:null}{error?<p className="error-message" role="alert">{error}</p>:null}
  {canWrite?<div className="action-disclosures"><details><summary>إضافة متبرع</summary><DonorForm onSaved={refresh}/></details><details open={donationFormOpen} onToggle={event=>setDonationFormOpen(event.currentTarget.open)}><summary>تسجيل تبرع</summary><DonationForm donors={data.donors} onSaved={refresh}/></details></div>:null}
  <section className="section-block donation-section"><div className="section-heading"><h2>المتبرعون</h2><span>{loading?'جاري التحميل…':error?'تعذّر التحميل':`${data.donors.length} متبرعين`}</span></div>{data.donors.length?<ul className="record-list donor-list">{data.donors.map(d=><li key={d.id}><strong>{d.name}</strong><span className="muted-cell">{d.phone?<bdi dir="ltr">{d.phone}</bdi>:'رقم تليفون مش متسجل'}</span></li>)}</ul>:!loading&&!error?<div className="empty-state">مفيش متبرعين مسجلين لسه.</div>:null}</section>
  <section className="section-block donation-section"><div className="section-heading"><h2>التبرعات المسجلة</h2><span>{loading?'جاري التحميل…':error?'تعذّر التحميل':`${data.donations.length} تبرعات`}</span></div>{data.donations.length?<ul data-testid="donation-list" className="record-list donation-record-list">{data.donations.map(d=><li key={d.id}><div className="case-summary"><strong>{donationTypeLabel(d.donation_type)} — {d.donor_id?donors.get(d.donor_id)?.name:'متبرع غير محدد'}</strong><small><CalendarDate value={d.received_on}/> — {d.kind==='cash'?`${d.amount} جنيه مصري`:`${d.quantity} ${d.unit}`}{d.description ? ` — ${d.description}` : ''}</small></div></li>)}</ul>:!loading&&!error?<div className="empty-state">مفيش تبرعات مسجلة لسه.</div>:null}</section>
  <section className="section-block donation-section"><div className="section-heading"><h2>الكفالات الشهرية</h2><span>{!canReadCases?'غير متاح':loading?'جاري التحميل…':error?'تعذّر التحميل':`${data.sponsorships.length} كفالات`}</span></div>
  <p className="form-help">الدفعة بتظهر متأخرة بعد يوم الاستحقاق، وبتفضل مستلمة بعد تسجيلها.</p>
  {!canReadCases?<p>عدد الكفالات مش متاح من غير صلاحية قراءة الحالات. اطلب من المدير يفعّلها لحسابك.</p>:<>
   {canWrite?<details className="sponsorship-add"><summary>إضافة كفالة شهرية</summary><SponsorshipForm donors={data.donors} families={data.families} onSaved={refresh}/></details>:null}
   {data.sponsorships.length?data.sponsorships.map(s=><SponsorshipCard key={s.id} sponsorship={s} donor={donors.get(s.donor_id)} family={families.get(s.family_id)} payments={payments.get(s.id)??[]} canWrite={canWrite} onSaved={refresh}/>):!loading&&!error?<div className="empty-state">مفيش كفالات شهرية مسجلة لسه.</div>:null}</>}
  </section></section>;
}
