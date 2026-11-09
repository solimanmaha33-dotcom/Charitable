begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_column('public','people','national_id','family members can be searched by national ID');
select has_column('public','families','father_date_of_birth','case profile saves father birth date');
select has_column('public','families','father_gender','case profile saves father gender');
select has_column('public','families','mother_date_of_birth','case profile saves mother birth date');
select has_column('public','families','mother_gender','case profile saves mother gender');
select has_column('public','families','contact_date_of_birth','case profile saves guardian birth date');
select has_column('public','families','contact_gender','case profile saves guardian gender');

insert into auth.users(id) values ('32000000-0000-0000-0000-000000000001');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('42000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('52000000-0000-0000-0000-000000000001','IDPHASE2','ID Phase2','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('52000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('52000000-0000-0000-0000-000000000001',true,true);

select set_config('request.jwt.claims','{"sub":"32000000-0000-0000-0000-000000000001","session_id":"42000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;

select lives_ok($$select public.save_case_file(null,jsonb_build_object(
 'father_name','أب اختبار','mother_name','أم اختبار Phase2','contact_name','مسؤول اختبار',
 'contact_age','42','national_id','29001011234567','father_date_of_birth','1980-01-02',
 'father_gender','male','mother_date_of_birth','1990-01-03','mother_gender','female',
 'contact_date_of_birth','1980-01-02','contact_gender','male','phone','01012345678',
 'notes','','address','عنوان','file_status','نشط'),array[]::text[])$$,'case intake saves the added demographics');
select is((select father_date_of_birth::text from public.families where mother_name='أم اختبار Phase2'),'1980-01-02','father birth date is persisted');
select is((select contact_gender from public.families where mother_name='أم اختبار Phase2'),'male','guardian gender is persisted');

select lives_ok($$select public.add_family_member_profile(
 (select id from public.families where mother_name='أم اختبار Phase2'),
 'طفل اختبار Phase2','ابن','male','2024-02-29',null,null,'طفل',null,'32402291234577')$$,
 'member profile accepts and saves national ID');
select is((select national_id from public.people where name='طفل اختبار Phase2'),'32402291234577','member national ID is searchable by case readers');
select throws_ok($$select public.add_family_member_profile(
 (select id from public.families where mother_name='أم اختبار Phase2'),
 'فرد برقم غير صحيح','ابن','male','2024-02-29',null,null,'طفل',null,'123')$$,
 '23514',null,'member national ID must contain fourteen digits');
select is((select count(*)::int from public.people where national_id='32402291234577'),1,'search finds the member by national ID');

select lives_ok($$select public.update_case_file_identity_profile(
 (select id from public.families where mother_name='أم اختبار Phase2'),
 '29001011234567','2027-01-01','1990-01-01','female',36::smallint)$$,
 'ID scanner can save the guardian demographics with the expiry date');
select is((select contact_date_of_birth::text||':'||contact_gender||':'||contact_age::text from public.families where mother_name='أم اختبار Phase2'),
 '1990-01-01:female:36','ID scanner profile values are persisted');
select lives_ok($$select public.update_case_file_identity_profile(
 (select id from public.families where mother_name='أم اختبار Phase2'),
 '29001011234567','2027-01-01',null::date,null::text,null::smallint)$$,
 'ID scanner can clear guardian demographics explicitly');
select is((select contact_date_of_birth::text||':'||contact_gender||':'||contact_age::text from public.families where mother_name='أم اختبار Phase2'),
 null,'cleared demographics stay null in the case file');

select * from finish();
rollback;
