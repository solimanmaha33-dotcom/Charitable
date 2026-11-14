-- Every case file needs at least one case type, including writes made outside
-- the browser. Deferred checks allow save_case_file to replace its category
-- set atomically inside one transaction.
create or replace function private.validate_case_file_has_category()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_family_id uuid;
begin
  if tg_table_name='families' then
    if tg_op='DELETE' then return null; end if;
    target_family_id:=new.id;
    if not exists(select 1 from public.case_file_categories where family_id=target_family_id) then
      raise exception 'A case file must have at least one category' using errcode='23514';
    end if;
    return null;
  end if;

  if tg_op in ('UPDATE','DELETE') then
    target_family_id:=old.family_id;
    if exists(select 1 from public.families where id=target_family_id)
      and not exists(select 1 from public.case_file_categories where family_id=target_family_id) then
      raise exception 'A case file must have at least one category' using errcode='23514';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') and (tg_op='INSERT' or new.family_id is distinct from old.family_id) then
    target_family_id:=new.family_id;
    if exists(select 1 from public.families where id=target_family_id)
      and not exists(select 1 from public.case_file_categories where family_id=target_family_id) then
      raise exception 'A case file must have at least one category' using errcode='23514';
    end if;
  end if;
  return null;
end
$$;
revoke all on function private.validate_case_file_has_category() from public,anon,authenticated;

drop trigger if exists case_file_requires_category_family on public.families;
create constraint trigger case_file_requires_category_family
after insert on public.families
deferrable initially deferred
for each row execute function private.validate_case_file_has_category();

drop trigger if exists case_file_requires_category_link on public.case_file_categories;
create constraint trigger case_file_requires_category_link
after insert or update or delete on public.case_file_categories
deferrable initially deferred
for each row execute function private.validate_case_file_has_category();
