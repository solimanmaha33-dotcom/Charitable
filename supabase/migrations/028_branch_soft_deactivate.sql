alter table public.case_branches
  add column is_active boolean not null default true;

revoke delete on public.case_branches from authenticated;
grant update (is_active) on public.case_branches to authenticated;

drop policy if exists case_branches_remove on public.case_branches;
create policy case_branches_deactivate on public.case_branches
  for update to authenticated
  using ((select public.has_permission('casesWrite')))
  with check ((select public.has_permission('casesWrite')));

create function private.prevent_referenced_case_branch_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.families where branch_area = old.name) then
    raise exception 'Cannot delete a branch referenced by a case file' using errcode = '23503';
  end if;
  return old;
end
$$;

revoke all on function private.prevent_referenced_case_branch_delete() from public, anon, authenticated;
create trigger case_branches_prevent_referenced_delete
before delete on public.case_branches
for each row execute function private.prevent_referenced_case_branch_delete();
