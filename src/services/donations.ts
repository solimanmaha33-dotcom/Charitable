import { getSupabase } from './supabase';
export type Donor = {id:string;name:string;phone:string|null};
export type Donation = {id:string;donor_id:string|null;donation_type:string;kind:'cash'|'in_kind';amount:number|null;quantity:number|null;unit:string|null;description:string;received_on:string};
export type Sponsorship = {id:string;donor_id:string;family_id:string;monthly_amount:number;start_date:string;end_date:string|null};
export type SponsorshipPayment = {id:string;sponsorship_id:string;installment_month:string;due_date:string;amount_due:number;received_on:string|null;amount_received:number|null};
function db() { const client=getSupabase(); if(!client)throw new Error('تعذّر الاتصال بقاعدة البيانات');return client; }
function check(error:{message:string}|null) {if(error)throw new Error(error.message);}
async function list<T>(table:string,columns:string):Promise<T[]> {
 const rows:T[]=[];
 for(let start=0;;start+=500) {
  const {data,error}=await db().from(table).select(columns).order('id').range(start,start+499);check(error);
  const page=(data??[]) as T[];rows.push(...page);if(page.length<500)return rows;
 }
}
export const listDonors=()=>list<Donor>('donors','id,name,phone');
export const listDonations=()=>list<Donation>('donations','id,donor_id,donation_type,kind,amount,quantity,unit,description,received_on');
export const listSponsorships=()=>list<Sponsorship>('sponsorships','id,donor_id,family_id,monthly_amount,start_date,end_date');
export const listPayments=()=>list<SponsorshipPayment>('sponsorship_payments','id,sponsorship_id,installment_month,due_date,amount_due,received_on,amount_received');
export async function saveDonor(name:string,phone:string) {
 const {error}=await db().from('donors').insert({name,phone:phone||null});check(error);
}
export async function saveDonation(donation:Omit<Donation,'id'>) {
 const {error}=await db().from('donations').insert(donation);check(error);
}
export async function saveSponsorship(sponsorship:Omit<Sponsorship,'id'>) {
 const {error}=await db().from('sponsorships').insert(sponsorship);check(error);
}
export function utcToday() { return new Date().toISOString().slice(0,10); }
export async function generateInstallments() {
 const now=new Date(); const through=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);
 const {error}=await db().rpc('generate_sponsorship_installments',{p_through:through});check(error);
}
export class PaymentAlreadyReceivedError extends Error {
 readonly code='PAYMENT_ALREADY_RECEIVED';
 constructor(){super('الدفعة اتسجل استلامها بالفعل. أعد تحميل الصفحة لعرض الاستلام المحفوظ.');}
}
export async function receivePayment(id:string,receivedOn:string,amount:number) {
 const {data,error}=await db().from('sponsorship_payments').update({received_on:receivedOn,amount_received:amount}).eq('id',id).is('received_on',null).select('id').maybeSingle();check(error);if(!data)throw new PaymentAlreadyReceivedError();
}
export async function endSponsorship(id:string,endDate:string|null) {
 const {data,error}=await db().from('sponsorships').update({end_date:endDate}).eq('id',id).select('id').single();check(error);if(!data)throw new Error('تعذّر حفظ النهاية');
}
