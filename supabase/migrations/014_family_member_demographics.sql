alter table public.people
 add column gender text check (gender is null or gender in ('female','male')),
 add column date_of_birth date;

create function public.add_family_member_profile(
 p_family_id uuid,
 p_name text,
 p_relationship text,
 p_gender text,
 p_date_of_birth date
) returns uuid language plpgsql security invoker set search_path='' as $$
declare person uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.people(name,gender,date_of_birth) values(p_name,p_gender,p_date_of_birth) returning id into person;
 insert into public.family_members(family_id,person_id,relationship) values(p_family_id,person,p_relationship);
 return person;
end $$;
revoke all on function public.add_family_member_profile(uuid,text,text,text,date) from public,anon;
grant execute on function public.add_family_member_profile(uuid,text,text,text,date) to authenticated;
