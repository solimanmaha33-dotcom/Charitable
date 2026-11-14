begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values ('35000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('45000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values ('55000000-0000-0000-0000-000000000001','EXPQUERY','Expiry query writer','employee');
insert into private.employee_auth(employee_id,auth_user_id) values ('55000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('55000000-0000-0000-0000-000000000001',true,true);

select has_function('public','list_case_file_id_expirations',array['date'],'ID expiry reminders use a database query that can reject invalid legacy IDs');
select set_config('request.jwt.claims','{"sub":"35000000-0000-0000-0000-000000000001","session_id":"45000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.valid_case',public.save_case_file(null,'{"mother_name":"أم ببطاقة صحيحة","phone":"01012345678","mother_national_id":"29001011234567"}'::jsonb,array['أخرى'])::text,true);
select lives_ok($$select public.update_case_parent_identity_profile(current_setting('test.valid_case')::uuid,'mother','29001011234567','2027-01-01','1990-01-01','female')$$,'the valid identity expiry is saved');
select is((select count(*)::int from public.list_case_file_id_expirations('2027-01-31') where id=current_setting('test.valid_case')::uuid),1,'a matching valid identity appears in reminders');

select set_config('test.legacy_case',public.save_case_file(null,'{"father_name":"أب صالح","mother_name":"أم بلا بطاقة","phone":"01012345679","father_national_id":"28001011234567"}'::jsonb,array['أخرى'])::text,true);
reset role;
set local session_replication_role = replica;
update public.families set mother_national_id_expires_on='2027-01-02' where id=current_setting('test.legacy_case')::uuid;
set local session_replication_role = origin;
set local role authenticated;
select is((select count(*)::int from public.list_case_file_id_expirations('2027-01-31') where id=current_setting('test.legacy_case')::uuid),0,'a legacy expiry without a matching ID is hidden from reminders');

reset role;
select * from finish();
rollback;
