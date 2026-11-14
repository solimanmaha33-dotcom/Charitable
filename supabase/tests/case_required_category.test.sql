begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values ('36000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values ('46000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values ('56000000-0000-0000-0000-000000000001','REQCAT','Category test','employee');
insert into private.employee_auth(employee_id,auth_user_id) values ('56000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values ('56000000-0000-0000-0000-000000000001',true,true);
create function pg_temp.reject_case_without_category() returns void language plpgsql as $$
begin
  perform public.save_case_file(null,'{"mother_name":"أم بلا تصنيف","phone":"01012345678","mother_national_id":"29001011234567","mother_date_of_birth":"1990-01-01"}'::jsonb,array[]::text[]);
  set constraints case_file_requires_category_family immediate;
end
$$;

select set_config('request.jwt.claims','{"sub":"36000000-0000-0000-0000-000000000001","session_id":"46000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok(
  $$select pg_temp.reject_case_without_category()$$,
  '23514',null,'a new case file requires at least one category'
);
select set_config('test.categorized_case',public.save_case_file(null,'{"mother_name":"أم بتصنيف","phone":"01012345679","mother_national_id":"29001011234567"}'::jsonb,array['أخرى'])::text,true);
set constraints case_file_requires_category_family,case_file_requires_category_link immediate;
select throws_ok(
  format('delete from public.case_file_categories where family_id=%L',current_setting('test.categorized_case')::uuid),
  '23514',null,'the last category cannot be deleted directly'
);
select is((select count(*)::int from public.case_file_categories where family_id=current_setting('test.categorized_case')::uuid),1,'failed category deletion preserves the existing category');

reset role;
select * from finish();
rollback;
