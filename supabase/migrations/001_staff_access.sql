create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.employees (
 id uuid primary key default gen_random_uuid(), employee_code text not null unique check(employee_code ~ '^[A-Za-z0-9_-]{1,32}$'),
 display_name text not null check(length(display_name) between 1 and 100),
 role text not null default 'employee' check(role in ('employee','manager','general_manager')), active boolean not null default true,
 created_at timestamptz not null default now()
);
-- Keep the Auth mapping outside employee-readable rows.
create table private.employee_auth(employee_id uuid primary key references public.employees(id) on delete restrict, auth_user_id uuid not null unique references auth.users(id) on delete restrict);
create table public.employee_permissions(employee_id uuid primary key references public.employees(id) on delete cascade,
 cases_read boolean not null default false,cases_write boolean not null default false,donations_read boolean not null default false,donations_write boolean not null default false,assistant_use boolean not null default false);
create table private.revoked_sessions(session_id uuid primary key,revoked_at timestamptz not null default now());
create table private.login_attempts(key text primary key,attempts int not null,window_start timestamptz not null);
create table private.staff_audit(id bigint generated always as identity primary key,actor_id uuid references public.employees(id),employee_id uuid not null references public.employees(id),action text not null,created_at timestamptz not null default now());
alter table public.employees enable row level security;
alter table public.employee_permissions enable row level security;
revoke all on public.employees,public.employee_permissions from anon,authenticated;
grant select on public.employees,public.employee_permissions to authenticated;

create function public.current_employee_id() returns uuid language sql stable security definer set search_path='' as $$
 select e.id from public.employees e join private.employee_auth a on a.employee_id=e.id join auth.sessions s on s.user_id=a.auth_user_id
 where a.auth_user_id=(select auth.uid()) and e.active and s.id::text=(select auth.jwt()->>'session_id')
 and s.created_at>statement_timestamp()-interval '30 days' and (s.not_after is null or s.not_after>statement_timestamp())
 and not exists(select 1 from private.revoked_sessions r where r.session_id=s.id)
$$;
create function public.current_staff_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.employees where id=(select public.current_employee_id())
$$;
create function public.has_permission(permission text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when e.role in ('manager','general_manager') then true else case permission
 when 'casesRead' then coalesce(p.cases_read or p.cases_write,false) when 'casesWrite' then coalesce(p.cases_write,false)
 when 'donationsRead' then coalesce(p.donations_read or p.donations_write,false) when 'donationsWrite' then coalesce(p.donations_write,false)
 when 'assistantUse' then coalesce(p.assistant_use,false) else false end end
 from public.employees e left join public.employee_permissions p on p.employee_id=e.id where e.id=(select public.current_employee_id())),false)
 and permission in ('casesRead','casesWrite','donationsRead','donationsWrite','assistantUse')
$$;
create policy employee_read on public.employees for select to authenticated using(id=(select public.current_employee_id()) or (select public.current_staff_role()) in ('manager','general_manager'));
create policy permission_read on public.employee_permissions for select to authenticated using(employee_id=(select public.current_employee_id()) or (select public.current_staff_role()) in ('manager','general_manager'));
create function public.staff_profile() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',e.id,'employeeCode',e.employee_code,'displayName',e.display_name,'role',e.role,'active',e.active,
 'permissions',jsonb_build_object('casesRead',coalesce(p.cases_read,false),'casesWrite',coalesce(p.cases_write,false),'donationsRead',coalesce(p.donations_read,false),'donationsWrite',coalesce(p.donations_write,false),'assistantUse',coalesce(p.assistant_use,false)))
 from public.employees e left join public.employee_permissions p on p.employee_id=e.id where e.id=(select public.current_employee_id())
