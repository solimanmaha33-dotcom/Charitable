-- Return only expiry dates backed by a valid identity, without exposing
-- National ID values to the dashboard response.
create or replace function public.list_case_file_id_expirations(p_cutoff date)
returns table(
  id uuid,
  code text,
  father_name text,
  mother_name text,
  contact_name text,
  national_id_expires_on date,
  identity_holder text
)
language sql
stable
security invoker
set search_path=''
as $$
  select f.id,f.code,f.father_name,f.mother_name,f.contact_name,f.national_id_expires_on,'المسؤول'::text
  from public.families f
  where public.has_permission('casesRead') and f.archived_at is null
    and f.national_id_expires_on is not null and f.national_id_expires_on<=p_cutoff
    and coalesce(btrim(f.national_id),'')<>'' and public.case_national_id_is_valid(f.national_id)
  union all
  select f.id,f.code,f.father_name,f.mother_name,f.contact_name,f.father_national_id_expires_on,'الأب'::text
  from public.families f
  where public.has_permission('casesRead') and f.archived_at is null
    and f.father_national_id_expires_on is not null and f.father_national_id_expires_on<=p_cutoff
    and coalesce(btrim(f.father_national_id),'')<>'' and public.case_national_id_is_valid(f.father_national_id)
  union all
  select f.id,f.code,f.father_name,f.mother_name,f.contact_name,f.mother_national_id_expires_on,'الأم'::text
  from public.families f
  where public.has_permission('casesRead') and f.archived_at is null
    and f.mother_national_id_expires_on is not null and f.mother_national_id_expires_on<=p_cutoff
    and coalesce(btrim(f.mother_national_id),'')<>'' and public.case_national_id_is_valid(f.mother_national_id)
$$;
revoke all on function public.list_case_file_id_expirations(date) from public,anon;
grant execute on function public.list_case_file_id_expirations(date) to authenticated;
