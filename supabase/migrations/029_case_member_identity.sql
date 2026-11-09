-- Phase 2: persist the identity details decoded from Egyptian national IDs.
-- This is forward-only; previous migrations remain unchanged.
alter table public.families
  add column father_date_of_birth date,
  add column father_gender text,
  add column mother_date_of_birth date,
  add column mother_gender text,
  add column contact_date_of_birth date,
  add column contact_gender text,
  add constraint families_father_gender_check check (father_gender is null or father_gender in ('female','male')),
  add constraint families_mother_gender_check check (mother_gender is null or mother_gender in ('female','male')),
  add constraint families_contact_gender_check check (contact_gender is null or contact_gender in ('female','male'));

grant insert(father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender),
  update(father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender)
  on public.families to authenticated;

alter table public.people
  add column national_id text,
  add constraint people_national_id_check check (national_id is null or national_id ~ '^[0-9]{14}$');
create index people_national_id_search_idx on public.people(national_id) where national_id is not null;

create or replace function public.save_case_file(p_id uuid,p_profile jsonb,p_categories text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid case file' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_profile->>'mother_name'),'') is null then raise exception 'Mother name is required' using errcode='23514'; end if;
 if p_categories is not null and (select count(distinct category) from unnest(p_categories) category where category in ('هجر','أرملة','مطلقة'))>1 then
   raise exception 'Choose only one household marital status' using errcode='23514';
 end if;
 if p_id is not null and exists(select 1 from public.families where id=p_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 if p_id is null then
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,father_national_id,mother_national_id,father_health_condition,mother_health_condition,father_health_status,mother_health_status,father_employment_status,mother_employment_status,father_occupation,mother_occupation,father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender)
  values(coalesce(p_profile->>'name',''),p_profile->>'phone',p_profile->>'father_name',p_profile->>'mother_name',p_profile->>'contact_name',nullif(p_profile->>'contact_age','')::smallint,p_profile->>'national_id',p_profile->>'phone_2',p_profile->>'phone_3',p_profile->>'contact_relationship',coalesce(p_profile->>'notes',''),p_profile->>'address',nullif(p_profile->>'monthly_income','')::numeric,p_profile->>'health_condition',p_profile->>'branch_area',coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),p_profile->>'status_reason',p_profile->>'father_national_id',p_profile->>'mother_national_id',p_profile->>'father_health_condition',p_profile->>'mother_health_condition',p_profile->>'father_health_status',p_profile->>'mother_health_status',p_profile->>'father_employment_status',p_profile->>'mother_employment_status',p_profile->>'father_occupation',p_profile->>'mother_occupation',nullif(p_profile->>'father_date_of_birth','')::date,nullif(p_profile->>'father_gender',''),nullif(p_profile->>'mother_date_of_birth','')::date,nullif(p_profile->>'mother_gender',''),nullif(p_profile->>'contact_date_of_birth','')::date,nullif(p_profile->>'contact_gender','')) returning id into result;
 else
  update public.families set name=coalesce(p_profile->>'name',''),phone=p_profile->>'phone',father_name=p_profile->>'father_name',mother_name=p_profile->>'mother_name',contact_name=p_profile->>'contact_name',contact_age=nullif(p_profile->>'contact_age','')::smallint,national_id=p_profile->>'national_id',phone_2=p_profile->>'phone_2',phone_3=p_profile->>'phone_3',contact_relationship=p_profile->>'contact_relationship',notes=coalesce(p_profile->>'notes',''),address=p_profile->>'address',monthly_income=nullif(p_profile->>'monthly_income','')::numeric,health_condition=p_profile->>'health_condition',branch_area=p_profile->>'branch_area',file_status=coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),status_reason=p_profile->>'status_reason',father_national_id=p_profile->>'father_national_id',mother_national_id=p_profile->>'mother_national_id',father_health_condition=p_profile->>'father_health_condition',mother_health_condition=p_profile->>'mother_health_condition',father_health_status=p_profile->>'father_health_status',mother_health_status=p_profile->>'mother_health_status',father_employment_status=p_profile->>'father_employment_status',mother_employment_status=p_profile->>'mother_employment_status',father_occupation=p_profile->>'father_occupation',mother_occupation=p_profile->>'mother_occupation',father_date_of_birth=nullif(p_profile->>'father_date_of_birth','')::date,father_gender=nullif(p_profile->>'father_gender',''),mother_date_of_birth=nullif(p_profile->>'mother_date_of_birth','')::date,mother_gender=nullif(p_profile->>'mother_gender',''),contact_date_of_birth=nullif(p_profile->>'contact_date_of_birth','')::date,contact_gender=nullif(p_profile->>'contact_gender','') where id=p_id returning id into result;
  if result is null then raise exception 'Case file not found' using errcode='P0002'; end if;
  if p_categories is not null then
   delete from public.case_file_categories where family_id=result
    and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى');
  end if;
 end if;
 if p_categories is not null then
  insert into public.case_file_categories(family_id,category)
  select result,category from unnest(coalesce(p_categories,array[]::text[])) category;
 end if;
 return result;
end $$;
revoke all on function public.save_case_file(uuid,jsonb,text[]) from public,anon;
grant execute on function public.save_case_file(uuid,jsonb,text[]) to authenticated;

-- Keep the existing 9-argument RPC available for already deployed clients.
create function public.add_family_member_profile(
 p_family_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date,
 p_health_status text,p_health_details text,p_employment_status text,p_occupation text,p_national_id text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_national_id is not null and p_national_id !~ '^[0-9]{14}$' then
   raise exception 'National ID must contain exactly 14 digits' using errcode='23514';
 end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 insert into public.people(name,gender,date_of_birth,health_status,health_details,health_condition,employment_status,occupation,national_id)
 values(p_name,p_gender,p_date_of_birth,p_health_status,p_health_details,p_health_details,p_employment_status,
   case when p_employment_status='يعمل' then p_occupation else null end,p_national_id) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text,text) from public,anon;
grant execute on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text,text) to authenticated;

create function public.update_case_file_identity_profile(
 p_id uuid,p_national_id text,p_expires_on date,p_birth_date date,p_gender text,p_age smallint
) returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_national_id is not null and p_national_id !~ '^[0-9]{14}$' then
    raise exception 'National ID must contain exactly 14 digits' using errcode='23514';
  end if;
  if p_gender is not null and p_gender not in ('female','male') then
    raise exception 'Gender is invalid' using errcode='23514';
  end if;
  if p_age is not null and p_age not between 0 and 120 then
    raise exception 'Age is invalid' using errcode='23514';
  end if;
  update public.families set national_id=p_national_id,national_id_expires_on=p_expires_on,
    contact_date_of_birth=p_birth_date,contact_gender=p_gender,contact_age=p_age
  where id=p_id and archived_at is null;
  if not found then raise exception 'Case file not found or archived' using errcode='P0002'; end if;
end $$;
revoke all on function public.update_case_file_identity_profile(uuid,text,date,date,text,smallint) from public,anon;
grant execute on function public.update_case_file_identity_profile(uuid,text,date,date,text,smallint) to authenticated;
