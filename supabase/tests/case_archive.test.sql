begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
 ('aa000000-0000-0000-0000-000000000001'),
 ('aa000000-0000-0000-0000-000000000002'),
 ('aa000000-0000-0000-0000-000000000003');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('ab000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001',now(),now()),
 ('ab000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000002',now(),now()),
 ('ab000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000003',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('ac000000-0000-0000-0000-000000000001','ARCHIVE-GM','مدير عام','general_manager'),
 ('ac000000-0000-0000-0000-000000000002','ARCHIVE-MGR','مدير','manager'),
 ('ac000000-0000-0000-0000-000000000003','ARCHIVE-EMP','موظف','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('ac000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001'),
 ('ac000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000002'),
 ('ac000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000003');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('ac000000-0000-0000-0000-000000000002',true,true),
 ('ac000000-0000-0000-0000-000000000003',true,true);

insert into public.families(id,name,mother_name) values ('ad000000-0000-0000-0000-000000000001','','أم أرشيف');
insert into public.people(id,name) values ('ae000000-0000-0000-0000-000000000001','طفل أرشيف');
insert into public.family_members(family_id,person_id,relationship) values
 ('ad000000-0000-0000-0000-000000000001','ae000000-0000-0000-0000-000000000001','ابن');
insert into public.cases(id,family_id,notes) values
 ('af000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','سجل حالة محفوظ');
insert into public.case_file_history(family_id,legacy_case_id,notes,created_at) values
 ('ad000000-0000-0000-0000-000000000001','af000000-0000-0000-0000-000000000001','تاريخ سابق',now());
insert into storage.objects(bucket_id,name,owner_id) values
 ('case-files','ad000000-0000-0000-0000-000000000001/ad000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000001');
insert into public.case_attachments(id,family_id,storage_path,file_name,mime_type,size_bytes,uploaded_by) values
 ('ad000000-0000-0000-0000-000000000002','ad000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001/ad000000-0000-0000-0000-000000000002','صورة.png','image/png',5,'aa000000-0000-0000-0000-000000000001');
insert into public.donors(id,name) values ('b0000000-0000-0000-0000-000000000001','متبرع أرشيف');
insert into public.sponsorships(id,donor_id,family_id,monthly_amount,start_date) values
 ('b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',300,'2025-01-01');
insert into public.sponsorship_payments(id,sponsorship_id,installment_month,due_date,amount_due,received_on,amount_received) values
 ('b2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','2025-01-01','2025-01-01',300,'2025-01-05',300);
insert into public.sponsorship_payments(id,sponsorship_id,installment_month,due_date,amount_due) values
 ('b2000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','2025-02-01','2025-02-01',300);

select has_column('public','families','archived_at','case file can carry an archive time');
select has_column('public','families','archived_by','case file records who archived it');
select has_table('private','case_archive_audit','archive changes have a private audit trail');
select has_function('public','archive_case_file',array['uuid'],'archive operation exists');
select has_function('public','restore_case_file',array['uuid'],'restore operation exists');

select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000002","session_id":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000001')$$,'42501',null,'a manager cannot archive a case');
select throws_ok($$select public.restore_case_file('ad000000-0000-0000-0000-000000000001')$$,'42501',null,'a manager cannot restore a case');
reset role;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000003","session_id":"ab000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000001')$$,'42501',null,'an employee cannot archive a case');
select throws_ok($$select public.restore_case_file('ad000000-0000-0000-0000-000000000001')$$,'42501',null,'an employee cannot restore a case');
reset role;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000001","session_id":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000001')$$,'general manager archives a case');
reset role;
select ok((select archived_at is not null and archived_by='ac000000-0000-0000-0000-000000000001' from public.families where id='ad000000-0000-0000-0000-000000000001'),'archive time and actor are stored');
select is((select count(*)::int from public.family_members where family_id='ad000000-0000-0000-0000-000000000001'),1,'archive keeps family members');
select is((select count(*)::int from public.case_file_history where family_id='ad000000-0000-0000-0000-000000000001'),1,'archive keeps case history');
select is((select count(*)::int from public.case_attachments where family_id='ad000000-0000-0000-0000-000000000001'),1,'archive keeps attachment metadata');
select is((select count(*)::int from storage.objects where bucket_id='case-files' and name like 'ad000000-0000-0000-0000-000000000001/%'),1,'archive keeps private storage objects');
select is((select count(*)::int from public.sponsorships where family_id='ad000000-0000-0000-0000-000000000001'),1,'archive keeps sponsorships');
select is((select count(*)::int from public.sponsorship_payments where sponsorship_id='b1000000-0000-0000-0000-000000000001'),2,'archive keeps received and expected installments');
select is((select count(*)::int from private.case_archive_audit where family_id='ad000000-0000-0000-0000-000000000001' and action='archived'),1,'archive is recorded once');
select throws_ok($$update private.case_archive_audit set action='restored' where family_id='ad000000-0000-0000-0000-000000000001'$$,'42501',null,'archive audit cannot be edited');
select throws_ok($$delete from private.case_archive_audit where family_id='ad000000-0000-0000-0000-000000000001'$$,'42501',null,'archive audit cannot be deleted');
select throws_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000001')$$,'P0002',null,'repeated archive is rejected');
select throws_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000099')$$,'P0002',null,'unknown case archive is rejected');
select is((select count(*)::int from private.case_archive_audit where family_id='ad000000-0000-0000-0000-000000000001'),1,'failed archive transitions do not duplicate the audit trail');

select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000002","session_id":"ab000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.save_case_file('ad000000-0000-0000-0000-000000000001','{"mother_name":"تعديل بعد الأرشفة"}'::jsonb,array['هجر'])$$,'42501',null,'archived case profile cannot be edited');
select throws_ok($$select public.add_family_member_profile('ad000000-0000-0000-0000-000000000001','فرد بعد الأرشفة','ابن',null,null)$$,'42501',null,'archived case cannot receive new members');
select throws_ok($$update public.people set date_of_birth='2010-01-01' where id='ae000000-0000-0000-0000-000000000001'$$,'42501',null,'members of archived cases cannot be edited');
reset role;
select throws_ok($$insert into public.sponsorships(donor_id,family_id,monthly_amount,start_date) values('b0000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001',250,'2025-03-01')$$,'42501',null,'new sponsorship cannot link an archived case');

select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000001","session_id":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.assistant_search_cases('سجل محفوظ')),0,'assistant search excludes archived cases');
select lives_ok($$select public.restore_case_file('ad000000-0000-0000-0000-000000000001')$$,'general manager restores a case');
select throws_ok($$update public.families set archived_at=now(),archived_by='ac000000-0000-0000-0000-000000000001' where id='ad000000-0000-0000-0000-000000000001'$$,'42501',null,'staff cannot alter archive state directly');
reset role;
select ok((select archived_at is null and archived_by is null from public.families where id='ad000000-0000-0000-0000-000000000001'),'restored file is active');
select is((select string_agg(action,',' order by created_at) from private.case_archive_audit where family_id='ad000000-0000-0000-0000-000000000001'),'archived,restored','both transitions are audited');
select throws_ok($$select public.restore_case_file('ad000000-0000-0000-0000-000000000001')$$,'P0002',null,'repeated restore is rejected');
select throws_ok($$select public.restore_case_file('ad000000-0000-0000-0000-000000000099')$$,'P0002',null,'unknown case restore is rejected');
select set_config('request.jwt.claims','{"sub":"aa000000-0000-0000-0000-000000000001","session_id":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.archive_delete_token',(select public.begin_case_attachment_delete('ad000000-0000-0000-0000-000000000002')->>'deletion_token'),true);
select is((select public.begin_case_attachment_delete('ad000000-0000-0000-0000-000000000002')->>'deletion_token'),current_setting('test.archive_delete_token'),'retry reuses the durable attachment deletion token');
select throws_ok($$select public.finish_case_attachment_delete('ad000000-0000-0000-0000-000000000002',current_setting('test.archive_delete_token')::uuid)$$,'42501',null,'authenticated staff cannot finish a deletion without Storage confirmation');
select throws_ok($$select public.archive_case_file('ad000000-0000-0000-0000-000000000001')$$,'55006',null,'case archive waits for attachment deletion to finish');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select lives_ok($$select public.finish_case_attachment_delete('ad000000-0000-0000-0000-000000000002',current_setting('test.archive_delete_token')::uuid)$$,'trusted service can finish deletion after Storage confirmation');
reset role;
select is((select count(*)::int from public.case_attachments where family_id='ad000000-0000-0000-0000-000000000001'),0,'completed attachment deletion removes metadata only after Storage succeeds');

select * from finish();
rollback;
