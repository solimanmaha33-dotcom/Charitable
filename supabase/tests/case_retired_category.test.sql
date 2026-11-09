begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(id) values ('32000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('42000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values ('52000000-0000-0000-0000-000000000001','RETIREDORPHAN','Retired category writer','employee');
insert into private.employee_auth(employee_id,auth_user_id) values ('52000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('52000000-0000-0000-0000-000000000001',true,true);

insert into public.families(name,phone,notes) values ('retired-category-test','01012345678','retired-category-test');
insert into public.case_file_categories(family_id,category)
select id,'يتيم الأم' from public.families where notes='retired-category-test';

select set_config('request.jwt.claims','{"sub":"32000000-0000-0000-0000-000000000001","session_id":"42000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok(
  $$select public.save_case_file((select id from public.families where notes='retired-category-test'),' {"mother_name":"أم اختبار","phone":"01012345678","notes":"retired-category-test"}'::jsonb,array['أرملة'])$$,
  'saving other categories preserves the retired maternal orphan label'
);
select is(
  (select count(*)::int from public.case_file_categories where family_id=(select id from public.families where notes='retired-category-test') and category='يتيم الأم'),
  1,
  'the historical maternal orphan label remains stored'
);
select lives_ok(
  $$delete from public.case_file_categories where family_id=(select id from public.families where notes='retired-category-test') and category='يتيم الأم'$$,
  'staff removal request for the retired historical label is safely ignored'
);
select is(
  (select count(*)::int from public.case_file_categories where family_id=(select id from public.families where notes='retired-category-test') and category='يتيم الأم'),
  1,
  'the historical label cannot be removed by staff'
);
select throws_ok(
  $$select public.save_case_file(null,'{"mother_name":"أم جديدة","phone":"01012345678"}'::jsonb,array['يتيم الأم'])$$,
  '42501',null,'new files cannot use the retired maternal orphan label'
);
select is(
  (select count(*)::int from public.case_file_categories where category='يتيم الأم'),
  1,
  'rejected new classification does not affect the historical record'
);
select * from finish();
rollback;