$$;
create function public.register_employee(p_auth_user_id uuid,p_employee_code text,p_display_name text,p_role text,p_permissions jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_employee_id(); actor_role text:=public.current_staff_role(); employee uuid;
begin
 if actor_role is null or actor_role not in ('manager','general_manager') or (actor_role='manager' and p_role<>'employee') then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.employees(employee_code,display_name,role) values(p_employee_code,p_display_name,p_role) returning id into employee;
 insert into private.employee_auth(employee_id,auth_user_id) values(employee,p_auth_user_id);
 insert into public.employee_permissions values(employee,coalesce((p_permissions->>'casesRead')::boolean,false),coalesce((p_permissions->>'casesWrite')::boolean,false),coalesce((p_permissions->>'donationsRead')::boolean,false),coalesce((p_permissions->>'donationsWrite')::boolean,false),coalesce((p_permissions->>'assistantUse')::boolean,false));
 insert into private.staff_audit(actor_id,employee_id,action) values(actor,employee,'created'); return employee;
end $$;
create function public.deactivate_employee(employee uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.current_staff_role() is distinct from 'general_manager' then raise exception 'Access denied' using errcode='42501'; end if;
 insert into private.staff_audit(actor_id,employee_id,action) values(public.current_employee_id(),employee,'deactivated');
 update public.employees set active=false where id=employee;
end $$;
create function public.set_employee_permissions(employee uuid,permissions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor_role text:=public.current_staff_role();
begin
 if actor_role is null or actor_role not in ('manager','general_manager') or (actor_role='manager' and not exists(select 1 from public.employees where id=employee and role='employee')) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.employee_permissions values(employee,coalesce((permissions->>'casesRead')::boolean,false),coalesce((permissions->>'casesWrite')::boolean,false),coalesce((permissions->>'donationsRead')::boolean,false),coalesce((permissions->>'donationsWrite')::boolean,false),coalesce((permissions->>'assistantUse')::boolean,false))
 on conflict(employee_id) do update set cases_read=excluded.cases_read,cases_write=excluded.cases_write,donations_read=excluded.donations_read,donations_write=excluded.donations_write,assistant_use=excluded.assistant_use;
 insert into private.staff_audit(actor_id,employee_id,action) values(public.current_employee_id(),employee,'permissions_changed');
end $$;
create function public.revoke_staff_session() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.revoked_sessions(session_id) select id from auth.sessions where user_id=(select auth.uid()) and id::text=(select auth.jwt()->>'session_id') on conflict do nothing;
end $$;
create function public.lookup_staff_login(code text) returns text language sql stable security definer set search_path='' as $$
 select u.email from public.employees e join private.employee_auth a on a.employee_id=e.id join auth.users u on u.id=a.auth_user_id where e.employee_code=code and e.active
$$;
create function public.consume_login_attempt(bucket text,maximum int) returns boolean language plpgsql security definer set search_path='' as $$
declare count_now int;
begin
 delete from private.login_attempts where window_start<statement_timestamp()-interval '1 day';
 insert into private.login_attempts values(bucket,1,statement_timestamp()) on conflict(key) do update set
 attempts=case when private.login_attempts.window_start<statement_timestamp()-interval '15 minutes' then 1 else private.login_attempts.attempts+1 end,
 window_start=case when private.login_attempts.window_start<statement_timestamp()-interval '15 minutes' then statement_timestamp() else private.login_attempts.window_start end
 returning attempts into count_now; return count_now<=maximum;
end $$;
-- Invoked on initial issue and refresh; internal email must not appear in browser JWTs.
create function public.staff_access_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from private.employee_auth a join public.employees e on e.id=a.employee_id where a.auth_user_id=(event->>'user_id')::uuid and e.active) then
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Access denied')); end if;
 return jsonb_set(event,'{claims}',((event->'claims')-'user_metadata') || jsonb_build_object('email','','phone',''));
end $$;
revoke all on function public.current_employee_id(),public.current_staff_role(),public.has_permission(text),public.staff_profile(),public.register_employee(uuid,text,text,text,jsonb),public.deactivate_employee(uuid),public.set_employee_permissions(uuid,jsonb),public.revoke_staff_session(),public.lookup_staff_login(text),public.consume_login_attempt(text,int),public.staff_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.current_employee_id(),public.current_staff_role(),public.has_permission(text),public.staff_profile(),public.register_employee(uuid,text,text,text,jsonb),public.deactivate_employee(uuid),public.set_employee_permissions(uuid,jsonb),public.revoke_staff_session() to authenticated;
grant execute on function public.lookup_staff_login(text),public.consume_login_attempt(text,int) to service_role;
grant execute on function public.staff_access_token_hook(jsonb) to supabase_auth_admin;
