-- Serialize permission edits and reject a stale snapshot without changing any flag.
create function public.compare_set_employee_permissions(employee uuid, expected_permissions jsonb, permissions jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor_role text:=public.current_staff_role(); current_permissions public.employee_permissions%rowtype;
begin
 if actor_role is null or actor_role not in ('manager','general_manager') or (actor_role='manager' and not exists(select 1 from public.employees where id=employee and role='employee')) then
  raise exception 'Access denied' using errcode='42501';
 end if;
 insert into public.employee_permissions(employee_id) values(employee) on conflict(employee_id) do nothing;
 select * into current_permissions from public.employee_permissions where employee_id=employee for update;
 if current_permissions.cases_read is distinct from coalesce((expected_permissions->>'casesRead')::boolean,false)
 or current_permissions.cases_write is distinct from coalesce((expected_permissions->>'casesWrite')::boolean,false)
 or current_permissions.donations_read is distinct from coalesce((expected_permissions->>'donationsRead')::boolean,false)
 or current_permissions.donations_write is distinct from coalesce((expected_permissions->>'donationsWrite')::boolean,false)
 or current_permissions.assistant_use is distinct from coalesce((expected_permissions->>'assistantUse')::boolean,false) then
  return false;
 end if;
 perform public.set_employee_permissions(employee,permissions);
 return true;
end $$;
revoke all on function public.compare_set_employee_permissions(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.compare_set_employee_permissions(uuid,jsonb,jsonb) to authenticated;
