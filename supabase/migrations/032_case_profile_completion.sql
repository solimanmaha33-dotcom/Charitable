-- Complete the single-case workflow without changing the existing data model's history.
alter table public.families
  add column if not exists father_national_id_expires_on date,
  add column if not exists mother_national_id_expires_on date;
grant insert(father_national_id_expires_on,mother_national_id_expires_on), update(father_national_id_expires_on,mother_national_id_expires_on) on public.families to authenticated;

alter table public.case_attachments add column if not exists document_type text not null default 'general';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='case_attachments_document_type_check' and conrelid='public.case_attachments'::regclass) then
    alter table public.case_attachments add constraint case_attachments_document_type_check check (document_type in ('general','social_research'));
  end if;
end $$;

-- Keep old «يتيم الأب» labels for history; staff must not delete or create new ones.
drop policy if exists case_file_categories_write on public.case_file_categories;
create policy case_file_categories_write on public.case_file_categories for insert to authenticated with check (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى')
);
drop policy if exists case_file_categories_delete on public.case_file_categories;
create policy case_file_categories_delete on public.case_file_categories for delete to authenticated using (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى')
);

alter table public.family_members add column if not exists father_status text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='family_members_father_status_check' and conrelid='public.family_members'::regclass) then
    alter table public.family_members add constraint family_members_father_status_check check (father_status is null or father_status in ('الأب موجود','يتيم الأب'));
  end if;
end $$;

create or replace function public.case_national_id_birth_date(p_national_id text)
returns date language plpgsql immutable security invoker set search_path='' as $$
declare id_year integer; id_month integer; id_day integer;
begin
  if p_national_id is null or p_national_id !~ '^[0-9]{14}$' or substr(p_national_id,1,1) not in ('2','3') then return null; end if;
  id_year:=case substr(p_national_id,1,1) when '2' then 1900 else 2000 end + substr(p_national_id,2,2)::integer;
  id_month:=substr(p_national_id,4,2)::integer;
  id_day:=substr(p_national_id,6,2)::integer;
  return make_date(id_year,id_month,id_day);
exception when others then return null;
end $$;
revoke all on function public.case_national_id_birth_date(text) from public,anon;
grant execute on function public.case_national_id_birth_date(text) to authenticated;

create or replace function public.case_national_id_is_valid(p_national_id text)
returns boolean language sql stable security invoker set search_path='' as $$
  select p_national_id is null or p_national_id=''
    or (p_national_id ~ '^[0-9]{14}$'
      and public.case_national_id_birth_date(p_national_id) is not null
      and public.case_national_id_birth_date(p_national_id)<=(statement_timestamp() at time zone 'Africa/Cairo')::date
      and substr(p_national_id,8,2) in ('01','02','03','04','11','12','13','14','15','16','17','18','19','21','22','23','24','25','26','27','28','29','31','32','33','34','35','88'))
$$;
revoke all on function public.case_national_id_is_valid(text) from public,anon;
grant execute on function public.case_national_id_is_valid(text) to authenticated;

-- Validate every stored member ID, including direct table writes and the
-- older add_family_member_profile RPC kept for clients from earlier builds.
create or replace function private.validate_person_national_id()
returns trigger language plpgsql set search_path='' as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.has_permission('casesWrite') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if not public.case_national_id_is_valid(new.national_id) then
    raise exception 'Invalid national ID' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_person_national_id() from public,anon,authenticated;
drop trigger if exists people_national_id_validate on public.people;
create trigger people_national_id_validate
before insert or update of national_id on public.people
for each row execute function private.validate_person_national_id();

create or replace function public.add_family_member_profile(
 p_family_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date,
 p_health_status text,p_health_details text,p_employment_status text,p_occupation text,p_national_id text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then raise exception 'Archived case files cannot be changed' using errcode='42501'; end if;
 insert into public.people(name,gender,date_of_birth,health_status,health_details,health_condition,employment_status,occupation,national_id)
 values(p_name,p_gender,p_date_of_birth,p_health_status,p_health_details,p_health_details,p_employment_status,
   case when p_employment_status='يعمل' then p_occupation else null end,p_national_id) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text,text) from public,anon;
