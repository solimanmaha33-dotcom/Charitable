begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
select has_table('public','case_file_categories','canonical categories table exists');
select has_table('public','case_file_history','old case notes history exists');
select has_table('public','case_attachments','unified attachment table exists');
select has_table('public','legacy_case_map','old routes map to files');
select has_table('public','legacy_family_names','legacy names have a restricted archive');
select has_view('public','case_file_duplicate_review','potential duplicates are listed without merging');
select has_function('public','save_case_file',array['uuid','jsonb','text[]'],'canonical profile save function exists');
select ok(not has_table_privilege('authenticated','public.cases','select'),'staff cannot read archived case rows');
select ok(not has_table_privilege('authenticated','public.case_categories','select'),'staff cannot read archived case categories');
select ok(has_table_privilege('authenticated','public.case_file_categories','select'),'staff reads categories through permission RLS');
select ok(not has_table_privilege('authenticated','public.case_attachments','insert'),'browser cannot forge unified attachment metadata');
select ok(not has_table_privilege('authenticated','public.legacy_family_names','select'),'staff cannot read old family names');
select ok(
 not exists(select 1 from public.families where id='a2000000-0000-0000-0000-000000000001')
 or (
  (select count(*)=2 from public.case_file_history where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=2 from public.case_file_categories where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=2 from public.case_attachments where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=2 from public.legacy_case_map where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=1 from public.legacy_family_names where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=1 from public.sponsorships where family_id='a2000000-0000-0000-0000-000000000001')
  and (select count(*)=1 from public.case_file_duplicate_review where family_id='a2000000-0000-0000-0000-000000000001' and possible_duplicate_id='a2000000-0000-0000-0000-000000000003')
  and (select extracted_text='نص OCR عربي تجريبي' from public.case_attachments where legacy_file_id='a4000000-0000-0000-0000-000000000001')
 )
,'migration fixture preserves categories, notes, attachments, OCR, sponsorships, code roots, and legacy archive');
select * from finish(); rollback;
