insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('case-files','case-files',false,20971520,array['application/pdf','image/png','image/jpeg','image/webp']);
create table public.case_files (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id),
 storage_path text not null unique,
 file_name text not null check (length(file_name) between 1 and 255),
 mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 size_bytes bigint not null check (size_bytes between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check (storage_path ~ ('^' || case_id::text || '/[0-9a-f-]{36}$'))
);
create index case_files_case_id_idx on public.case_files(case_id);
alter table public.case_files enable row level security;
grant select, insert on public.case_files to authenticated;
create policy case_files_read on public.case_files for select to authenticated using (
 (select public.has_permission('casesRead')) and exists (select 1 from public.cases c where c.id=case_id));
create policy case_files_insert on public.case_files for insert to authenticated with check (
 (select public.has_permission('casesWrite')) and uploaded_by=(select auth.uid()) and exists (select 1 from public.cases c where c.id=case_id));
create policy case_objects_read on storage.objects for select to authenticated using (
 bucket_id='case-files' and (select public.has_permission('casesRead')) and (exists (select 1 from public.case_files f where f.storage_path=name) or (owner_id=(select auth.uid())::text and not exists (select 1 from public.case_files f where f.storage_path=name))));
create policy case_objects_insert on storage.objects for insert to authenticated with check (
 bucket_id='case-files' and (select public.has_permission('casesWrite')) and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$' and exists (select 1 from public.cases c where c.id::text=split_part(name,'/',1)));
create policy case_objects_delete_orphan on storage.objects for delete to authenticated using (
 bucket_id='case-files' and (select public.has_permission('casesWrite')) and owner_id=(select auth.uid())::text and not exists (select 1 from public.case_files f where f.storage_path=name));
