-- Codes are generated only by the database and may never be changed or reused.
create sequence private.family_code_sequence as bigint;
create function private.next_family_code() returns text language sql volatile security definer set search_path='' as $$
 select 'F-' || lpad(n::text, greatest(4,length(n::text)), '0') from (select nextval('private.family_code_sequence') n) s
$$;
create table public.families (
 id uuid primary key default gen_random_uuid(), code text not null unique default private.next_family_code(),
 name text not null check(length(btrim(name)) between 1 and 200), phone text,
 created_at timestamptz not null default now()
);
create table public.people (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 200)
);
create table public.family_members (
 family_id uuid not null references public.families(id), person_id uuid not null references public.people(id),
 relationship text not null check(length(btrim(relationship)) between 1 and 100), primary key(family_id,person_id)
);
create index family_members_person_idx on public.family_members(person_id);
create table public.cases (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id),
 notes text not null default '', created_at timestamptz not null default now()
);
create index cases_family_idx on public.cases(family_id);
create table public.case_categories (
 case_id uuid not null references public.cases(id), category text not null check(category in ('هجر','وفاة','أرملة','مطلقة','عجز أو مرض','أيتام')),
 primary key(case_id,category)
);
-- Users cannot supply or update a code or delete rows; this preserves code history.
revoke all on public.families,public.people,public.family_members,public.cases,public.case_categories from anon,authenticated;
grant select on public.families,public.people,public.family_members,public.cases,public.case_categories to authenticated;
grant insert(name,phone), update(name,phone) on public.families to authenticated;
grant insert,update on public.people,public.family_members,public.cases,public.case_categories to authenticated;
grant delete on public.family_members,public.case_categories to authenticated;
do $$ declare t text; begin
 foreach t in array array['families','people','family_members','cases','case_categories'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy domain_read on public.%I for select to authenticated using ((select public.has_permission(''casesRead'')))',t);
  execute format('create policy domain_insert on public.%I for insert to authenticated with check ((select public.has_permission(''casesWrite'')))',t);
  execute format('create policy domain_update on public.%I for update to authenticated using ((select public.has_permission(''casesWrite''))) with check ((select public.has_permission(''casesWrite'')))',t);
 end loop;
 foreach t in array array['family_members','case_categories'] loop
  execute format('create policy domain_delete on public.%I for delete to authenticated using ((select public.has_permission(''casesWrite'')))',t);
 end loop;
end $$;
-- Atomic case save prevents a partially saved category selection.
create function public.save_case(p_id uuid,p_family_id uuid,p_notes text,p_categories text[]) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_id is null then
  insert into public.cases(family_id,notes) values(p_family_id,coalesce(p_notes,'')) returning id into result;
 else
  update public.cases set family_id=p_family_id,notes=coalesce(p_notes,'') where id=p_id returning id into result;
  if result is null then raise exception 'Case not found'; end if;
  delete from public.case_categories where case_id=result;
 end if;
 insert into public.case_categories(case_id,category) select result,unnest(coalesce(p_categories,array[]::text[]));
 return result;
end $$;
revoke all on function public.save_case(uuid,uuid,text,text[]) from public,anon;
grant execute on function public.save_case(uuid,uuid,text,text[]) to authenticated;
create function public.add_family_member(p_family_id uuid,p_name text,p_relationship text) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.people(name) values(p_name) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member(uuid,text,text) from public,anon;
grant execute on function public.add_family_member(uuid,text,text) to authenticated;
