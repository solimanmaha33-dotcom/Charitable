-- Donation permissions are independent of case permissions. Family linking requires both.
create table public.donors (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 200), phone text,
 created_at timestamptz not null default now()
);
create table public.donations (
 id uuid primary key default gen_random_uuid(), donor_id uuid references public.donors(id),
 donation_type text not null check(donation_type in ('cash','in_kind_food','clothing','medicine','zakat','sadaqa','zakat_al_fitr','ramadan_food_bags','eid_clothing','sacrificial_meat','blankets','school_supplies','treatment_support')),
 kind text not null check(kind in ('cash','in_kind')),
 amount numeric(12,2), currency text not null default 'EGP' check(currency='EGP'),
 quantity numeric(12,3), unit text, description text not null default '', received_on date not null,
 created_at timestamptz not null default now(),
 check((kind='cash' and amount>0 and amount<>'NaN'::numeric and amount is not null and quantity is null and unit is null)
 or (kind='in_kind' and amount is null and quantity>0 and quantity<>'NaN'::numeric and quantity is not null and length(btrim(unit)) between 1 and 100 and unit is not null and length(btrim(description)) between 1 and 2000))
);
create index donations_donor_idx on public.donations(donor_id);
create table public.sponsorships (
 id uuid primary key default gen_random_uuid(), donor_id uuid not null references public.donors(id), family_id uuid not null references public.families(id),
 monthly_amount numeric(12,2) not null check(monthly_amount>0 and monthly_amount<>'NaN'::numeric), currency text not null default 'EGP' check(currency='EGP'),
 start_date date not null, end_date date, created_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date)
);
create index sponsorships_donor_idx on public.sponsorships(donor_id);
create index sponsorships_family_idx on public.sponsorships(family_id);
create table public.sponsorship_payments (
 id uuid primary key default gen_random_uuid(), sponsorship_id uuid not null references public.sponsorships(id),
 installment_month date not null check(extract(day from installment_month)=1), due_date date not null,
 amount_due numeric(12,2) not null check(amount_due>0 and amount_due<>'NaN'::numeric),
 received_on date, amount_received numeric(12,2), currency text not null default 'EGP' check(currency='EGP'),
 unique(sponsorship_id,installment_month),
 check((received_on is null and amount_received is null) or (received_on is not null and amount_received is not null and amount_received>0 and amount_received<>'NaN'::numeric))
);
-- Date math anchors every month to the original start day, including leap years.
create function public.sponsorship_due_date(start_date date, month_date date) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',month_date)::date + least(extract(day from start_date)::int,extract(day from (date_trunc('month',month_date)+interval '1 month - 1 day'))::int)-1)::date
$$;
create function private.validate_sponsorship_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sponsorships;
begin
 -- Serialize schedule changes with payment generation/receipt writes.
 select * into s from public.sponsorships where id=new.sponsorship_id for update;
 if not found then raise exception 'Unknown sponsorship' using errcode='23503'; end if;
 if tg_op='UPDATE' and (new.sponsorship_id,new.installment_month,new.due_date,new.amount_due) is distinct from (old.sponsorship_id,old.installment_month,old.due_date,old.amount_due) then
  raise exception 'Installment schedule is immutable' using errcode='23514';
 end if;
 if new.due_date<>public.sponsorship_due_date(s.start_date,new.installment_month) or new.due_date<s.start_date or (s.end_date is not null and new.due_date>s.end_date) or (tg_op='INSERT' and new.amount_due<>s.monthly_amount) then
  raise exception 'Invalid installment schedule' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validate_sponsorship_payment before insert or update on public.sponsorship_payments for each row execute function private.validate_sponsorship_payment();
create function private.end_sponsorship() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.start_date,new.monthly_amount,new.donor_id,new.family_id) is distinct from (old.start_date,old.monthly_amount,old.donor_id,old.family_id) then
  raise exception 'Create a new sponsorship to change its schedule or parties' using errcode='23514';
 end if;
 if new.end_date is not null then
  if exists(select 1 from public.sponsorship_payments where sponsorship_id=new.id and due_date>new.end_date and received_on is not null) then
   raise exception 'End date precedes a received installment' using errcode='23514';
  end if;
  delete from public.sponsorship_payments where sponsorship_id=new.id and due_date>new.end_date and received_on is null;
 end if;
 return new;
end $$;
create trigger end_sponsorship before update on public.sponsorships for each row execute function private.end_sponsorship();
revoke all on public.donors,public.donations,public.sponsorships,public.sponsorship_payments from anon,authenticated;
grant select,insert,update on public.donors,public.donations,public.sponsorships,public.sponsorship_payments to authenticated;
do $$ declare t text; read_check text; write_check text; begin
 foreach t in array array['donors','donations','sponsorships','sponsorship_payments'] loop
  read_check:='(select public.has_permission(''donationsRead''))';
  write_check:='(select public.has_permission(''donationsWrite''))';
  if t='sponsorships' then
   read_check:=read_check||' and (select public.has_permission(''casesRead''))';
   write_check:=write_check||' and (select public.has_permission(''casesRead''))';
  end if;
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy donations_read on public.%I for select to authenticated using (%s)',t,read_check);
  execute format('create policy donations_insert on public.%I for insert to authenticated with check (%s)',t,write_check);
  execute format('create policy donations_update on public.%I for update to authenticated using (%s) with check (%s)',t,write_check,write_check);
 end loop;
end $$;
-- Explicit inclusive cutoff, at most end of the current UTC month. No reader-side writes.
create function public.generate_sponsorship_installments(p_through date) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.has_permission('donationsWrite') or not public.has_permission('casesRead') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_through is null or p_through>(date_trunc('month',statement_timestamp() at time zone 'UTC')+interval '1 month - 1 day')::date then
  raise exception 'Cutoff must not exceed current UTC month' using errcode='23514';
 end if;
 insert into public.sponsorship_payments(sponsorship_id,installment_month,due_date,amount_due)
 select s.id,m::date,public.sponsorship_due_date(s.start_date,m::date),s.monthly_amount
 from public.sponsorships s cross join lateral generate_series(date_trunc('month',s.start_date),date_trunc('month',least(p_through,coalesce(s.end_date,p_through))),interval '1 month') m
 where public.sponsorship_due_date(s.start_date,m::date) between s.start_date and least(p_through,coalesce(s.end_date,p_through))
 on conflict(sponsorship_id,installment_month) do nothing;
end $$;
-- This pure date helper exposes no data or private schema access.
revoke all on function public.sponsorship_due_date(date,date),private.validate_sponsorship_payment(),private.end_sponsorship() from public,anon,authenticated;
grant execute on function public.sponsorship_due_date(date,date) to authenticated;
revoke all on function public.generate_sponsorship_installments(date) from public,anon;
grant execute on function public.generate_sponsorship_installments(date) to authenticated;
