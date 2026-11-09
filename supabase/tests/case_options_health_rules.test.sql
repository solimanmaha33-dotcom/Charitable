begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(id) values ('33000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values ('53000000-0000-0000-0000-000000000001','OPTIONSWRITER','Options writer','employee');
insert into private.employee_auth(employee_id,auth_user_id) values ('53000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('53000000-0000-0000-0000-000000000001',true,true);
insert into public.families(name,phone,notes) values
 ('options-case-one','01012345678','options-case-one'),
 ('options-case-two','01098765432','options-case-two');

select set_config('request.jwt.claims','{"sub":"33000000-0000-0000-0000-000000000001","session_id":"43000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok(
  $$select public.save_case_file((select id from public.families where notes='options-case-one'),'{"mother_name":"أم اختبار","phone":"01012345678","notes":"options-case-one"}'::jsonb,array['أخرى','هجر'])$$,
  'other is available and may be combined with a nonexclusive category'
);
select is((select count(*)::int from public.case_file_categories where family_id=(select id from public.families where notes='options-case-one')),2,'both valid category labels are stored');
select throws_ok(
  $$select public.save_case_file((select id from public.families where notes='options-case-one'),'{"notes":"options-case-one"}'::jsonb,array['هجر','أرملة'])$$,
  '23514',null,'the save RPC rejects conflicting marital categories'
);
select is((select count(*)::int from public.case_file_categories where family_id=(select id from public.families where notes='options-case-one')),2,'rejected status combination leaves saved categories intact');
select lives_ok(
  $$select public.save_case_file((select id from public.families where notes='options-case-one'),' {"mother_name":"أم اختبار","phone":"01012345678","notes":"options-case-one","father_health_status":"حالة مستقرة","mother_health_status":"عجز / إعاقة","mother_health_condition":"إعاقة حركية"}'::jsonb,null)$$,
  'the parents accept the new health labels'
);
select is((select to_jsonb(f)->>'father_health_status' from public.families f where notes='options-case-one'),'حالة مستقرة','stable status uses the requested label');
select is((select to_jsonb(f)->>'mother_health_status' from public.families f where notes='options-case-one'),'عجز / إعاقة','disability status uses the requested label');
select lives_ok(
  $$select public.add_family_member_profile((select id from public.families where notes='options-case-one'),'فرد اختبار','ابن','male','2015-01-01','عجز / إعاقة','إعاقة حركية')$$,
  'a family member accepts the new disability label'
);
select is((select to_jsonb(p)->>'health_status' from public.people p where name='فرد اختبار'),'عجز / إعاقة','individual health status uses the requested label');
select throws_ok($$update public.families set father_health_status='مستقرة' where notes='options-case-one'$$,'23514',null,'the retired stable label is rejected');
select lives_ok($$insert into public.case_file_categories(family_id,category) select id,'هجر' from public.families where notes='options-case-two'$$,'direct category insertion accepts the first marital status');
select throws_ok($$insert into public.case_file_categories(family_id,category) select id,'مطلقة' from public.families where notes='options-case-two'$$,'23514',null,'direct category insertion cannot bypass marital status exclusivity');
select is((select count(*)::int from public.case_file_categories where family_id=(select id from public.families where notes='options-case-two') and category in ('هجر','أرملة','مطلقة')),1,'only one marital status remains on the case');
select * from finish();
rollback;
