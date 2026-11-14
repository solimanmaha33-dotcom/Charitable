begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
 ('33000000-0000-0000-0000-000000000001'),('33000000-0000-0000-0000-000000000002'),
 ('33000000-0000-0000-0000-000000000003');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now(),now()),
 ('43000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000002',now(),now()),
 ('43000000-0000-0000-0000-000000000003','33000000-0000-0000-0000-000000000003',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('53000000-0000-0000-0000-000000000001','GUARD1','Guard test one','employee'),
 ('53000000-0000-0000-0000-000000000002','GUARD2','Guard test two','employee'),
 ('53000000-0000-0000-0000-000000000003','GUARD3','Guard test three','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('53000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001'),
 ('53000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000002'),
 ('53000000-0000-0000-0000-000000000003','33000000-0000-0000-0000-000000000003');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('53000000-0000-0000-0000-000000000001',true,true),
 ('53000000-0000-0000-0000-000000000002',true,true),
 ('53000000-0000-0000-0000-000000000003',true,true);

select set_config('request.jwt.claims','{"sub":"33000000-0000-0000-0000-000000000001","session_id":"43000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.conflict_case',public.save_case_file(null,'{"mother_name":"أم التناقض","phone":"01012345678","mother_national_id":"29001011234567"}'::jsonb,array['هجر'])::text,true);
select set_config('request.jwt.claims','{"sub":"33000000-0000-0000-0000-000000000002","session_id":"43000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select set_config('test.hidden_parent_case',public.save_case_file(null,'{"father_name":"أب ظاهر","mother_name":"أم الاختبار","phone":"01012345679","father_national_id":"28001011234567","mother_national_id":"29001011234567"}'::jsonb,array['أخرى'])::text,true);
select set_config('request.jwt.claims','{"sub":"33000000-0000-0000-0000-000000000003","session_id":"43000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select set_config('test.child_case',public.save_case_file(null,'{"mother_name":"أم الطفل","phone":"01012345670","mother_national_id":"29001011234567"}'::jsonb,array['أخرى'])::text,true);
select public.add_case_member_profile(current_setting('test.child_case')::uuid,'طفل يتيم','ابن','male','2015-01-01',null,null,'طفل',null,null,'يتيم الأب');

set constraints case_category_consistency_categories,case_category_consistency_family_profile,case_category_consistency_child_status immediate;
select throws_ok(format('insert into public.case_file_categories(family_id,category) values (%L,''أرملة'')',current_setting('test.conflict_case')::uuid),'23514',null,'direct category writes cannot combine deserted and widow cases');
select throws_ok(format('insert into public.case_file_categories(family_id,category) values (%L,''أرملة'')',current_setting('test.hidden_parent_case')::uuid),'23514',null,'direct category writes cannot leave father details in a widow case');
select throws_ok(format('delete from public.case_file_categories where family_id=%L and category=''أخرى''',current_setting('test.child_case')::uuid),'23514',null,'direct category deletion cannot orphan child father-status data');
select lives_ok(format('update public.families set notes=''تحديث عادي'' where id=%L',current_setting('test.child_case')::uuid),'valid case data can still be updated with a case category');

reset role;
select * from finish();
rollback;
