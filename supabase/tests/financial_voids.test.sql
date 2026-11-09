begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public','donations','voided_at','donations can be canceled without deleting history');
select has_column('public','donations','voided_by','donation cancellation records the staff member');
select has_column('public','donations','void_reason','donation cancellation requires a reason');
select has_column('public','sponsorship_payments','voided_at','installments can be voided without deleting history');
select has_table('private','financial_action_audit','financial reversals have an audit log');
select has_table('public','case_disbursements','case aid payments are stored in their own ledger');
select has_column('public','families','next_review_date','case files can have a re-evaluation date');
select ok(has_column_privilege('authenticated','public.families','next_review_date','INSERT'), 'case-save permission includes the review date');
select ok(has_column_privilege('authenticated','public.families','next_review_date','UPDATE'), 'case-update permission includes the review date');

insert into auth.users(id) values
 ('b3000000-0000-0000-0000-000000000001'),('b3000000-0000-0000-0000-000000000002'),('b3000000-0000-0000-0000-000000000003');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('b4000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001',now(),now()),
 ('b4000000-0000-0000-0000-000000000002','b3000000-0000-0000-0000-000000000002',now(),now()),
 ('b4000000-0000-0000-0000-000000000003','b3000000-0000-0000-0000-000000000003',now(),now());
insert into public.employees(id,employee_code,display_name) values
 ('b5000000-0000-0000-0000-000000000001','VOID1','Void writer'),
 ('b5000000-0000-0000-0000-000000000002','VOID2','No case access'),
 ('b5000000-0000-0000-0000-000000000003','VOID3','Cases only');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('b5000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001'),
 ('b5000000-0000-0000-0000-000000000002','b3000000-0000-0000-0000-000000000002'),
 ('b5000000-0000-0000-0000-000000000003','b3000000-0000-0000-0000-000000000003');
insert into public.employee_permissions(employee_id,donations_read,donations_write,cases_read,cases_write) values
 ('b5000000-0000-0000-0000-000000000001',true,true,true,false),
 ('b5000000-0000-0000-0000-000000000002',true,true,false,false),
 ('b5000000-0000-0000-0000-000000000003',false,false,true,true);
insert into public.families(id,name,phone) values ('b6000000-0000-0000-0000-000000000001','ملف اختبار الإلغاء','01012345678');
insert into public.donors(id,name) values ('b7000000-0000-0000-0000-000000000001','متبرع اختبار الإلغاء');
insert into public.donations(id,donor_id,donation_type,kind,amount,received_on) values
 ('b7100000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001','cash','cash',150,'2026-01-01'),
 ('b7100000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000001','cash','cash',200,'2026-01-02');
insert into public.sponsorships(id,donor_id,family_id,monthly_amount,start_date) values
 ('b8000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001',300,'2026-01-01');
select set_config('test.upcoming_sponsorship_start',(
 case when (date_trunc('month',(statement_timestamp() at time zone 'Africa/Cairo')::date)+interval '1 month')::date <= (statement_timestamp() at time zone 'Africa/Cairo')::date+30
 then (date_trunc('month',(statement_timestamp() at time zone 'Africa/Cairo')::date)+interval '1 month')::date
 else (statement_timestamp() at time zone 'Africa/Cairo')::date+15 end
)::text,true);
insert into public.sponsorships(id,donor_id,family_id,monthly_amount,start_date) values
 ('b8000000-0000-0000-0000-000000000002','b7000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001',400,current_setting('test.upcoming_sponsorship_start')::date);
insert into public.sponsorship_payments(id,sponsorship_id,installment_month,due_date,amount_due,received_on,amount_received) values
 ('b8100000-0000-0000-0000-000000000001','b8000000-0000-0000-0000-000000000001','2026-01-01','2026-01-01',300,'2026-01-10',300),
 ('b8100000-0000-0000-0000-000000000002','b8000000-0000-0000-0000-000000000001','2026-02-01','2026-02-01',300,null,null);

