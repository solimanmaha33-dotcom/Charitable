alter table public.families
 add column national_id_expires_on date;

grant insert(national_id_expires_on),
 update(national_id_expires_on) on public.families to authenticated;
