begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id) values ('32000000-0000-0000-0000-000000000001'),('32000000-0000-0000-0000-000000000002');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('42000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001',now(),now()),
 ('42000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000002',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('52000000-0000-0000-0000-000000000001','CONTACTW','Contact writer','employee'),
 ('52000000-0000-0000-0000-000000000002','CONTACTN','No permission','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('52000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001'),
 ('52000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000002');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('52000000-0000-0000-0000-000000000001',true,true);

select set_config('request.jwt.claims','{"sub":"32000000-0000-0000-0000-000000000001","session_id":"42000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.save_case_file(null,'{"mother_name":"أم اختبار","phone":"01012345678","address":"عنوان الاختبار"}'::jsonb,null)$$,'direct RPC saves a profile with one valid mobile');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم بدون هاتف"}'::jsonb,null)$$,'23514',null,'direct RPC rejects an empty phone set');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم","phone":"0101234567"}'::jsonb,null)$$,'23514',null,'direct RPC rejects a short mobile');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم","phone_2":"01012345678","phone_3":"123456789"}'::jsonb,null)$$,'23514',null,'direct RPC rejects a short home phone');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم","phone":"01012345678","national_id":"123"}'::jsonb,null)$$,'23514',null,'direct RPC rejects an invalid guardian national ID');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم","phone":"01012345678","monthly_income":1000.5}'::jsonb,null)$$,'23514',null,'direct RPC rejects fractional monthly income');
select throws_ok($$insert into public.families(name,phone) values ('direct insert without contact',null)$$,'23514',null,'direct table insert cannot bypass the phone requirement');
select set_config('test.case_id',public.save_case_file(null,'{"mother_name":"أم بياناتها محفوظة","phone":"01098765432","national_id":"29001011234567","address":"عنوان أصلي"}'::jsonb,null)::text,true);
select lives_ok($$select public.update_case_file_identity(current_setting('test.case_id')::uuid,'29001011234568','2027-01-01')$$,'identity scanner can update ID dates without resaving contact fields');
select is((select phone from public.families where id=current_setting('test.case_id')::uuid),'01098765432','identity update preserves the saved phone');
select is((select address from public.families where id=current_setting('test.case_id')::uuid),'عنوان أصلي','identity update preserves the rest of the profile');
select throws_ok($$select public.update_case_file_identity(current_setting('test.case_id')::uuid,'123','2027-01-01')$$,'23514',null,'identity RPC rejects a short ID');
reset role;
select * from finish();
rollback;
