alter table public.families
 add column contact_name text,
 add column contact_age smallint,
 add column national_id text,
 add column phone_2 text,
 add column phone_3 text,
 add column notes text not null default '';

alter table public.families
 add constraint families_contact_name_check check (contact_name is null or length(btrim(contact_name)) between 1 and 200),
 add constraint families_contact_age_check check (contact_age is null or contact_age between 0 and 120),
 add constraint families_national_id_check check (national_id is null or national_id ~ '^[0-9]{14}$'),
 add constraint families_phone_2_check check (phone_2 is null or length(btrim(phone_2)) between 1 and 40),
 add constraint families_phone_3_check check (phone_3 is null or length(btrim(phone_3)) between 1 and 40),
 add constraint families_notes_check check (length(notes) <= 4000);

grant insert(contact_name,contact_age,national_id,phone_2,phone_3,notes),
 update(contact_name,contact_age,national_id,phone_2,phone_3,notes) on public.families to authenticated;

create table public.family_files (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id),
 storage_path text not null unique,
 file_name text not null check(length(btrim(file_name)) between 1 and 255),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 size_bytes bigint not null check(size_bytes between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check (storage_path ~ ('^' || family_id::text || '/[0-9a-f-]{36}$'))
);
create index family_files_family_id_idx on public.family_files(family_id);
alter table public.family_files enable row level security;
grant select on public.family_files to authenticated;
create policy family_files_read on public.family_files for select to authenticated using (
 (select public.has_permission('casesRead'))
);

drop policy case_objects_read on storage.objects;
create policy case_objects_read on storage.objects for select to authenticated using (
 bucket_id='case-files'
 and (select public.has_permission('casesRead'))
 and (
  exists (select 1 from public.case_files f where f.storage_path=name)
  or exists (select 1 from public.family_files f where f.storage_path=name)
 )
);
