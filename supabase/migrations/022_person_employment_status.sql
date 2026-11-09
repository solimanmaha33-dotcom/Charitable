-- Store employment status and work type for each parent and each family member.
alter table public.families
  add column father_employment_status text,
  add column mother_employment_status text,
  add column father_occupation text,
  add column mother_occupation text,
  add constraint families_father_employment_status_check check (father_employment_status is null or father_employment_status in ('يعمل','لا يعمل','طفل','طفلة')),
  add constraint families_mother_employment_status_check check (mother_employment_status is null or mother_employment_status in ('يعمل','لا يعمل','طفل','طفلة')),
  add constraint families_father_occupation_check check (father_occupation is null or (length(btrim(father_occupation)) between 1 and 200 and father_employment_status='يعمل')),
  add constraint families_mother_occupation_check check (mother_occupation is null or (length(btrim(mother_occupation)) between 1 and 200 and mother_employment_status='يعمل'));

grant insert(father_employment_status,mother_employment_status,father_occupation,mother_occupation),
  update(father_employment_status,mother_employment_status,father_occupation,mother_occupation)
  on public.families to authenticated;

alter table public.people
  add column employment_status text,
  add column occupation text,
  add constraint people_employment_status_check check (employment_status is null or employment_status in ('يعمل','لا يعمل','طفل','طفلة')),
  add constraint people_occupation_check check (occupation is null or (length(btrim(occupation)) between 1 and 200 and employment_status='يعمل'));

create function public.add_family_member_profile(
 p_family_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date,
 p_health_status text,p_health_details text,p_employment_status text,p_occupation text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 insert into public.people(name,gender,date_of_birth,health_status,health_details,health_condition,employment_status,occupation)
 values(p_name,p_gender,p_date_of_birth,p_health_status,p_health_details,p_health_details,p_employment_status,
   case when p_employment_status='يعمل' then p_occupation else null end) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text) from public,anon;
grant execute on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text) to authenticated;

create or replace function public.save_case_file(p_id uuid,p_profile jsonb,p_categories text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid case file' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_profile->>'mother_name'),'') is null then raise exception 'Mother name is required' using errcode='23514'; end if;
 if p_id is not null and exists(select 1 from public.families where id=p_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 if p_id is null then
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,father_national_id,mother_national_id,father_health_condition,mother_health_condition,father_health_status,mother_health_status,father_employment_status,mother_employment_status,father_occupation,mother_occupation)
  values(coalesce(p_profile->>'name',''),p_profile->>'phone',p_profile->>'father_name',p_profile->>'mother_name',p_profile->>'contact_name',nullif(p_profile->>'contact_age','')::smallint,p_profile->>'national_id',p_profile->>'phone_2',p_profile->>'phone_3',p_profile->>'contact_relationship',coalesce(p_profile->>'notes',''),p_profile->>'address',nullif(p_profile->>'monthly_income','')::numeric,p_profile->>'health_condition',p_profile->>'branch_area',coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),p_profile->>'status_reason',p_profile->>'father_national_id',p_profile->>'mother_national_id',p_profile->>'father_health_condition',p_profile->>'mother_health_condition',p_profile->>'father_health_status',p_profile->>'mother_health_status',p_profile->>'father_employment_status',p_profile->>'mother_employment_status',p_profile->>'father_occupation',p_profile->>'mother_occupation') returning id into result;
 else
  update public.families set name=coalesce(p_profile->>'name',''),phone=p_profile->>'phone',father_name=p_profile->>'father_name',mother_name=p_profile->>'mother_name',contact_name=p_profile->>'contact_name',contact_age=nullif(p_profile->>'contact_age','')::smallint,national_id=p_profile->>'national_id',phone_2=p_profile->>'phone_2',phone_3=p_profile->>'phone_3',contact_relationship=p_profile->>'contact_relationship',notes=coalesce(p_profile->>'notes',''),address=p_profile->>'address',monthly_income=nullif(p_profile->>'monthly_income','')::numeric,health_condition=p_profile->>'health_condition',branch_area=p_profile->>'branch_area',file_status=coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),status_reason=p_profile->>'status_reason',father_national_id=p_profile->>'father_national_id',mother_national_id=p_profile->>'mother_national_id',father_health_condition=p_profile->>'father_health_condition',mother_health_condition=p_profile->>'mother_health_condition',father_health_status=p_profile->>'father_health_status',mother_health_status=p_profile->>'mother_health_status',father_employment_status=p_profile->>'father_employment_status',mother_employment_status=p_profile->>'mother_employment_status',father_occupation=p_profile->>'father_occupation',mother_occupation=p_profile->>'mother_occupation' where id=p_id returning id into result;
  if result is null then raise exception 'Case file not found' using errcode='P0002'; end if;
  if p_categories is not null then
   delete from public.case_file_categories where family_id=result
    and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأم','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون');
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
