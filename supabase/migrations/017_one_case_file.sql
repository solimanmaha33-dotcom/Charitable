-- One family row is the canonical case-file root. Keep legacy rows and IDs intact
-- until all clients move to this schema; the new application reads the unified tables.
do $$ begin
 if exists(select 1 from public.families where code is null or length(btrim(code))=0)
    or exists(select code from public.families group by code having count(*)>1) then
  raise exception 'Case file codes must be present and unique before migration';
 end if;
end $$;

alter table public.families
  alter column name set default '',
  drop constraint if exists families_name_check,
  add constraint families_name_check check (length(btrim(name)) <= 200),
  add column address text,
  add column monthly_income numeric(12,2),
  add column health_condition text,
  add column branch_area text,
  add column file_status text not null default 'تحت المراجعة',
  add column status_reason text;

alter table public.families
  add constraint families_address_check check (address is null or length(address) <= 1000),
  add constraint families_monthly_income_check check (monthly_income is null or (monthly_income >= 0 and monthly_income <> 'NaN'::numeric)),
  add constraint families_health_condition_check check (health_condition is null or length(health_condition) <= 2000),
  add constraint families_branch_area_check check (branch_area is null or length(branch_area) <= 200),
  add constraint families_file_status_check check (file_status in ('نشط','موقوف','تحت المراجعة','مرفوض')),
  add constraint families_status_reason_check check (
    (file_status in ('موقوف','مرفوض') and status_reason is not null and length(btrim(status_reason)) between 1 and 1000)
    or (file_status in ('نشط','تحت المراجعة') and status_reason is null)
  );

grant insert(address,monthly_income,health_condition,branch_area,file_status,status_reason),
  update(address,monthly_income,health_condition,branch_area,file_status,status_reason)
  on public.families to authenticated;

create table public.case_file_categories (
  family_id uuid not null references public.families(id),
  -- Historical labels remain readable after migration; the UI only offers current categories.
  category text not null check (category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأم','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أيتام','وفاة')),
  created_at timestamptz not null default now(),
  primary key (family_id,category)
);
insert into public.case_file_categories(family_id,category)
select distinct c.family_id,cc.category
from public.cases c join public.case_categories cc on cc.case_id=c.id
on conflict do nothing;
create index case_file_categories_category_idx on public.case_file_categories(category,family_id);
alter table public.case_file_categories enable row level security;
revoke all on public.case_file_categories from public,anon,authenticated;
grant select,insert,delete on public.case_file_categories to authenticated;
create policy case_file_categories_read on public.case_file_categories for select to authenticated using ((select public.has_permission('casesRead')));
create policy case_file_categories_write on public.case_file_categories for insert to authenticated with check (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأم','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون')
);
create policy case_file_categories_delete on public.case_file_categories for delete to authenticated using (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأم','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون')
);

create table public.case_file_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  legacy_case_id uuid not null unique,
  notes text not null default '',
  created_at timestamptz not null,
  source text not null default 'سجل حالة قديم'
);
insert into public.case_file_history(family_id,legacy_case_id,notes,created_at)
select family_id,id,notes,created_at from public.cases
on conflict (legacy_case_id) do nothing;
create index case_file_history_family_date_idx on public.case_file_history(family_id,created_at desc);
alter table public.case_file_history enable row level security;
revoke all on public.case_file_history from public,anon,authenticated;
grant select on public.case_file_history to authenticated;
create policy case_file_history_read on public.case_file_history for select to authenticated using ((select public.has_permission('casesRead')));

create table public.legacy_case_map (
  legacy_case_id uuid primary key,
  family_id uuid not null references public.families(id)
);
insert into public.legacy_case_map(legacy_case_id,family_id)
select id,family_id from public.cases on conflict (legacy_case_id) do nothing;
alter table public.legacy_case_map enable row level security;
revoke all on public.legacy_case_map from public,anon,authenticated;
grant select on public.legacy_case_map to authenticated;
create policy legacy_case_map_read on public.legacy_case_map for select to authenticated using ((select public.has_permission('casesRead')));

create table public.legacy_family_names (
  family_id uuid primary key references public.families(id),
  old_name text not null,
  archived_at timestamptz not null default now()
);
insert into public.legacy_family_names(family_id,old_name)
select id,name from public.families where length(btrim(name))>0
on conflict (family_id) do nothing;
alter table public.legacy_family_names enable row level security;
revoke all on public.legacy_family_names from public,anon,authenticated;

create table public.case_attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  legacy_file_id uuid,
  legacy_source text check (legacy_source in ('case','family')),
  storage_path text not null,
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  uploaded_by uuid not null references auth.users(id),
  extracted_text text,
  created_at timestamptz not null default now(),
  unique(legacy_source,legacy_file_id)
);
insert into public.case_attachments(family_id,legacy_file_id,legacy_source,storage_path,file_name,mime_type,size_bytes,uploaded_by,extracted_text,created_at)
select c.family_id,cf.id,'case',cf.storage_path,cf.file_name,cf.mime_type,cf.size_bytes,cf.uploaded_by,st.text,cf.created_at
from public.case_files cf join public.cases c on c.id=cf.case_id
left join public.case_file_search_text st on st.file_id=cf.id
on conflict (legacy_source,legacy_file_id) do nothing;
insert into public.case_attachments(family_id,legacy_file_id,legacy_source,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at)
select ff.family_id,ff.id,'family',ff.storage_path,ff.file_name,ff.mime_type,ff.size_bytes,ff.uploaded_by,ff.created_at
from public.family_files ff
on conflict (legacy_source,legacy_file_id) do nothing;

