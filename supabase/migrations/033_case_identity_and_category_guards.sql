-- Keep identity expiry reminders tied to a real, valid Egyptian ID.
-- A trigger is used instead of a CHECK because ID validity depends on Cairo's
-- current date and is therefore stable rather than immutable.
create or replace function private.validate_case_identity_expiry()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.national_id_expires_on is not null
    and (coalesce(btrim(new.national_id),'')='' or not public.case_national_id_is_valid(new.national_id)) then
    raise exception 'A valid National ID is required for its expiry date' using errcode='23514';
  end if;
  if new.father_national_id_expires_on is not null
    and (coalesce(btrim(new.father_national_id),'')='' or not public.case_national_id_is_valid(new.father_national_id)) then
    raise exception 'A valid father National ID is required for its expiry date' using errcode='23514';
  end if;
  if new.mother_national_id_expires_on is not null
    and (coalesce(btrim(new.mother_national_id),'')='' or not public.case_national_id_is_valid(new.mother_national_id)) then
    raise exception 'A valid mother National ID is required for its expiry date' using errcode='23514';
  end if;
  return new;
end
$$;
revoke all on function private.validate_case_identity_expiry() from public,anon,authenticated;
drop trigger if exists families_identity_expiry_guard on public.families;
create trigger families_identity_expiry_guard
before insert or update of national_id,national_id_expires_on,father_national_id,father_national_id_expires_on,mother_national_id,mother_national_id_expires_on
on public.families
for each row execute function private.validate_case_identity_expiry();

-- Categories and their related identity/member fields are changed by the
-- same save RPC. Deferred checks see the completed profile, while also
-- rejecting direct writes that leave incompatible values behind.
create or replace function private.validate_case_category_consistency()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_family_id uuid;
  current_case public.families;
  marital_category_count integer;
  has_widow boolean;
  has_hidden_guardian_category boolean;
  has_other_category boolean;
  has_child_father_status boolean;
begin
  if tg_table_name='families' then
    if tg_op='DELETE' then target_family_id:=old.id; else target_family_id:=new.id; end if;
  elsif tg_op='DELETE' then
    target_family_id:=old.family_id;
  else
    target_family_id:=new.family_id;
  end if;
  select * into current_case from public.families where id=target_family_id;
  if not found then return null; end if;

  select count(*) filter(where category in ('هجر','أرملة','مطلقة'))::integer,
         coalesce(bool_or(category='أرملة'),false),
         coalesce(bool_or(category in ('أرملة','هجر','مطلقة')),false),
         coalesce(bool_or(category='أخرى'),false)
    into marital_category_count,has_widow,has_hidden_guardian_category,has_other_category
    from public.case_file_categories where family_id=target_family_id;
  if marital_category_count>1 then
    raise exception 'Only one of widow, deserted, or divorced can be selected' using errcode='23514';
  end if;
  if has_widow and (
    current_case.father_name is not null or current_case.father_national_id is not null
    or current_case.father_national_id_expires_on is not null or current_case.father_date_of_birth is not null
    or current_case.father_gender is not null or current_case.father_health_status is not null
    or current_case.father_health_condition is not null or current_case.father_employment_status is not null
    or current_case.father_occupation is not null
  ) then
    raise exception 'Father fields must be empty for a widow case' using errcode='23514';
  end if;
  if has_hidden_guardian_category and (
    current_case.contact_name is not null or current_case.contact_relationship is not null
    or current_case.contact_age is not null or current_case.national_id is not null
    or current_case.national_id_expires_on is not null or current_case.contact_date_of_birth is not null
    or current_case.contact_gender is not null
  ) then
    raise exception 'Guardian fields must be empty for this case category' using errcode='23514';
  end if;
  select exists(select 1 from public.family_members where family_id=target_family_id and father_status is not null)
    into has_child_father_status;
  if has_child_father_status and not has_other_category then
    raise exception 'A child father status requires the other case category' using errcode='23514';
  end if;
  return null;
end
$$;
revoke all on function private.validate_case_category_consistency() from public,anon,authenticated;

drop trigger if exists case_category_consistency_categories on public.case_file_categories;
create constraint trigger case_category_consistency_categories
after insert or update or delete on public.case_file_categories
deferrable initially deferred
for each row execute function private.validate_case_category_consistency();

drop trigger if exists case_category_consistency_family_profile on public.families;
create constraint trigger case_category_consistency_family_profile
after insert or update of father_name,father_national_id,father_national_id_expires_on,father_date_of_birth,father_gender,father_health_status,father_health_condition,father_employment_status,father_occupation,contact_name,contact_relationship,contact_age,national_id,national_id_expires_on,contact_date_of_birth,contact_gender
on public.families
deferrable initially deferred
for each row execute function private.validate_case_category_consistency();

drop trigger if exists case_category_consistency_child_status on public.family_members;
create constraint trigger case_category_consistency_child_status
after insert or update or delete on public.family_members
deferrable initially deferred
for each row execute function private.validate_case_category_consistency();
