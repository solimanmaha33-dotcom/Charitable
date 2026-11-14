begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

select has_column('public','case_attachments','document_type','case attachments can identify social research');
select is((select column_default from information_schema.columns where table_schema='public' and table_name='case_attachments' and column_name='document_type'),'''general''::text','existing attachments stay general by default');
select has_column('public','family_members','father_status','orphan status belongs to a case member');
select has_column('public','families','father_national_id_expires_on','father ID expiry is stored with the case profile');
select has_column('public','families','mother_national_id_expires_on','mother ID expiry is stored with the case profile');

insert into auth.users(id) values ('32000000-0000-0000-0000-000000000031'),('32000000-0000-0000-0000-000000000032');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('42000000-0000-0000-0000-000000000031','32000000-0000-0000-0000-000000000031',now(),now()),
 ('42000000-0000-0000-0000-000000000032','32000000-0000-0000-0000-000000000032',now(),now());
insert into public.employees(id,employee_code,display_name,role) values
 ('52000000-0000-0000-0000-000000000031','CASE032W','Case Profile Writer','employee'),
 ('52000000-0000-0000-0000-000000000032','CASE032R','Case Profile Reader','employee');
insert into private.employee_auth(employee_id,auth_user_id) values
 ('52000000-0000-0000-0000-000000000031','32000000-0000-0000-0000-000000000031'),
 ('52000000-0000-0000-0000-000000000032','32000000-0000-0000-0000-000000000032');
insert into public.employee_permissions(employee_id,cases_read,cases_write) values
 ('52000000-0000-0000-0000-000000000031',true,true),('52000000-0000-0000-0000-000000000032',true,false);

-- Seed one legacy file as it existed before the new write guard.
set local session_replication_role = replica;
alter table public.families disable trigger families_adult_identity_guard;
insert into public.families(id,name,phone) values ('72000000-0000-0000-0000-000000000032','ملف قديم من غير رقم قومي','01000000032');
alter table public.families enable trigger families_adult_identity_guard;
set local session_replication_role = origin;

select set_config('request.jwt.claims','{"sub":"32000000-0000-0000-0000-000000000031","session_id":"42000000-0000-0000-0000-000000000031","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم من غير رقم قومي","phone":"01012345678"}'::jsonb,array['أخرى'])$$,'23514',null,'a case cannot be saved without an adult national ID');
select throws_ok($$insert into public.families(name,phone) values ('ملف مباشر من غير رقم قومي','01012345678')$$,'23514',null,'direct table insert cannot create a case without an adult national ID');
select lives_ok($$update public.families set national_id=national_id,father_national_id=father_national_id,mother_national_id=mother_national_id where id='72000000-0000-0000-0000-000000000032'$$,'a legacy file can be updated when its identity values stay unchanged');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم صغيرة","phone":"01012345678","mother_national_id":"30811152312345","mother_date_of_birth":"1990-01-01"}'::jsonb,array['أخرى'])$$,'23514',null,'an edited adult date cannot make a minor ID satisfy the adult requirement');
select ok(not public.case_identity_is_adult('99999999999999',date '1990-01-01'),'a reviewed birth date cannot make an ID with an invalid century valid');
select ok(not public.case_identity_is_adult('29002311234567',date '1990-01-01'),'a reviewed birth date cannot make an ID with an invalid calendar date valid');
select ok(not public.case_identity_is_adult('29001019934567',date '1990-01-01'),'a reviewed birth date cannot make an ID with an unknown governorate valid');
select ok(public.case_national_id_is_valid('29001011234567'),'the National ID validator accepts a real date and governorate');
select ok(not public.case_national_id_is_valid('29002311234567'),'the National ID validator rejects an impossible date');
select ok(not public.case_national_id_is_valid('29001019934567'),'the National ID validator rejects an unknown governorate');
select ok(not public.case_national_id_is_valid('39901011234567'),'the National ID validator rejects a birth date in the future');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم برقم قومي غير صالح","phone":"01012345678","mother_national_id":"99999999999999","mother_date_of_birth":"1990-01-01"}'::jsonb,array['أخرى'])$$,'23514',null,'direct case save rejects an invalid national ID even with a reviewed adult date');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم صحيحة","phone":"01012345678","mother_national_id":"29001011234567","father_national_id":"29002311234567","mother_date_of_birth":"1990-01-01"}'::jsonb,array['أخرى'])$$,'23514',null,'direct case save rejects a malformed secondary ID when another adult ID is valid');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم أرملة","phone":"01012345678","father_national_id":"29001011234567","father_date_of_birth":"1990-01-01"}'::jsonb,array['أرملة'])$$,'23514',null,'a widow cannot use hidden father details to satisfy the adult ID requirement');
select set_config('test.widow_case_id',public.save_case_file(null,'{"mother_name":"أم أرملة","phone":"01012345678","mother_national_id":"29001011234567","mother_date_of_birth":"1990-01-01","father_name":"بيانات مخفية","father_national_id":"29001011234567","father_date_of_birth":"1990-01-01","father_national_id_expires_on":"2027-01-01","contact_name":"مسؤول مخفي","national_id":"29001011234577","contact_date_of_birth":"1990-01-01","national_id_expires_on":"2027-01-01"}'::jsonb,array['أرملة'])::text,true);
select is((select coalesce(father_name,'')||':'||coalesce(father_national_id,'')||':'||coalesce(national_id,'')||':'||coalesce(contact_name,'' ) from public.families where id=current_setting('test.widow_case_id')::uuid),':::','hidden father and guardian profile data are not persisted for a widow case');
select throws_ok(format('update public.families set father_name=%L where id=%L','أب مخفي',current_setting('test.widow_case_id')::uuid),'23514',null,'direct profile updates cannot restore hidden father details for a widow');
select throws_ok($$select public.update_case_parent_identity_profile(current_setting('test.widow_case_id')::uuid,'father','29001011234567','2027-01-01','1990-01-01','male')$$,'23514',null,'staff cannot attach a father ID to a widow case');
select set_config('test.case_id',public.save_case_file(null,'{"mother_name":"أم الاختبار","phone":"01012345678","mother_national_id":"29001011234567","mother_date_of_birth":"1990-01-01"}'::jsonb,array['أخرى'])::text,true);
select ok(current_setting('test.case_id')<>'','an adult national ID lets the case be saved');
select throws_ok(format('update public.families set father_national_id=%L where id=%L','29002311234567',current_setting('test.case_id')::uuid),'23514',null,'direct case updates reject a malformed secondary ID');
select lives_ok($$select public.update_case_parent_identity_profile(current_setting('test.case_id')::uuid,'mother','29001011234567','2027-01-01','1990-01-01','female')$$,'staff can update a parent ID and expiry date together');
select is((select mother_national_id_expires_on::text from public.families where id=current_setting('test.case_id')::uuid),'2027-01-01','parent ID expiry is stored for reminders');
select throws_ok(format('update public.families set national_id=null,father_national_id=null,mother_national_id=null where id=%L',current_setting('test.case_id')::uuid),'23514',null,'direct table updates cannot clear every adult national ID');
select throws_ok($$select public.save_case_file(null,'{"mother_name":"أم التصنيف القديم","phone":"01012345678","mother_national_id":"29001011234567","mother_date_of_birth":"1990-01-01"}'::jsonb,array['يتيم الأب'])$$,'23514',null,'paternal orphan is recorded per child instead of as a case category');
select throws_ok(format('insert into public.case_file_categories(family_id,category) values (%L,''يتيم الأب'')',current_setting('test.case_id')::uuid),'42501',null,'writers cannot create new paternal-orphan case categories');
select lives_ok($$select public.add_case_member_profile(current_setting('test.case_id')::uuid,'ريم الاختبار','ابنة','female','2015-01-01',null,null,'طفلة',null,null,'يتيم الأب')$$,'a child in an other case can be added with paternal orphan status');
select throws_ok($$select public.add_case_member_profile(current_setting('test.case_id')::uuid,'طفل برقم غير صالح','ابن','male','2015-01-01',null,null,'طفل',null,'29002311234567','الأب موجود')$$,'23514',null,'member creation rejects an invalid encoded birth date');
select throws_ok($$select public.add_case_member_profile(current_setting('test.case_id')::uuid,'طفل بمحافظة غير صالحة','ابن','male','2015-01-01',null,null,'طفل',null,'29001019934567','الأب موجود')$$,'23514',null,'member creation rejects an unknown governorate code');
select is((select father_status from public.family_members where family_id=current_setting('test.case_id')::uuid and relationship='ابنة'),'يتيم الأب','paternal orphan status is saved with the family-member link');
select throws_ok($$select public.add_case_member_profile(current_setting('test.case_id')::uuid,'ولد من غير اختيار','ابن','male','2016-01-01',null,null,'طفل',null,null,null)$$,'23514',null,'a child in an other case must have a father status');
select throws_ok($$select public.add_case_member_profile(current_setting('test.case_id')::uuid,'زوج الاختبار','زوج','male','1990-01-01',null,null,'لا يعمل',null,null,'يتيم الأب')$$,'23514',null,'father status cannot be assigned to a non-child');
select set_config('test.person_id',(select person_id::text from public.family_members where family_id=current_setting('test.case_id')::uuid and relationship='ابنة'),true);
select throws_ok(format('update public.people set national_id=%L where id=%L','29002311234567',current_setting('test.person_id')::uuid),'23514',null,'direct person updates reject a 14-digit ID with an impossible birth date');
select throws_ok($$select public.add_family_member_profile(current_setting('test.case_id')::uuid,'فرد عبر الإجراء القديم','زوج','male','1990-01-01',null,null,'لا يعمل',null,'29002311234567')$$,'23514',null,'the older member RPC also rejects an impossible ID date');
select lives_ok($$select public.update_case_member_profile(current_setting('test.case_id')::uuid,current_setting('test.person_id')::uuid,'ريم المعدلة','بنت','female','2015-01-01',null,null,'طفلة',null,null,'الأب موجود')$$,'case writers can update a child profile and father status');
select throws_ok($$select public.update_case_member_profile(current_setting('test.case_id')::uuid,current_setting('test.person_id')::uuid,'ريم المعدلة','بنت','female','2015-01-01',null,null,'طفلة',null,'29002311234567','الأب موجود')$$,'23514',null,'member edits reject an invalid encoded birth date');
select is((select p.name||':'||fm.relationship||':'||fm.father_status from public.family_members fm join public.people p on p.id=fm.person_id where fm.family_id=current_setting('test.case_id')::uuid and fm.person_id=current_setting('test.person_id')::uuid),'ريم المعدلة:بنت:الأب موجود','member edits and status stay linked to the same case');

select set_config('request.jwt.claims','{"sub":"32000000-0000-0000-0000-000000000032","session_id":"42000000-0000-0000-0000-000000000032","role":"authenticated"}',true);
select throws_ok($$select public.update_case_member_profile(current_setting('test.case_id')::uuid,current_setting('test.person_id')::uuid,'تعديل ممنوع','بنت','female','2015-01-01',null,null,'طفلة',null,null,'الأب موجود')$$,'42501',null,'staff without write permission cannot edit a member');

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select lives_ok($$insert into public.people(id,name,gender) values ('62000000-0000-0000-0000-000000000031','طفلة إدارية','female'); insert into public.family_members(family_id,person_id,relationship,father_status) values (current_setting('test.case_id')::uuid,'62000000-0000-0000-0000-000000000031','ابنة','يتيم الأب')$$,'the trusted service role can create a case member for administrative workflows');

reset role;
select * from finish();
rollback;
