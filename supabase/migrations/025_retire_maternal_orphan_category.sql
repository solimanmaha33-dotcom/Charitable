-- Stop new case files from using the retired category while keeping old labels readable.
drop policy case_file_categories_write on public.case_file_categories;
create policy case_file_categories_write on public.case_file_categories for insert to authenticated with check (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون')
);

-- Preserve an old «يتيم الأم» row when staff save other fields or categories on that file.
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
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,father_national_id,mother_national_id,father_health_condition,mother_health_condition,father_health_status,mother_health_status)
  values(coalesce(p_profile->>'name',''),p_profile->>'phone',p_profile->>'father_name',p_profile->>'mother_name',p_profile->>'contact_name',nullif(p_profile->>'contact_age','')::smallint,p_profile->>'national_id',p_profile->>'phone_2',p_profile->>'phone_3',p_profile->>'contact_relationship',coalesce(p_profile->>'notes',''),p_profile->>'address',nullif(p_profile->>'monthly_income','')::numeric,p_profile->>'health_condition',p_profile->>'branch_area',coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),p_profile->>'status_reason',p_profile->>'father_national_id',p_profile->>'mother_national_id',p_profile->>'father_health_condition',p_profile->>'mother_health_condition',p_profile->>'father_health_status',p_profile->>'mother_health_status') returning id into result;
 else
  update public.families set name=coalesce(p_profile->>'name',''),phone=p_profile->>'phone',father_name=p_profile->>'father_name',mother_name=p_profile->>'mother_name',contact_name=p_profile->>'contact_name',contact_age=nullif(p_profile->>'contact_age','')::smallint,national_id=p_profile->>'national_id',phone_2=p_profile->>'phone_2',phone_3=p_profile->>'phone_3',contact_relationship=p_profile->>'contact_relationship',notes=coalesce(p_profile->>'notes',''),address=p_profile->>'address',monthly_income=nullif(p_profile->>'monthly_income','')::numeric,health_condition=p_profile->>'health_condition',branch_area=p_profile->>'branch_area',file_status=coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),status_reason=p_profile->>'status_reason',father_national_id=p_profile->>'father_national_id',mother_national_id=p_profile->>'mother_national_id',father_health_condition=p_profile->>'father_health_condition',mother_health_condition=p_profile->>'mother_health_condition',father_health_status=p_profile->>'father_health_status',mother_health_status=p_profile->>'mother_health_status' where id=p_id returning id into result;
  if result is null then raise exception 'Case file not found' using errcode='P0002'; end if;
  if p_categories is not null then
   delete from public.case_file_categories where family_id=result
    and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون');
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
