alter table public.families
  add column archived_at timestamptz,
  add column archived_by uuid references public.employees(id) on delete restrict;

create table private.case_archive_audit (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete restrict,
  case_code text not null,
  actor_id uuid not null references public.employees(id) on delete restrict,
  action text not null check (action in ('archived','restored')),
  created_at timestamptz not null default now()
);
alter table private.case_archive_audit enable row level security;
revoke all on private.case_archive_audit from public,anon,authenticated;

create function private.reject_case_archive_audit_change()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Case archive audit is append-only' using errcode='42501';
end $$;
revoke all on function private.reject_case_archive_audit_change() from public,anon,authenticated;
create trigger case_archive_audit_append_only
  before update or delete on private.case_archive_audit
  for each row execute function private.reject_case_archive_audit_change();

create function public.archive_case_file(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; case_code text; current_archive timestamptz;
begin
  if public.current_staff_role() is distinct from 'general_manager' then
    raise exception 'Access denied' using errcode='42501';
  end if;
  actor := public.current_employee_id();
  select f.code,f.archived_at into case_code,current_archive
    from public.families f where f.id=p_id for update;
  if not found or current_archive is not null then
    raise exception 'Case file is missing or already archived' using errcode='P0002';
  end if;
  update public.families set archived_at=statement_timestamp(),archived_by=actor where id=p_id;
  insert into private.case_archive_audit(family_id,case_code,actor_id,action)
    values(p_id,case_code,actor,'archived');
end $$;

create function public.restore_case_file(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; case_code text; current_archive timestamptz;
begin
  if public.current_staff_role() is distinct from 'general_manager' then
    raise exception 'Access denied' using errcode='42501';
  end if;
  actor := public.current_employee_id();
  select f.code,f.archived_at into case_code,current_archive
    from public.families f where f.id=p_id for update;
  if not found or current_archive is null then
    raise exception 'Case file is missing or not archived' using errcode='P0002';
  end if;
  update public.families set archived_at=null,archived_by=null where id=p_id;
  insert into private.case_archive_audit(family_id,case_code,actor_id,action)
    values(p_id,case_code,actor,'restored');
end $$;
revoke all on function public.archive_case_file(uuid),public.restore_case_file(uuid) from public,anon,authenticated;
grant execute on function public.archive_case_file(uuid),public.restore_case_file(uuid) to authenticated;
revoke update(archived_at,archived_by) on public.families from public,anon,authenticated;

create function private.prevent_archived_case_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare family_ids uuid[] := array[]::uuid[];
begin
  if tg_op <> 'INSERT' then family_ids := array_append(family_ids,old.family_id); end if;
  if tg_op <> 'DELETE' then family_ids := array_append(family_ids,new.family_id); end if;
  if exists(select 1 from public.families f where f.id=any(family_ids) and f.archived_at is not null) then
    raise exception 'Archived case files cannot be changed' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.prevent_archived_case_write() from public,anon,authenticated;
create trigger family_members_active_case_only
  before insert or update or delete on public.family_members
  for each row execute function private.prevent_archived_case_write();
create trigger case_categories_active_case_only
  before insert or update or delete on public.case_file_categories
  for each row execute function private.prevent_archived_case_write();
create trigger case_attachments_active_case_only
  before insert or update or delete on public.case_attachments
  for each row execute function private.prevent_archived_case_write();

create function private.prevent_archived_case_profile_edit()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.archived_at is not null and (
    new.archived_at is not null or new.archived_by is not null
    or (to_jsonb(new) - array['archived_at','archived_by']) is distinct from
       (to_jsonb(old) - array['archived_at','archived_by'])
  ) then
    raise exception 'Archived case files must be restored before editing' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function private.prevent_archived_case_profile_edit() from public,anon,authenticated;
create trigger families_archive_before_edit
  before update on public.families
  for each row execute function private.prevent_archived_case_profile_edit();

-- Existing authenticated write functions must reject archived case files as well.
create or replace function public.add_family_member_profile(
 p_family_id uuid,p_name text,p_relationship text,p_gender text,p_date_of_birth date
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if exists(select 1 from public.families where id=p_family_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 insert into public.people(name,gender,date_of_birth) values(p_name,p_gender,p_date_of_birth) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member_profile(uuid,text,text,text,date) from public,anon;
grant execute on function public.add_family_member_profile(uuid,text,text,text,date) to authenticated;

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
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason)
  values(coalesce(p_profile->>'name',''),p_profile->>'phone',p_profile->>'father_name',p_profile->>'mother_name',p_profile->>'contact_name',nullif(p_profile->>'contact_age','')::smallint,p_profile->>'national_id',p_profile->>'phone_2',p_profile->>'phone_3',p_profile->>'contact_relationship',coalesce(p_profile->>'notes',''),p_profile->>'address',nullif(p_profile->>'monthly_income','')::numeric,p_profile->>'health_condition',p_profile->>'branch_area',coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),p_profile->>'status_reason') returning id into result;
 else
  update public.families set name=coalesce(p_profile->>'name',''),phone=p_profile->>'phone',father_name=p_profile->>'father_name',mother_name=p_profile->>'mother_name',contact_name=p_profile->>'contact_name',contact_age=nullif(p_profile->>'contact_age','')::smallint,national_id=p_profile->>'national_id',phone_2=p_profile->>'phone_2',phone_3=p_profile->>'phone_3',contact_relationship=p_profile->>'contact_relationship',notes=coalesce(p_profile->>'notes',''),address=p_profile->>'address',monthly_income=nullif(p_profile->>'monthly_income','')::numeric,health_condition=p_profile->>'health_condition',branch_area=p_profile->>'branch_area',file_status=coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),status_reason=p_profile->>'status_reason' where id=p_id returning id into result;
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

create or replace function public.assistant_search_cases(p_question text)
returns table(id uuid, notes text, case_file jsonb, case_file_categories jsonb, case_attachments jsonb)
language sql stable security invoker set search_path='' as $$
 with terms as (
  select distinct t.term from regexp_split_to_table(lower(left(coalesce(p_question,''),2000)), '[^[:alnum:]_-]+') t(term)
  where length(t.term) between 2 and 80 and t.term not in ('من','ما','هل','عن','في','على','التي','هذا','هذه','الاسرة','الأسرة','الحالات','حالة','الرجاء','اريد','أريد') limit 12
 ), ranked as (
  select f.id,f.code,f.father_name,f.mother_name,f.notes,
   (select count(*) from terms t where strpos(lower(coalesce(f.notes,'')||' '||f.code||' '||coalesce(f.father_name,'')||' '||coalesce(f.mother_name,'')||' '||coalesce(f.address,'')||' '||coalesce(f.health_condition,'')),t.term)>0
    or exists(select 1 from public.case_file_history h where h.family_id=f.id and strpos(lower(h.notes),t.term)>0)
    or exists(select 1 from public.case_file_categories cc where cc.family_id=f.id and strpos(lower(cc.category),t.term)>0)
    or exists(select 1 from public.case_attachments a where a.family_id=f.id and strpos(lower(a.file_name||' '||coalesce(a.extracted_text,'')),t.term)>0)) score
  from public.families f where public.has_permission('casesRead') and f.archived_at is null
 )
 select r.id,
  substring((coalesce(r.notes,'')||' '||coalesce((select string_agg(h.notes,' ') from public.case_file_history h where h.family_id=r.id),'')) from 1 for 1000),
  jsonb_build_object('code',r.code,'father_name',r.father_name,'mother_name',r.mother_name),
  coalesce((select jsonb_agg(jsonb_build_object('category',cc.category)) from public.case_file_categories cc where cc.family_id=r.id),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('file_name',q.file_name,'case_file_search_text',jsonb_build_object('text',q.excerpt))) from (
   select a.file_name,substring(coalesce(a.extracted_text,'') from greatest(1,coalesce((
    select min(strpos(lower(a.extracted_text),t.term)) from terms t where strpos(lower(a.file_name||' '||coalesce(a.extracted_text,'')),t.term)>0
   ),1)-200) for 800) excerpt
   from public.case_attachments a where a.family_id=r.id and a.extracted_text is not null
    and exists(select 1 from terms t where strpos(lower(a.file_name||' '||coalesce(a.extracted_text,'')),t.term)>0)
   order by (select count(*) from terms t where strpos(lower(a.file_name||' '||coalesce(a.extracted_text,'')),t.term)>0) desc,a.created_at desc,a.id
   limit 2
  ) q),'[]'::jsonb)
 from ranked r where r.score>0 or not exists(select 1 from terms) order by r.score desc,r.id limit 10
$$;
revoke all on function public.assistant_search_cases(text) from public,anon;
grant execute on function public.assistant_search_cases(text) to authenticated;