select set_config('request.jwt.claims','{"sub":"b3000000-0000-0000-0000-000000000001","session_id":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.cancel_donation('b7100000-0000-0000-0000-000000000001','   ')$$,'23514',null,'blank cancellation reason rejected');
select lives_ok($$select public.cancel_donation('b7100000-0000-0000-0000-000000000001','تم تسجيله بالخطأ')$$,'donation can be canceled with a reason');
select is((select voided_by::text||':'||void_reason from public.donations where id='b7100000-0000-0000-0000-000000000001'),'b5000000-0000-0000-0000-000000000001:تم تسجيله بالخطأ','cancellation stores the actor and reason');
select is((select count(*)::int from public.donations where voided_at is null),1,'active donation count excludes canceled donations');
select throws_ok($$select public.cancel_donation('b7100000-0000-0000-0000-000000000001','إلغاء تاني')$$,'23514',null,'donation cannot be canceled twice');
select lives_ok($$select public.void_sponsorship_payment('b8100000-0000-0000-0000-000000000001','الدفعة اتسجلت مرتين')$$,'received installment can be voided without changing its receipt');
select is((select void_reason from public.sponsorship_payments where id='b8100000-0000-0000-0000-000000000001'),'الدفعة اتسجلت مرتين','void reason stays on the installment');
select lives_ok($$select public.void_sponsorship_payment('b8100000-0000-0000-0000-000000000002','الاستحقاق اتلغى')$$,'unreceived installment can also be voided');
select throws_ok($$update public.sponsorship_payments set received_on='2026-02-10',amount_received=300 where id='b8100000-0000-0000-0000-000000000002'$$,'23514',null,'a voided installment cannot later be received');
reset role;
select lives_ok($$update public.sponsorships set end_date='2026-01-31' where id='b8000000-0000-0000-0000-000000000001'$$,'ending a sponsorship preserves its canceled installment history');
select is((select count(*)::int from public.sponsorship_payments where id='b8100000-0000-0000-0000-000000000002'),1,'a canceled unpaid installment is not deleted by the end-date trigger');
set local role authenticated;
select lives_ok($$select public.generate_sponsorship_installments((statement_timestamp() at time zone 'Africa/Cairo')::date+30)$$,'readers can materialize expected installments 30 days ahead');
select is((select count(*)::int from public.sponsorship_payments where sponsorship_id='b8000000-0000-0000-0000-000000000002' and due_date=current_setting('test.upcoming_sponsorship_start')::date),1,'a next-month installment within 30 days appears for reminders');
select throws_ok($$select public.generate_sponsorship_installments((statement_timestamp() at time zone 'Africa/Cairo')::date+31)$$,'23514',null,'installment generation cannot exceed its 30-day horizon');
reset role;
select is((select count(*)::int from private.financial_action_audit),3,'donation and installment reversals create audit events');
set local role authenticated;
select throws_ok($$update public.donations set void_reason='تغيير' where id='b7100000-0000-0000-0000-000000000001'$$,'42501',null,'staff cannot edit cancellation fields directly');
select throws_ok($$update public.sponsorship_payments set void_reason='تغيير' where id='b8100000-0000-0000-0000-000000000001'$$,'42501',null,'staff cannot edit payment void fields directly');
reset role;
select throws_ok($$update private.financial_action_audit set reason='تغيير'$$,'42501',null,'financial audit does not allow changes');

select set_config('request.jwt.claims','{"sub":"b3000000-0000-0000-0000-000000000002","session_id":"b4000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.void_sponsorship_payment('b8100000-0000-0000-0000-000000000001','سبب كافي')$$,'42501',null,'payment void needs case read permission');
reset role;
select set_config('request.jwt.claims','{"sub":"b3000000-0000-0000-0000-000000000003","session_id":"b4000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.cancel_donation('b7100000-0000-0000-0000-000000000002','سبب كافي')$$,'42501',null,'case permissions alone cannot cancel donations');
select set_config('test.review_case_id',public.save_case_file(null,'{"mother_name":"أم ميعاد المتابعة","phone":"01012345670","next_review_date":"2026-12-01"}'::jsonb,array[]::text[])::text,true);
select is((select next_review_date::text from public.families where id=current_setting('test.review_case_id')::uuid),'2026-12-01','new case stores its review date');
select lives_ok($$select public.save_case_file(current_setting('test.review_case_id')::uuid,'{"mother_name":"أم ميعاد المتابعة","phone":"01012345670"}'::jsonb,null)$$,'an older client that omits the date preserves the saved review date');
select is((select next_review_date::text from public.families where id=current_setting('test.review_case_id')::uuid),'2026-12-01','omitted review date is preserved');
select lives_ok($$select public.save_case_file(current_setting('test.review_case_id')::uuid,'{"mother_name":"أم ميعاد المتابعة","phone":"01012345670","next_review_date":""}'::jsonb,null)$$,'staff can clear the review date explicitly');
select is((select next_review_date from public.families where id=current_setting('test.review_case_id')::uuid),null::date,'cleared review date stays empty');

select lives_ok($$select public.record_case_disbursement(
 'b6000000-0000-0000-0000-000000000001',
 (select id from public.case_branches where name='القاهرة - المرج' and is_active limit 1),
 'مساعدة موسمية',500,null,'2026-11-09','مساعدة للاختبار')$$,'case writer can record a payout to a valid active branch');
select is((select count(*)::int from public.case_disbursements where case_id='b6000000-0000-0000-0000-000000000001' and not is_voided),1,'recorded aid is visible in the case ledger');
select throws_ok($$select public.void_case_disbursement((select id from public.case_disbursements limit 1),'   ')$$,'23514',null,'blank payout cancellation reason rejected');
select lives_ok($$select public.void_case_disbursement((select id from public.case_disbursements limit 1),'اتسجل بالغلط')$$,'case writer can reverse a payout with a reason');
select throws_ok($$insert into public.case_disbursements(case_id,branch_id,disbursement_type,amount,disbursed_on,created_by) values('b6000000-0000-0000-0000-000000000001',(select id from public.case_branches where is_active limit 1),'علاج',50,'2026-11-09','b5000000-0000-0000-0000-000000000003')$$,'42501',null,'staff cannot bypass the audited payout RPC');
reset role;
select is((select count(*)::int from private.financial_action_audit),4,'payout reversal is also written to audit trail');

select * from finish();
rollback;
