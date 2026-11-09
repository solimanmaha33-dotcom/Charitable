begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public','case_branches','shared branch list exists');
select is((select count(*)::int from public.case_branches),2,'two initial branches are seeded');
select ok((select bool_and(name in ('القاهرة - المرج','الفيوم - جبل النجار')) from public.case_branches),'only the requested initial branches are selectable');
select throws_ok($$insert into public.case_branches(name) values ('القاهرة - المرج')$$,'23505',null,'duplicate branch names are rejected');

insert into auth.users(id) values
 ('31000000-0000-0000-0000-000000000001'),('31000000-0000-0000-0000-000000000002'),('31000000-0000-0000-0000-000000000003');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('41000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001',now(),now()),
 ('41000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002',now(),now()),
 ('41000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000003',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('51000000-0000-0000-0000-000000000001','BRANCHW','Branch writer','employee'),
 ('51000000-0000-0000-0000-000000000002','BRANCHR','Branch reader','employee'),
 ('51000000-0000-0000-0000-000000000003','BRANCHN','No permission','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('51000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001'),
 ('51000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002'),
 ('51000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000003');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('51000000-0000-0000-0000-000000000001',false,true),
 ('51000000-0000-0000-0000-000000000002',true,false);

select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000002","session_id":"41000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.case_branches),2,'case readers can see the shared branch list');
select throws_ok($$insert into public.case_branches(name) values ('فرع قارئ')$$,'42501',null,'read-only staff cannot add branches');
select lives_ok($$delete from public.case_branches where name='القاهرة - المرج'$$,'read-only delete request completes without authorization');
select is((select count(*)::int from public.case_branches),2,'RLS prevents read-only staff from removing branches');
reset role;

insert into public.families(name,branch_area,notes,phone) values ('branch-history-test','القاهرة - المرج','branch-history-test','01012345678');
select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000001","session_id":"41000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$insert into public.case_branches(name) values ('فرع تجريبي')$$,'case writers can add branches');
select lives_ok($$delete from public.case_branches where name='القاهرة - المرج'$$,'case writers can remove a branch from the catalog');
select is((select branch_area from public.families where notes='branch-history-test'),'القاهرة - المرج','removing a branch does not change saved case files');
reset role;

select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000003","session_id":"41000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.case_branches),0,'staff without case access cannot see branches');
select throws_ok($$insert into public.case_branches(name) values ('فرع ممنوع')$$,'42501',null,'staff without case write access cannot add branches');
reset role;
select * from finish();
rollback;
