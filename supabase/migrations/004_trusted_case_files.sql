-- Only the trusted inspection route may write case-file objects and metadata.
revoke insert on public.case_files from authenticated;
drop policy case_files_insert on public.case_files;
drop policy case_objects_insert on storage.objects;
drop policy case_objects_delete_orphan on storage.objects;
drop policy case_objects_read on storage.objects;
create policy case_objects_read on storage.objects for select to authenticated using (
 bucket_id='case-files' and (select public.has_permission('casesRead')) and exists (select 1 from public.case_files f where f.storage_path=name));
