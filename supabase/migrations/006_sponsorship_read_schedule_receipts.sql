-- Reading a sponsorship materializes only its deterministic unpaid expected installments.
-- Readers receive no table write permission and cannot supply parties, amounts or receipts.
create or replace function public.generate_sponsorship_installments(p_through date) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_permission('donationsRead') or not public.has_permission('casesRead') then
  raise exception 'Access denied' using errcode='42501';
 end if;
 if p_through is null or p_through>(date_trunc('month',statement_timestamp() at time zone 'UTC')+interval '1 month - 1 day')::date then
  raise exception 'Cutoff must not exceed current UTC month' using errcode='23514';
 end if;
 insert into public.sponsorship_payments(sponsorship_id,installment_month,due_date,amount_due)
 select s.id,m::date,public.sponsorship_due_date(s.start_date,m::date),s.monthly_amount
 from public.sponsorships s cross join lateral generate_series(date_trunc('month',s.start_date),date_trunc('month',least(p_through,coalesce(s.end_date,p_through))),interval '1 month') m
 where public.sponsorship_due_date(s.start_date,m::date) between s.start_date and least(p_through,coalesce(s.end_date,p_through))
 and not exists(select 1 from public.sponsorship_payments p where p.sponsorship_id=s.id and p.installment_month=m::date)
 order by s.id,m
 on conflict(sponsorship_id,installment_month) do nothing;
end $$;
revoke all on function public.generate_sponsorship_installments(date) from public,anon;
grant execute on function public.generate_sponsorship_installments(date) to authenticated;

-- One immutable receipt per installment. Corrections require a separately designed workflow.
create function private.preserve_sponsorship_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if old.received_on is not null and (new.received_on,new.amount_received) is distinct from (old.received_on,old.amount_received) then
  raise exception 'Recorded sponsorship receipt is immutable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.preserve_sponsorship_receipt() from public,anon,authenticated;
create trigger preserve_sponsorship_receipt before update on public.sponsorship_payments for each row execute function private.preserve_sponsorship_receipt();