do $$
declare expected_categories bigint; expected_history bigint; expected_attachments bigint;
begin
 select count(distinct (c.family_id,cc.category)) into expected_categories
 from public.cases c join public.case_categories cc on cc.case_id=c.id;
 select count(*) into expected_history from public.cases;
 select (select count(*) from public.case_files)+(select count(*) from public.family_files) into expected_attachments;
 if (select count(*) from public.case_file_categories)<>expected_categories then raise exception 'Case category migration count mismatch'; end if;
 if (select count(*) from public.case_file_history)<>expected_history then raise exception 'Case history migration count mismatch'; end if;
 if (select count(*) from public.legacy_case_map)<>expected_history then raise exception 'Legacy route map count mismatch'; end if;
 if (select count(*) from public.case_attachments)<>expected_attachments then raise exception 'Attachment migration count mismatch'; end if;
 if (select count(*) from public.legacy_family_names)<>(select count(*) from public.families where length(btrim(name))>0) then raise exception 'Legacy family name archive count mismatch'; end if;
 if exists(select 1 from public.sponsorships s left join public.families f on f.id=s.family_id where f.id is null) then raise exception 'Sponsorship link migration mismatch'; end if;
end $$;

-- Review likely duplicates without exposing names or merging records.
create view public.case_file_duplicate_review with (security_invoker=true) as
select a.id family_id,a.code family_code,b.id possible_duplicate_id,b.code possible_duplicate_code,
 case
  when nullif(a.national_id,'') is not null and a.national_id=b.national_id then 'رقم قومي متطابق'
  when exists (
   select 1 from unnest(array[a.phone,a.phone_2,a.phone_3]) ap
   join unnest(array[b.phone,b.phone_2,b.phone_3]) bp on lower(regexp_replace(btrim(ap),'[[:space:][:punct:]]','','g'))=lower(regexp_replace(btrim(bp),'[[:space:][:punct:]]','','g'))
   where nullif(regexp_replace(btrim(ap),'[[:space:][:punct:]]','','g'),'') is not null
  ) then 'رقم هاتف متطابق'
  else 'اسما الأب والأم متطابقان'
 end match_reason
from public.families a join public.families b on a.id::text<b.id::text
where (nullif(a.national_id,'') is not null and a.national_id=b.national_id)
 or exists (
   select 1 from unnest(array[a.phone,a.phone_2,a.phone_3]) ap
   join unnest(array[b.phone,b.phone_2,b.phone_3]) bp on lower(regexp_replace(btrim(ap),'[[:space:][:punct:]]','','g'))=lower(regexp_replace(btrim(bp),'[[:space:][:punct:]]','','g'))
   where nullif(regexp_replace(btrim(ap),'[[:space:][:punct:]]','','g'),'') is not null
 )
 or (nullif(lower(btrim(a.father_name)),'') is not null and lower(btrim(a.father_name))=lower(btrim(b.father_name))
     and nullif(lower(btrim(a.mother_name)),'') is not null and lower(btrim(a.mother_name))=lower(btrim(b.mother_name)));
revoke all on public.case_file_duplicate_review from public,anon,authenticated;
grant select on public.case_file_duplicate_review to authenticated;
create index case_attachments_family_date_idx on public.case_attachments(family_id,created_at desc);
alter table public.case_attachments enable row level security;
revoke all on public.case_attachments from public,anon,authenticated;
grant select on public.case_attachments to authenticated;
create policy case_attachments_read on public.case_attachments for select to authenticated using ((select public.has_permission('casesRead')));

-- Existing family IDs are already referenced by members, sponsorships and receipts; preserve them.
-- The old multi-case tables and file metadata remain as a restricted archive.
revoke all on public.cases,public.case_categories,public.case_files,public.family_files,public.case_file_search_text from public,anon,authenticated;
revoke all on function public.save_case(uuid,uuid,text,text[]) from public,anon,authenticated;
revoke all on function public.assistant_search_cases(text) from public,anon,authenticated;

-- Private Storage reads now resolve through the unified attachment index.
drop policy if exists case_objects_read on storage.objects;
create policy case_objects_read on storage.objects for select to authenticated using (
  bucket_id='case-files'
  and (select public.has_permission('casesRead'))
  and exists (select 1 from public.case_attachments a where a.storage_path=name)
);
-- Trusted Pages Functions use service-role access for writes/deletes; authenticated clients cannot bypass them.
drop policy if exists case_objects_insert on storage.objects;
drop policy if exists case_objects_delete_orphan on storage.objects;

create or replace function public.save_case_file(p_id uuid,p_profile jsonb,p_categories text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid case file' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_profile->>'mother_name'),'') is null then raise exception 'Mother name is required' using errcode='23514'; end if;
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

drop function if exists public.assistant_search_cases(text);
create function public.assistant_search_cases(p_question text)
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
  from public.families f where public.has_permission('casesRead')
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
