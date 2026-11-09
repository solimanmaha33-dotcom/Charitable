alter table public.families
  add column if not exists father_name text,
  add column if not exists mother_name text,
  add column if not exists contact_relationship text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.families'::regclass
      and conname = 'families_father_name_check'
  ) then
    alter table public.families add constraint families_father_name_check
      check (father_name is null or length(btrim(father_name)) between 1 and 200) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.families'::regclass
      and conname = 'families_mother_name_check'
  ) then
    alter table public.families add constraint families_mother_name_check
      check (mother_name is null or length(btrim(mother_name)) between 1 and 200) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.families'::regclass
      and conname = 'families_contact_relationship_check'
  ) then
    alter table public.families add constraint families_contact_relationship_check
      check (contact_relationship is null or length(btrim(contact_relationship)) between 1 and 100) not valid;
  end if;
end $$;

grant insert(father_name, mother_name, contact_relationship),
  update(father_name, mother_name, contact_relationship)
  on public.families to authenticated;
