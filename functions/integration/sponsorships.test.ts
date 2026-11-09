import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {receivePayment} from '../../src/services/donations';
let admin:SupabaseClient,writer:SupabaseClient,reader:SupabaseClient;
let familyId='',donorId='',sponsorshipId='',paymentId='';const users:string[]=[];
vi.mock('../../src/services/supabase',()=>({getSupabase:()=>writer}));
const sql=(input:string)=>execFileSync('docker',['exec','-i','supabase_db_charitable-case-system','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']});
beforeAll(async()=>{
 const s=JSON.parse(execFileSync('npx',['supabase','status','-o','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe']}));if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL))throw new Error('Local only');
 admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const writable of [true,false]) {
  const email=`${crypto.randomUUID()}@staff.invalid`,password='synthetic-password-123';const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error||!u.data.user)throw u.error;const id=u.data.user.id;users.push(id);
  sql(`insert into public.employees(id,employee_code,display_name) values('${id}','R${id.slice(0,8)}','Synthetic receipts'); insert into private.employee_auth values('${id}','${id}');insert into public.employee_permissions(employee_id,donations_read,donations_write,cases_read) values('${id}',true,${writable},true);`);
  const client=createClient(s.API_URL,s.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;if(writable)writer=client;else reader=client;
 }
 const f=await admin.from('families').insert({name:'أسرة اختبار استلام وهمية',mother_name:'أم وهمية',phone:'01012345678'}).select('id').single();if(f.error)throw f.error;familyId=f.data.id;
 const d=await admin.from('donors').insert({name:'متبرع اختبار استلام وهمي'}).select('id').single();if(d.error)throw d.error;donorId=d.data.id;
 const sp=await admin.from('sponsorships').insert({family_id:familyId,donor_id:donorId,monthly_amount:450,start_date:'2024-01-31'}).select('id').single();if(sp.error)throw sp.error;sponsorshipId=sp.data.id;
});
afterAll(async()=>{
 if(sponsorshipId){await admin.from('sponsorship_payments').delete().eq('sponsorship_id',sponsorshipId);await admin.from('sponsorships').delete().eq('id',sponsorshipId);}if(donorId)await admin.from('donors').delete().eq('id',donorId);if(familyId)await admin.from('families').delete().eq('id',familyId);
 for(const id of users){sql(`delete from private.employee_auth where employee_id='${id}';delete from public.employees where id='${id}';`);await admin.auth.admin.deleteUser(id);}
});
it('read-only staff materialize January and February without a writer visit',async()=>{
 for(const through of ['2024-01-31','2024-02-29']){const generated=await reader.rpc('generate_sponsorship_installments',{p_through:through});expect(generated.error).toBeNull();}
 const rows=await reader.from('sponsorship_payments').select('*').eq('sponsorship_id',sponsorshipId).order('due_date');expect(rows.error).toBeNull();expect(rows.data?.map(p=>[p.due_date,p.amount_due,p.received_on,p.amount_received])).toEqual([['2024-01-31',450,null,null],['2024-02-29',450,null,null]]);paymentId=rows.data![0].id;
});
it('concurrent service submissions yield one saved receipt and one clear conflict',async()=>{
 // An admin-created unpaid fixture keeps this test independent of read-generation implementation.
 if(!paymentId){const p=await admin.from('sponsorship_payments').insert({sponsorship_id:sponsorshipId,installment_month:'2024-01-01',due_date:'2024-01-31',amount_due:450}).select('id').single();if(p.error)throw p.error;paymentId=p.data.id;}
 const results=await Promise.allSettled([receivePayment(paymentId,'2024-02-10',450),receivePayment(paymentId,'2024-02-11',500)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const loser=results.find(r=>r.status==='rejected');expect(loser?.status==='rejected'&&loser.reason.code).toBe('PAYMENT_ALREADY_RECEIVED');
 const row=await writer.from('sponsorship_payments').select('received_on,amount_received').eq('id',paymentId).single();expect(row.error).toBeNull();expect([['2024-02-10',450],['2024-02-11',500]]).toContainEqual([row.data?.received_on,row.data?.amount_received]);
 const saved=row.data;
 for(const patch of [{received_on:null,amount_received:null},{received_on:'2024-02-12'},{amount_received:999}]){const changed=await writer.from('sponsorship_payments').update(patch).eq('id',paymentId);expect(changed.error?.code).toBe('23514');}
 expect((await writer.from('sponsorship_payments').select('received_on,amount_received').eq('id',paymentId).single()).data).toEqual(saved);
});
