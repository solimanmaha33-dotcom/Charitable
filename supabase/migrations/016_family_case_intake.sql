alter table public.families
  add column father_name text,
  add column mother_name text,
  add column contact_relationship text;

alter table public.families
  add constraint families_father_name_check
    check (father_name is null or length(btrim(father_name)) between 1 and 200),
  add constraint families_mother_name_check
    check (mother_name is null or length(btrim(mother_name)) between 1 and 200),
  add constraint families_contact_relationship_check
    check (contact_relationship is null or length(btrim(contact_relationship)) between 1 and 100);

grant insert(father_name, mother_name, contact_relationship),
  update(father_name, mother_name, contact_relationship)
  on public.families to authenticated;
