begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values ('34000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('44000000-0000-0000-0000-000000000001','34000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values ('54000000-0000-0000-0000-000000000001','EXPIRY1','Expiry guard writer','employee');
insert into private.employee_auth(employee_id,auth_user_id) values ('54000000-0000-0000-0000-000000000001','34000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('54000000-0000-0000-0000-000000000001',true,true);

select set_config('request.jwt.claims','{"sub":"34000000-0000-0000-0000-000000000001","session_id":"44000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.case_id',public.save_case_file(null,'{"father_name":"أب الاختبار","mother_name":"أم الاختبار","phone":"01012345678","father_national_id":"28001011234567"}'::jsonb,array['أخرى'])::text,true);

select throws_ok(format('update public.families set mother_national_id_expires_on=%L where id=%L','2027-01-01',current_setting('test.case_id')::uuid),'23514',null,'a parent expiry cannot be saved without the same parent ID');
select throws_ok(format('update public.families set national_id=%L,national_id_expires_on=%L where id=%L','','2027-01-01',current_setting('test.case_id')::uuid),'23514',null,'a blank identity cannot satisfy the expiry requirement');
select throws_ok($$select public.update_case_file_identity_profile(current_setting('test.case_id')::uuid,null,'2027-01-01',null,null,null)$$,'23514',null,'the guardian identity RPC cannot save expiry without a guardian ID');
select throws_ok($$select public.update_case_parent_identity_profile(current_setting('test.case_id')::uuid,'mother',null,'2027-01-01',null,null)$$,'23514',null,'the parent identity RPC cannot save expiry without that parent ID');
select lives_ok($$select public.update_case_parent_identity_profile(current_setting('test.case_id')::uuid,'mother','29001011234567','2027-01-01','1990-01-01','female')$$,'a valid parent ID and expiry can be saved together');
select throws_ok(format('update public.families set mother_national_id=null where id=%L',current_setting('test.case_id')::uuid),'23514',null,'a saved ID cannot be cleared while its expiry date remains');

reset role;
select * from finish();
rollback;
