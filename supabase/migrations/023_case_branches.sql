create table public.case_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create unique index case_branches_name_normalized_idx on public.case_branches (lower(btrim(name)));

insert into public.case_branches(name) values ('القاهرة - المرج'),('الفيوم - جبل النجار')
on conflict do nothing;

alter table public.case_branches enable row level security;
revoke all on public.case_branches from public,anon,authenticated;
grant select,insert,delete on public.case_branches to authenticated;
create policy case_branches_read on public.case_branches for select to authenticated using (
  (select public.has_permission('casesRead'))
);
create policy case_branches_add on public.case_branches for insert to authenticated with check (
  (select public.has_permission('casesWrite'))
);
create policy case_branches_remove on public.case_branches for delete to authenticated using (
  (select public.has_permission('casesWrite'))
);
