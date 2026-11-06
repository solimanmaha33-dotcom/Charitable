create table public.case_file_search_text (
 file_id uuid primary key references public.case_files(id) on delete cascade,
 text text not null check (length(text) <= 30000),
 updated_at timestamptz not null default now()
);
alter table public.case_file_search_text enable row level security;
revoke all on public.case_file_search_text from public, anon, authenticated;
grant select on public.case_file_search_text to authenticated;
grant all on public.case_file_search_text to service_role;
create policy search_text_read on public.case_file_search_text for select to authenticated using (
 exists (select 1 from public.case_files f where f.id=file_id)
);
