-- Enforce numeric entry rules at the database boundary as well as in the UI.
create function private.validate_case_phone_numbers() returns trigger
language plpgsql set search_path='' as $$
begin
  new.phone := nullif(btrim(new.phone),'');
  new.phone_2 := nullif(btrim(new.phone_2),'');
  new.phone_3 := nullif(btrim(new.phone_3),'');
  if new.phone is not null and new.phone !~ '^[0-9]{11}$' then
    raise exception 'Mobile phone 1 must contain exactly 11 digits' using errcode='23514';
  end if;
  if new.phone_2 is not null and new.phone_2 !~ '^[0-9]{11}$' then
    raise exception 'Mobile phone 2 must contain exactly 11 digits' using errcode='23514';
  end if;
  if new.phone_3 is not null and new.phone_3 !~ '^[0-9]{10}$' then
    raise exception 'Home phone must contain exactly 10 digits' using errcode='23514';
  end if;
  if new.phone is null and new.phone_2 is null and new.phone_3 is null then
    raise exception 'At least one phone number is required' using errcode='23514';
  end if;
  return new;
end $$;

create trigger families_phone_numbers_validation
before insert or update of phone,phone_2,phone_3 on public.families
for each row execute function private.validate_case_phone_numbers();

create function private.validate_case_national_ids() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.national_id is not null and new.national_id !~ '^[0-9]{14}$' then
    raise exception 'National ID must contain exactly 14 digits' using errcode='23514';
  end if;
  if new.father_national_id is not null and new.father_national_id !~ '^[0-9]{14}$' then
    raise exception 'Father national ID must contain exactly 14 digits' using errcode='23514';
  end if;
  if new.mother_national_id is not null and new.mother_national_id !~ '^[0-9]{14}$' then
    raise exception 'Mother national ID must contain exactly 14 digits' using errcode='23514';
  end if;
  return new;
end $$;

create trigger families_national_id_validation
before insert or update of national_id,father_national_id,mother_national_id on public.families
for each row execute function private.validate_case_national_ids();

create function private.validate_integer_case_income() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.monthly_income is not null and new.monthly_income <> trunc(new.monthly_income) then
    raise exception 'Monthly income must contain digits only' using errcode='23514';
  end if;
  return new;
end $$;

create trigger families_integer_monthly_income_validation
before insert or update of monthly_income on public.families
for each row execute function private.validate_integer_case_income();

create function public.update_case_file_identity(p_id uuid,p_national_id text,p_expires_on date)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_national_id is not null and p_national_id !~ '^[0-9]{14}$' then
    raise exception 'National ID must contain exactly 14 digits' using errcode='23514';
  end if;
  update public.families set national_id=p_national_id,national_id_expires_on=p_expires_on
  where id=p_id and archived_at is null;
  if not found then raise exception 'Case file not found or archived' using errcode='P0002'; end if;
end $$;
revoke all on function public.update_case_file_identity(uuid,text,date) from public,anon;
grant execute on function public.update_case_file_identity(uuid,text,date) to authenticated;