grant execute on function public.add_family_member_profile(uuid,text,text,text,date,text,text,text,text,text) to authenticated;

create or replace function public.case_identity_is_adult(p_national_id text,p_reviewed_birth_date date)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare birth_date date; id_birth_date date; cairo_date date:=(statement_timestamp() at time zone 'Africa/Cairo')::date;
begin
  if p_national_id is null or p_national_id !~ '^[0-9]{14}$' then return false; end if;
  id_birth_date:=public.case_national_id_birth_date(p_national_id);
  if id_birth_date is null or id_birth_date>cairo_date
    or substr(p_national_id,8,2) not in ('01','02','03','04','11','12','13','14','15','16','17','18','19','21','22','23','24','25','26','27','28','29','31','32','33','34','35','88') then
    return false;
  end if;
  birth_date:=coalesce(p_reviewed_birth_date,id_birth_date);
  return date_part('year',age(cairo_date,id_birth_date))>=18
    and birth_date is not null and birth_date<=cairo_date
    and date_part('year',age(cairo_date,birth_date))>=18;
end $$;
revoke all on function public.case_identity_is_adult(text,date) from public,anon;
grant execute on function public.case_identity_is_adult(text,date) to authenticated;

-- Protect direct PostgREST writes too. Existing files with no valid adult ID
-- can still be edited when all identity values are left exactly as they were.
create or replace function private.validate_case_adult_identity()
returns trigger language plpgsql set search_path='' as $$
declare is_widow boolean; guardian_hidden boolean;
begin
  -- Keep direct table writes behind the same permission boundary as the RPC.
  -- Row policies run after BEFORE triggers, so fail here with the expected
  -- access error before revealing profile validation details to read-only staff.
  if coalesce(auth.role(),'') in ('anon','authenticated') and not public.has_permission('casesWrite') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select exists(select 1 from public.case_file_categories where family_id=new.id and category='أرملة') into is_widow;
  select exists(select 1 from public.case_file_categories where family_id=new.id and category in ('أرملة','هجر','مطلقة')) into guardian_hidden;
  if is_widow and (nullif(btrim(new.father_name),'') is not null or new.father_national_id is not null or new.father_national_id_expires_on is not null or new.father_date_of_birth is not null or new.father_gender is not null or nullif(btrim(new.father_health_condition),'') is not null or new.father_health_status is not null or new.father_employment_status is not null or nullif(btrim(new.father_occupation),'') is not null) then
    raise exception 'Father fields are hidden for this case category' using errcode='23514';
  end if;
  if guardian_hidden and (nullif(btrim(new.contact_name),'') is not null or nullif(btrim(new.contact_relationship),'') is not null or new.contact_age is not null or new.national_id is not null or new.national_id_expires_on is not null or new.contact_date_of_birth is not null or new.contact_gender is not null) then
    raise exception 'Guardian fields are hidden for this case category' using errcode='23514';
  end if;
  if tg_op='UPDATE'
    and new.national_id is not distinct from old.national_id
    and new.father_national_id is not distinct from old.father_national_id
    and new.mother_national_id is not distinct from old.mother_national_id
    and new.contact_date_of_birth is not distinct from old.contact_date_of_birth
    and new.father_date_of_birth is not distinct from old.father_date_of_birth
    and new.mother_date_of_birth is not distinct from old.mother_date_of_birth then
    return new;
  end if;
  if not public.case_national_id_is_valid(new.national_id)
    or not public.case_national_id_is_valid(new.father_national_id)
    or not public.case_national_id_is_valid(new.mother_national_id) then
    raise exception 'Invalid national ID' using errcode='23514';
  end if;
  if not (
    (not is_widow and public.case_identity_is_adult(new.father_national_id,new.father_date_of_birth))
    or public.case_identity_is_adult(new.mother_national_id,new.mother_date_of_birth)
    or (not guardian_hidden and public.case_identity_is_adult(new.national_id,new.contact_date_of_birth))
  ) then
    raise exception 'One adult national ID is required' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_case_adult_identity() from public,anon,authenticated;
