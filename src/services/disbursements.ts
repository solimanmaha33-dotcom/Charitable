import { getSupabase } from './supabase';
import { cairoToday } from '../shared/cairoDate';

export const DISBURSEMENT_TYPES=['كفالة شهرية','مساعدة موسمية','علاج','عيني','طوارئ'] as const;
export type DisbursementType=typeof DISBURSEMENT_TYPES[number];
export type CaseDisbursement={id:string;case_id:string;branch_id:string;disbursement_type:DisbursementType;amount:number;items_summary:string|null;disbursed_on:string;created_by:string;created_at:string;notes:string|null;is_voided:boolean;void_reason:string|null;voided_at:string|null};
export type NewDisbursement={caseId:string;branchId:string;type:DisbursementType;amount:number;itemsSummary:string;disbursedOn:string;notes:string};
function db(){const client=getSupabase();if(!client)throw new Error('تعذّر الاتصال بقاعدة البيانات');return client;}
function check(error:{message:string}|null){if(error)throw new Error(error.message);}
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}

export async function listCaseDisbursements(caseId:string):Promise<CaseDisbursement[]> {
 const result:CaseDisbursement[]=[];
 for(let start=0;;start+=500){
  const {data,error}=await db().from('case_disbursements').select('id,case_id,branch_id,disbursement_type,amount,items_summary,disbursed_on,created_by,created_at,notes,is_voided,void_reason,voided_at').eq('case_id',caseId).order('disbursed_on',{ascending:false}).order('created_at',{ascending:false}).range(start,start+499);
  check(error);const page=(data??[]) as CaseDisbursement[];result.push(...page);if(page.length<500)return result;
 }
}

export async function recordDisbursement(input:NewDisbursement):Promise<string>{
 if(!input.caseId.trim()||!input.branchId.trim())throw new Error('اختار الحالة والفرع');
 if(!DISBURSEMENT_TYPES.includes(input.type))throw new Error('نوع المساعدة غير صحيح');
 if(!Number.isFinite(input.amount)||input.amount<=0||input.amount>999999999999)throw new Error('المبلغ لازم يكون أكبر من صفر');
 const itemsSummary=input.itemsSummary.trim();if(input.type==='عيني'&&!itemsSummary)throw new Error('اكتب وصف المساعدة العينية');
 const disbursedOn=input.disbursedOn||cairoToday();if(!validDate(disbursedOn))throw new Error('تاريخ الصرف غير صحيح');
 if(input.notes.length>2000||itemsSummary.length>2000)throw new Error('الوصف لازم يكون ٢٠٠٠ حرف أو أقل');
 const {data,error}=await db().rpc('record_case_disbursement',{p_case_id:input.caseId,p_branch_id:input.branchId,p_type:input.type,p_amount:input.amount,p_items_summary:itemsSummary||null,p_disbursed_on:disbursedOn,p_notes:input.notes.trim()||null});
 check(error);if(typeof data!=='string')throw new Error('تعذّر تسجيل المساعدة');return data;
}

export async function voidDisbursement(id:string,reason:string):Promise<void>{
 const normalized=reason.trim();if(!normalized)throw new Error('سبب الإلغاء مطلوب');if(normalized.length>1000)throw new Error('سبب الإلغاء لازم يكون ١٠٠٠ حرف أو أقل');
 const {error}=await db().rpc('void_case_disbursement',{p_id:id,p_reason:normalized});check(error);
}

export type SponsorshipFollowup={paymentId:string;dueDate:string;amount:number;caseId:string;caseCode:string;fatherName:string|null;motherName:string|null;status:'late'|'upcoming';daysUntilDue:number};
export function getSponsorshipFollowups(
 payments:Array<{id:string;sponsorship_id:string;due_date:string;amount_due:number;received_on:string|null;voided_at:string|null}>,
 sponsorships:Array<{id:string;family_id:string}>,
 cases:Array<{id:string;code:string;father_name:string|null;mother_name:string|null}>,today:string,
):SponsorshipFollowup[]{
 const sponsorshipById=new Map(sponsorships.map(item=>[item.id,item]));const caseById=new Map(cases.map(item=>[item.id,item]));
 const todayTime=Date.parse(`${today}T00:00:00Z`);const cutoff=new Date(todayTime+30*86_400_000).toISOString().slice(0,10);
 return payments.filter(payment=>!payment.received_on&&!payment.voided_at&&payment.due_date<=cutoff).flatMap(payment=>{
  const familyId=sponsorshipById.get(payment.sponsorship_id)?.family_id;const caseFile=familyId?caseById.get(familyId):undefined;
  if(!caseFile)return[];const daysUntilDue=Math.round((Date.parse(`${payment.due_date}T00:00:00Z`)-todayTime)/86_400_000);
  return[{paymentId:payment.id,dueDate:payment.due_date,amount:payment.amount_due,caseId:caseFile.id,caseCode:caseFile.code,fatherName:caseFile.father_name,motherName:caseFile.mother_name,status:daysUntilDue<0?'late' as const:'upcoming' as const,daysUntilDue}];
 }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.paymentId.localeCompare(b.paymentId));
}
