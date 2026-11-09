import { useEffect, useState, type FormEvent } from 'react';
import { listBranches, type CaseBranch } from '../../services/branches';
import { DISBURSEMENT_TYPES, recordDisbursement, voidDisbursement, type CaseDisbursement, type DisbursementType } from '../../services/disbursements';
import type { CaseFile } from '../../services/cases';
import { cairoToday } from '../../shared/cairoDate';

const dateLabel=(value:string)=>new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(`${value}T12:00:00`));

export function CaseDisbursementsPanel({caseFile,records,canWrite,onChanged}:{caseFile:CaseFile;records:CaseDisbursement[];canWrite:boolean;onChanged:()=>Promise<void>}){
 const[branches,setBranches]=useState<CaseBranch[]>([]);const[branchId,setBranchId]=useState('');const[type,setType]=useState<DisbursementType>('مساعدة موسمية');const[amount,setAmount]=useState('');const[items,setItems]=useState('');const[date,setDate]=useState(cairoToday);const[notes,setNotes]=useState('');const[reasonById,setReasonById]=useState<Record<string,string>>({});const[openVoid,setOpenVoid]=useState<string|null>(null);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{let active=true;void listBranches().then(rows=>{if(!active)return;setBranches(rows);const match=rows.find(branch=>branch.name===caseFile.branch_area);setBranchId(match?.id??rows[0]?.id??'');}).catch(()=>{if(active)setError('تعذّر تحميل الفروع. حاول تحدّث الصفحة.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[caseFile.branch_area]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await recordDisbursement({caseId:caseFile.id,branchId,type,amount:Number(amount),itemsSummary:items,disbursedOn:date,notes});setAmount('');setItems('');setNotes('');await onChanged();}catch{setError('تعذّر تسجيل المساعدة. راجع المبلغ والفرع وصلاحيتك.');}finally{setBusy(false);}}
 async function voidRecord(event:FormEvent,id:string){event.preventDefault();setBusy(true);setError('');try{await voidDisbursement(id,reasonById[id]??'');setOpenVoid(null);await onChanged();}catch{setError('تعذّر إلغاء المساعدة. لازم تكتب سبب واضح.');}finally{setBusy(false);}}
 return <section className="section-block case-disbursements" aria-labelledby="case-disbursements-title">
  <div className="section-heading"><h2 id="case-disbursements-title">سجل المساعدات المنصرفة</h2><span>{records.length} حركة</span></div>
  <p className="form-help">السجل بيبين المساعدة اللي اتصرفت للحالة. الإلغاء بيحفظ الحركة وسببها في سجل المراجعة.</p>
  {canWrite&&<details className="disbursement-add"><summary>تسجيل مساعدة منصرفة</summary><form className="domain-form" onSubmit={submit}>
    <div className="form-grid"><label>نوع المساعدة<select value={type} onChange={event=>setType(event.target.value as DisbursementType)}>{DISBURSEMENT_TYPES.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>الفرع<select required value={branchId} disabled={loading||!branches.length} onChange={event=>setBranchId(event.target.value)}><option value="">اختار الفرع</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label>المبلغ بالجنيه<input required type="number" min="0.01" step="0.01" max="9999999999.99" value={amount} onChange={event=>setAmount(event.target.value)} /></label>
      {type==='عيني'&&<label>وصف المساعدة العينية<textarea required maxLength={2000} value={items} onChange={event=>setItems(event.target.value)} /></label>}
      <label>تاريخ الصرف<input required type="date" value={date} onChange={event=>setDate(event.target.value)} /></label>
      <label>ملاحظات (اختياري)<textarea maxLength={2000} value={notes} onChange={event=>setNotes(event.target.value)} /></label></div>
    <button disabled={busy||loading||!branchId}>{busy?'جاري التسجيل…':'حفظ المساعدة'}</button>
  </form></details>}
  {error&&<p className="error-message" role="alert">{error}</p>}
  {records.length?<ul className="record-list">{records.map(record=><li key={record.id} className="disbursement-record"><div className="case-summary"><strong>{record.disbursement_type} {record.is_voided&&<span className="status-label status-voided">ملغي</span>}</strong><small>{dateLabel(record.disbursed_on)} · {new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(record.amount)} جنيه{record.items_summary?` · ${record.items_summary}`:''}{record.notes?` · ${record.notes}`:''}</small>{record.is_voided&&<small className="void-reason">سبب الإلغاء: {record.void_reason}</small>}</div>
    {!record.is_voided&&canWrite&&<><button type="button" className="secondary-button" onClick={()=>setOpenVoid(openVoid===record.id?null:record.id)}>{openVoid===record.id?'إلغاء':'إلغاء الحركة'}</button>{openVoid===record.id&&<form className="domain-form void-action-form" onSubmit={event=>void voidRecord(event,record.id)}><label>سبب إلغاء الحركة<textarea required maxLength={1000} value={reasonById[record.id]??''} onChange={event=>setReasonById(current=>({...current,[record.id]:event.target.value}))}/></label><button className="danger" disabled={busy||!(reasonById[record.id]??'').trim()}>{busy?'جاري الإلغاء…':'تأكيد إلغاء الحركة'}</button></form>}</>}
  </li>)}</ul>:<div className="empty-state">لسه مفيش مساعدات منصرفة للحالة دي.</div>}
 </section>;
}