drop trigger if exists families_adult_identity_guard on public.families;
create trigger families_adult_identity_guard
before insert or update of national_id,national_id_expires_on,contact_name,contact_relationship,contact_age,contact_date_of_birth,contact_gender,father_name,father_national_id,father_national_id_expires_on,father_health_condition,father_health_status,father_employment_status,father_occupation,father_date_of_birth,father_gender,mother_national_id,mother_date_of_birth,mother_gender on public.families
for each row execute function private.validate_case_adult_identity();

create or replace function public.save_case_file(p_id uuid,p_profile jsonb,p_categories text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; effective_profile jsonb; effective_categories text[];
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid case file' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_profile->>'mother_name'),'') is null then raise exception 'Mother name is required' using errcode='23514'; end if;
 if p_categories is not null and exists(select 1 from unnest(p_categories) category where category not in ('هجر','أرملة','مطلقة','عجز أو مرض','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى')) then
   raise exception 'Case category is retired or invalid' using errcode='23514';
 end if;
 effective_profile:=p_profile;
 effective_categories:=coalesce(p_categories,array[]::text[]);
 if p_categories is null and p_id is not null then
   select coalesce(array_agg(category),'{}'::text[]) into effective_categories from public.case_file_categories where family_id=p_id;
 end if;
 if exists(select 1 from unnest(effective_categories) category where category='أرملة') then
   effective_profile:=effective_profile||jsonb_build_object('father_name',null,'father_national_id',null,'father_national_id_expires_on',null,'father_date_of_birth',null,'father_gender',null,'father_health_condition',null,'father_health_status',null,'father_employment_status',null,'father_occupation',null);
 end if;
 if exists(select 1 from unnest(effective_categories) category where category in ('أرملة','هجر','مطلقة')) then
   effective_profile:=effective_profile||jsonb_build_object('contact_name',null,'contact_relationship',null,'contact_age',null,'national_id',null,'national_id_expires_on',null,'contact_date_of_birth',null,'contact_gender',null);
 end if;
 if not public.case_national_id_is_valid(effective_profile->>'father_national_id')
   or not public.case_national_id_is_valid(effective_profile->>'mother_national_id')
   or not public.case_national_id_is_valid(effective_profile->>'national_id') then
   raise exception 'Invalid national ID' using errcode='23514';
 end if;
 if not (
   public.case_identity_is_adult(effective_profile->>'father_national_id',nullif(effective_profile->>'father_date_of_birth','')::date)
   or public.case_identity_is_adult(effective_profile->>'mother_national_id',nullif(effective_profile->>'mother_date_of_birth','')::date)
   or public.case_identity_is_adult(effective_profile->>'national_id',nullif(effective_profile->>'contact_date_of_birth','')::date)
 ) then raise exception 'One adult national ID is required' using errcode='23514'; end if;
 if p_categories is not null and (select count(distinct category) from unnest(p_categories) category where category in ('هجر','أرملة','مطلقة'))>1 then
   raise exception 'Choose only one household marital status' using errcode='23514';
 end if;
 if p_id is not null and exists(select 1 from public.families where id=p_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 if p_id is not null and p_categories is not null then
   delete from public.case_file_categories where family_id=p_id and category in ('هجر','أرملة','مطلقة','عجز أو مرض','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى');
   insert into public.case_file_categories(family_id,category) select p_id,category from unnest(coalesce(p_categories,array[]::text[])) category;
 end if;
 if p_id is null then
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,national_id_expires_on,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,father_national_id,mother_national_id,father_national_id_expires_on,mother_national_id_expires_on,father_health_condition,mother_health_condition,father_health_status,mother_health_status,father_employment_status,mother_employment_status,father_occupation,mother_occupation,father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender,next_review_date)
  values(coalesce(effective_profile->>'name',''),effective_profile->>'phone',effective_profile->>'father_name',effective_profile->>'mother_name',effective_profile->>'contact_name',nullif(effective_profile->>'contact_age','')::smallint,effective_profile->>'national_id',nullif(effective_profile->>'national_id_expires_on','')::date,effective_profile->>'phone_2',effective_profile->>'phone_3',effective_profile->>'contact_relationship',coalesce(effective_profile->>'notes',''),effective_profile->>'address',nullif(effective_profile->>'monthly_income','')::numeric,effective_profile->>'health_condition',effective_profile->>'branch_area',coalesce(nullif(effective_profile->>'file_status',''),'تحت المراجعة'),effective_profile->>'status_reason',effective_profile->>'father_national_id',effective_profile->>'mother_national_id',nullif(effective_profile->>'father_national_id_expires_on','')::date,nullif(effective_profile->>'mother_national_id_expires_on','')::date,effective_profile->>'father_health_condition',effective_profile->>'mother_health_condition',effective_profile->>'father_health_status',effective_profile->>'mother_health_status',effective_profile->>'father_employment_status',effective_profile->>'mother_employment_status',effective_profile->>'father_occupation',effective_profile->>'mother_occupation',nullif(effective_profile->>'father_date_of_birth','')::date,nullif(effective_profile->>'father_gender',''),nullif(effective_profile->>'mother_date_of_birth','')::date,nullif(effective_profile->>'mother_gender',''),nullif(effective_profile->>'contact_date_of_birth','')::date,nullif(effective_profile->>'contact_gender',''),nullif(effective_profile->>'next_review_date','')::date) returning id into result;
 else
  update public.families set name=coalesce(effective_profile->>'name',''),phone=effective_profile->>'phone',father_name=effective_profile->>'father_name',mother_name=effective_profile->>'mother_name',contact_name=effective_profile->>'contact_name',contact_age=nullif(effective_profile->>'contact_age','')::smallint,national_id=effective_profile->>'national_id',national_id_expires_on=nullif(effective_profile->>'national_id_expires_on','')::date,phone_2=effective_profile->>'phone_2',phone_3=effective_profile->>'phone_3',contact_relationship=effective_profile->>'contact_relationship',notes=coalesce(effective_profile->>'notes',''),address=effective_profile->>'address',monthly_income=nullif(effective_profile->>'monthly_income','')::numeric,health_condition=effective_profile->>'health_condition',branch_area=effective_profile->>'branch_area',file_status=coalesce(nullif(effective_profile->>'file_status',''),'تحت المراجعة'),status_reason=effective_profile->>'status_reason',father_national_id=effective_profile->>'father_national_id',mother_national_id=effective_profile->>'mother_national_id',father_national_id_expires_on=nullif(effective_profile->>'father_national_id_expires_on','')::date,mother_national_id_expires_on=nullif(effective_profile->>'mother_national_id_expires_on','')::date,father_health_condition=effective_profile->>'father_health_condition',mother_health_condition=effective_profile->>'mother_health_condition',father_health_status=effective_profile->>'father_health_status',mother_health_status=effective_profile->>'mother_health_status',father_employment_status=effective_profile->>'father_employment_status',mother_employment_status=effective_profile->>'mother_employment_status',father_occupation=effective_profile->>'father_occupation',mother_occupation=effective_profile->>'mother_occupation',father_date_of_birth=nullif(effective_profile->>'father_date_of_birth','')::date,father_gender=nullif(effective_profile->>'father_gender',''),mother_date_of_birth=nullif(effective_profile->>'mother_date_of_birth','')::date,mother_gender=nullif(effective_profile->>'mother_gender',''),contact_date_of_birth=nullif(effective_profile->>'contact_date_of_birth','')::date,contact_gender=nullif(effective_profile->>'contact_gender',''),next_review_date=case when effective_profile ? 'next_review_date' then nullif(effective_profile->>'next_review_date','')::date else next_review_date end where id=p_id returning id into result;
  if result is null then raise exception 'Case file not found' using errcode='P0002'; end if;
 end if;
 if p_id is null and p_categories is not null then insert into public.case_file_categories(family_id,category) select result,category from unnest(coalesce(p_categories,array[]::text[])) category; end if;
 -- The per-child orphan choice is meaningful only while this case type is selected.
 if not exists(select 1 from public.case_file_categories where family_id=result and category='أخرى') then
   update public.family_members set father_status=null where family_id=result and father_status is not null;
 end if;
 return result;
end $$;
revoke all on function public.save_case_file(uuid,jsonb,text[]) from public,anon;
grant execute on function public.save_case_file(uuid,jsonb,text[]) to authenticated;

create or replace function public.update_case_file_identity(p_id uuid,p_national_id text,p_expires_on date)
returns void language plpgsql security invoker set search_path='' as $$
declare current_case public.families;
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
  select * into current_case from public.families where id=p_id and archived_at is null for update;
  if not found then raise exception 'Case file not found or archived' using errcode='P0002'; end if;
  if not (
    public.case_identity_is_adult(p_national_id,current_case.contact_date_of_birth)
    or public.case_identity_is_adult(current_case.father_national_id,current_case.father_date_of_birth)
    or public.case_identity_is_adult(current_case.mother_national_id,current_case.mother_date_of_birth)
  ) then raise exception 'One adult national ID is required' using errcode='23514'; end if;
  update public.families set national_id=p_national_id,national_id_expires_on=p_expires_on where id=p_id;
end $$;
revoke all on function public.update_case_file_identity(uuid,text,date) from public,anon;
grant execute on function public.update_case_file_identity(uuid,text,date) to authenticated;

create or replace function public.update_case_file_identity_profile(
 p_id uuid,p_national_id text,p_expires_on date,p_birth_date date,p_gender text,p_age smallint
) returns void language plpgsql security invoker set search_path='' as $$
declare current_case public.families;
declare is_widow boolean;
declare guardian_hidden boolean;
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
  if p_gender is not null and p_gender not in ('female','male') then raise exception 'Gender is invalid' using errcode='23514'; end if;
  if p_age is not null and p_age not between 0 and 120 then raise exception 'Age is invalid' using errcode='23514'; end if;
  select * into current_case from public.families where id=p_id and archived_at is null for update;
  if not found then raise exception 'Case file not found or archived' using errcode='P0002'; end if;
  if not (
    public.case_identity_is_adult(p_national_id,coalesce(p_birth_date,public.case_national_id_birth_date(p_national_id)))
    or public.case_identity_is_adult(current_case.father_national_id,current_case.father_date_of_birth)
    or public.case_identity_is_adult(current_case.mother_national_id,current_case.mother_date_of_birth)
  ) then raise exception 'One adult national ID is required' using errcode='23514'; end if;
  update public.families set national_id=p_national_id,national_id_expires_on=p_expires_on,
    contact_date_of_birth=p_birth_date,contact_gender=p_gender,contact_age=p_age where id=p_id;
end $$;
revoke all on function public.update_case_file_identity_profile(uuid,text,date,date,text,smallint) from public,anon;
grant execute on function public.update_case_file_identity_profile(uuid,text,date,date,text,smallint) to authenticated;

create or replace function public.update_case_parent_identity_profile(
 p_id uuid,p_parent text,p_national_id text,p_expires_on date,p_birth_date date,p_gender text
) returns void language plpgsql security invoker set search_path='' as $$
declare current_case public.families;
declare is_widow boolean;
declare guardian_hidden boolean;
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_parent not in ('father','mother') then raise exception 'Parent is invalid' using errcode='22023'; end if;
  if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
  if p_gender is not null and p_gender not in ('female','male') then raise exception 'Gender is invalid' using errcode='23514'; end if;
  if p_birth_date is not null and p_birth_date>(statement_timestamp() at time zone 'Africa/Cairo')::date then raise exception 'Birth date cannot be in the future' using errcode='23514'; end if;
  select * into current_case from public.families where id=p_id and archived_at is null for update;
  if not found then raise exception 'Case file not found or archived' using errcode='P0002'; end if;
  select exists(select 1 from public.case_file_categories where family_id=p_id and category='أرملة') into is_widow;
  select exists(select 1 from public.case_file_categories where family_id=p_id and category in ('أرملة','هجر','مطلقة')) into guardian_hidden;
  if p_parent='father' then
    if is_widow then raise exception 'Father fields are hidden for this case category' using errcode='23514'; end if;
    if not (public.case_identity_is_adult(p_national_id,p_birth_date) or public.case_identity_is_adult(current_case.mother_national_id,current_case.mother_date_of_birth) or (not guardian_hidden and public.case_identity_is_adult(current_case.national_id,current_case.contact_date_of_birth))) then
      raise exception 'One adult national ID is required' using errcode='23514';
    end if;
    if guardian_hidden then
      update public.families set father_national_id=p_national_id,father_national_id_expires_on=p_expires_on,father_date_of_birth=p_birth_date,father_gender=p_gender,contact_name=null,contact_relationship=null,contact_age=null,national_id=null,national_id_expires_on=null,contact_date_of_birth=null,contact_gender=null where id=p_id;
    else
      update public.families set father_national_id=p_national_id,father_national_id_expires_on=p_expires_on,father_date_of_birth=p_birth_date,father_gender=p_gender where id=p_id;
    end if;
  else
    if not (public.case_identity_is_adult(p_national_id,p_birth_date) or (not is_widow and public.case_identity_is_adult(current_case.father_national_id,current_case.father_date_of_birth)) or (not guardian_hidden and public.case_identity_is_adult(current_case.national_id,current_case.contact_date_of_birth))) then
      raise exception 'One adult national ID is required' using errcode='23514';
    end if;
    if is_widow then
      update public.families set mother_national_id=p_national_id,mother_national_id_expires_on=p_expires_on,mother_date_of_birth=p_birth_date,mother_gender=p_gender,father_name=null,father_national_id=null,father_national_id_expires_on=null,father_date_of_birth=null,father_gender=null,father_health_condition=null,father_health_status=null,father_employment_status=null,father_occupation=null,contact_name=null,contact_relationship=null,contact_age=null,national_id=null,national_id_expires_on=null,contact_date_of_birth=null,contact_gender=null where id=p_id;
    elsif guardian_hidden then
      update public.families set mother_national_id=p_national_id,mother_national_id_expires_on=p_expires_on,mother_date_of_birth=p_birth_date,mother_gender=p_gender,contact_name=null,contact_relationship=null,contact_age=null,national_id=null,national_id_expires_on=null,contact_date_of_birth=null,contact_gender=null where id=p_id;
    else
      update public.families set mother_national_id=p_national_id,mother_national_id_expires_on=p_expires_on,mother_date_of_birth=p_birth_date,mother_gender=p_gender where id=p_id;
    end if;
  end if;
end $$;
revoke all on function public.update_case_parent_identity_profile(uuid,text,text,date,date,text) from public,anon;
grant execute on function public.update_case_parent_identity_profile(uuid,text,text,date,date,text) to authenticated;

create or replace function private.is_case_child_relationship(p_relationship text)
returns boolean language sql immutable set search_path='' as $$
  select lower(btrim(coalesce(p_relationship,'')))=any(array['ابن','الابن','ابني','ابنى','ابنة','الابنة','بنت','البنت','ولد','الولد','طفل','الطفل','طفلة','الطفلة'])
$$;
revoke all on function private.is_case_child_relationship(text) from public,anon,authenticated;

create or replace function private.validate_case_member_father_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare is_other_case boolean; is_child boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if exists(select 1 from public.families where id=new.family_id and archived_at is not null) then raise exception 'Archived case files cannot be changed' using errcode='42501'; end if;
  select exists(select 1 from public.case_file_categories where family_id=new.family_id and category='أخرى') into is_other_case;
  is_child:=private.is_case_child_relationship(new.relationship);
  if is_child and is_other_case and new.father_status is null then raise exception 'Choose the child''s father status' using errcode='23514'; end if;
  if new.father_status is not null and (not is_child or not is_other_case) then raise exception 'Father status is only for children in other case files' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function private.validate_case_member_father_status() from public,anon,authenticated;
drop trigger if exists case_member_father_status_validate on public.family_members;
create trigger case_member_father_status_validate before insert or update of family_id,relationship,father_status on public.family_members
for each row execute function private.validate_case_member_father_status();

create or replace function public.add_case_member_profile(
 p_family_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date,
 p_health_status text,p_health_details text,p_employment_status text,p_occupation text,p_national_id text,p_father_status text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 200 then raise exception 'Name is required' using errcode='23514'; end if;
 if p_relationship is null or length(btrim(p_relationship)) not between 1 and 100 then raise exception 'Relationship is required' using errcode='23514'; end if;
 if p_gender is not null and p_gender not in ('female','male') then raise exception 'Gender is invalid' using errcode='23514'; end if;
 if p_health_status is not null and p_health_status not in ('عجز / إعاقة','مرض','حالة مستقرة') then raise exception 'Health status is invalid' using errcode='23514'; end if;
 if p_employment_status is not null and p_employment_status not in ('يعمل','لا يعمل','طفل','طفلة') then raise exception 'Employment status is invalid' using errcode='23514'; end if;
 if p_occupation is not null and (length(p_occupation)>200 or (p_employment_status is distinct from 'يعمل' and length(btrim(p_occupation))>0)) then raise exception 'Occupation is invalid' using errcode='23514'; end if;
 if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
 if p_date_of_birth is not null and p_date_of_birth>(statement_timestamp() at time zone 'Africa/Cairo')::date then raise exception 'Birth date cannot be in the future' using errcode='23514'; end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then raise exception 'Archived case files cannot be changed' using errcode='42501'; end if;
 insert into public.people(name,gender,date_of_birth,health_status,health_details,health_condition,employment_status,occupation,national_id)
 values(btrim(p_name),p_gender,p_date_of_birth,p_health_status,p_health_details,p_health_details,p_employment_status,case when p_employment_status='يعمل' then nullif(btrim(p_occupation),'') else null end,p_national_id) returning id into person;
 insert into public.family_members(family_id,person_id,relationship,father_status) values(p_family_id,person,btrim(p_relationship),p_father_status);
 return person;
end $$;
revoke all on function public.add_case_member_profile(uuid,text,text,text,date,text,text,text,text,text,text) from public,anon;
grant execute on function public.add_case_member_profile(uuid,text,text,text,date,text,text,text,text,text,text) to authenticated;

create or replace function public.update_case_member_profile(
 p_family_id uuid,p_person_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date,
 p_health_status text,p_health_details text,p_employment_status text,p_occupation text,p_national_id text,p_father_status text
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 200 then raise exception 'Name is required' using errcode='23514'; end if;
 if p_relationship is null or length(btrim(p_relationship)) not between 1 and 100 then raise exception 'Relationship is required' using errcode='23514'; end if;
 if p_gender is not null and p_gender not in ('female','male') then raise exception 'Gender is invalid' using errcode='23514'; end if;
 if p_health_status is not null and p_health_status not in ('عجز / إعاقة','مرض','حالة مستقرة') then raise exception 'Health status is invalid' using errcode='23514'; end if;
 if p_employment_status is not null and p_employment_status not in ('يعمل','لا يعمل','طفل','طفلة') then raise exception 'Employment status is invalid' using errcode='23514'; end if;
 if p_occupation is not null and (length(p_occupation)>200 or (p_employment_status is distinct from 'يعمل' and length(btrim(p_occupation))>0)) then raise exception 'Occupation is invalid' using errcode='23514'; end if;
 if not public.case_national_id_is_valid(p_national_id) then raise exception 'Invalid national ID' using errcode='23514'; end if;
 if p_date_of_birth is not null and p_date_of_birth>(statement_timestamp() at time zone 'Africa/Cairo')::date then raise exception 'Birth date cannot be in the future' using errcode='23514'; end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then raise exception 'Archived case files cannot be changed' using errcode='42501'; end if;
 update public.people set name=btrim(p_name),gender=p_gender,date_of_birth=p_date_of_birth,health_status=p_health_status,
   health_details=p_health_details,health_condition=p_health_details,employment_status=p_employment_status,
   occupation=case when p_employment_status='يعمل' then nullif(btrim(p_occupation),'') else null end,national_id=p_national_id
 where id=p_person_id;
 if not found then raise exception 'Member not found' using errcode='P0002'; end if;
 update public.family_members set relationship=btrim(p_relationship),father_status=p_father_status
 where family_id=p_family_id and person_id=p_person_id;
 if not found then raise exception 'Member not found in case file' using errcode='P0002'; end if;
end $$;
revoke all on function public.update_case_member_profile(uuid,uuid,text,text,text,date,text,text,text,text,text,text) from public,anon;
grant execute on function public.update_case_member_profile(uuid,uuid,text,text,text,date,text,text,text,text,text,text) to authenticated;
