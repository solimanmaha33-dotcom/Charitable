-- Reversible financial actions, case aid delivery, and case review dates.
-- Additive only: preserve existing records and existing migration files.

alter table public.families add column if not exists next_review_date date;
grant insert(next_review_date), update(next_review_date) on public.families to authenticated;
alter table public.donations
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.employees(id) on delete restrict,
  add column if not exists void_reason text;
alter table public.sponsorship_payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.employees(id) on delete restrict,
  add column if not exists void_reason text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='donations_void_fields_check' and conrelid='public.donations'::regclass) then
    alter table public.donations add constraint donations_void_fields_check check (
      (voided_at is null and voided_by is null and void_reason is null) or
      (voided_at is not null and voided_by is not null and void_reason is not null and length(btrim(void_reason)) between 1 and 1000)
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='sponsorship_payments_void_fields_check' and conrelid='public.sponsorship_payments'::regclass) then
    alter table public.sponsorship_payments add constraint sponsorship_payments_void_fields_check check (
      (voided_at is null and voided_by is null and void_reason is null) or
      (voided_at is not null and voided_by is not null and void_reason is not null and length(btrim(void_reason)) between 1 and 1000)
    );
  end if;
end $$;

create table if not exists private.financial_action_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.employees(id) on delete restrict,
  record_table text not null check(record_table in ('donations','sponsorship_payments','case_disbursements')),
  record_id uuid not null,
  action text not null check(action in ('cancelled','voided')),
  reason text not null check(length(btrim(reason)) between 1 and 1000),
  before_values jsonb not null,
  after_values jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on private.financial_action_audit from public,anon,authenticated;

create or replace function private.prevent_financial_audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Financial audit records are immutable' using errcode='42501';
end $$;
revoke all on function private.prevent_financial_audit_change() from public,anon,authenticated;
drop trigger if exists financial_action_audit_immutable on private.financial_action_audit;
create trigger financial_action_audit_immutable before update or delete on private.financial_action_audit
for each row execute function private.prevent_financial_audit_change();

-- Existing donation entry screens do not edit saved donations. Restrict installment edits
-- to the receipt fields used by the existing compare-and-set receive flow.
revoke update on public.donations from authenticated;
revoke update on public.sponsorship_payments from authenticated;
grant update(received_on,amount_received) on public.sponsorship_payments to authenticated;

create function private.prevent_receipt_after_void()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.voided_at is not null and (new.received_on,new.amount_received) is distinct from (old.received_on,old.amount_received) then
    raise exception 'Canceled installments cannot be received' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.prevent_receipt_after_void() from public,anon,authenticated;
create trigger a_sponsorship_payment_void_guard before update of received_on,amount_received on public.sponsorship_payments
for each row execute function private.prevent_receipt_after_void();

create or replace function public.cancel_donation(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.donations; changed public.donations;
begin
  actor:=public.current_employee_id();
  if actor is null or not public.has_permission('donationsWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Cancellation reason is required' using errcode='23514'; end if;
  select * into previous from public.donations where id=p_id for update;
  if not found then raise exception 'Donation not found' using errcode='P0002'; end if;
  if previous.voided_at is not null then raise exception 'Donation is already canceled' using errcode='23514'; end if;
  update public.donations set voided_at=statement_timestamp(),voided_by=actor,void_reason=btrim(p_reason) where id=p_id returning * into changed;
  insert into private.financial_action_audit(actor_id,record_table,record_id,action,reason,before_values,after_values)
  values(actor,'donations',p_id,'cancelled',btrim(p_reason),
    jsonb_build_object('kind',previous.kind,'amount',previous.amount,'quantity',previous.quantity,'received_on',previous.received_on),
    jsonb_build_object('kind',changed.kind,'amount',changed.amount,'quantity',changed.quantity,'received_on',changed.received_on,'voided_at',changed.voided_at));
end $$;

create or replace function public.void_sponsorship_payment(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.sponsorship_payments; changed public.sponsorship_payments;
begin
  actor:=public.current_employee_id();
  if actor is null or not public.has_permission('donationsWrite') or not public.has_permission('casesRead') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Cancellation reason is required' using errcode='23514'; end if;
  select * into previous from public.sponsorship_payments where id=p_id for update;
  if not found then raise exception 'Installment not found' using errcode='P0002'; end if;
  if previous.voided_at is not null then raise exception 'Installment is already canceled' using errcode='23514'; end if;
  update public.sponsorship_payments set voided_at=statement_timestamp(),voided_by=actor,void_reason=btrim(p_reason) where id=p_id returning * into changed;
  insert into private.financial_action_audit(actor_id,record_table,record_id,action,reason,before_values,after_values)
  values(actor,'sponsorship_payments',p_id,'voided',btrim(p_reason),
    jsonb_build_object('amount_due',previous.amount_due,'amount_received',previous.amount_received,'received_on',previous.received_on),
    jsonb_build_object('amount_due',changed.amount_due,'amount_received',changed.amount_received,'received_on',changed.received_on,'voided_at',changed.voided_at));
end $$;

revoke all on function public.cancel_donation(uuid,text),public.void_sponsorship_payment(uuid,text) from public,anon;
grant execute on function public.cancel_donation(uuid,text),public.void_sponsorship_payment(uuid,text) to authenticated;

create table public.case_disbursements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.families(id) on delete restrict,
  branch_id uuid not null references public.case_branches(id) on delete restrict,
  disbursement_type text not null check(disbursement_type in ('كفالة شهرية','مساعدة موسمية','علاج','عيني','طوارئ')),
  amount numeric(12,2) not null check(amount>0 and amount<>'NaN'::numeric),
  items_summary text,
  disbursed_on date not null default ((statement_timestamp() at time zone 'Africa/Cairo')::date),
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  notes text,
  is_voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.employees(id) on delete restrict,
  check(disbursement_type<>'عيني' or (items_summary is not null and length(btrim(items_summary)) between 1 and 2000)),
  check(notes is null or length(notes)<=2000),
  check((not is_voided and void_reason is null and voided_at is null and voided_by is null) or
        (is_voided and void_reason is not null and length(btrim(void_reason)) between 1 and 1000 and voided_at is not null and voided_by is not null))
);
create index case_disbursements_case_date_idx on public.case_disbursements(case_id,disbursed_on desc,created_at desc);
alter table public.case_disbursements enable row level security;
revoke all on public.case_disbursements from public,anon,authenticated;
grant select on public.case_disbursements to authenticated;
create policy case_disbursements_read on public.case_disbursements for select to authenticated using((select public.has_permission('casesRead')));

create function public.record_case_disbursement(
  p_case_id uuid,p_branch_id uuid,p_type text,p_amount numeric,p_items_summary text,p_disbursed_on date,p_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid;
begin
  actor:=public.current_employee_id();
  if actor is null or not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_case_id is null or p_branch_id is null then raise exception 'Case and branch are required' using errcode='23514'; end if;
  if p_type is null or p_type not in ('كفالة شهرية','مساعدة موسمية','علاج','عيني','طوارئ') then raise exception 'Invalid aid type' using errcode='23514'; end if;
  if p_amount is null or p_amount<=0 or p_amount='NaN'::numeric then raise exception 'Amount must be positive' using errcode='23514'; end if;
  if p_type='عيني' and (p_items_summary is null or length(btrim(p_items_summary)) not between 1 and 2000) then raise exception 'Describe the in-kind aid' using errcode='23514'; end if;
  if p_notes is not null and length(p_notes)>2000 then raise exception 'Notes are too long' using errcode='23514'; end if;
  if not exists(select 1 from public.families where id=p_case_id and archived_at is null) then raise exception 'Case file not found or archived' using errcode='42501'; end if;
  if not exists(select 1 from public.case_branches where id=p_branch_id and is_active) then raise exception 'Branch not found or inactive' using errcode='23514'; end if;
  if exists(select 1 from public.families f join public.case_branches b on b.name=f.branch_area where f.id=p_case_id and b.is_active and b.id<>p_branch_id) then raise exception 'Selected branch does not match the case file' using errcode='23514'; end if;
  insert into public.case_disbursements(case_id,branch_id,disbursement_type,amount,items_summary,disbursed_on,created_by,notes)
  values(p_case_id,p_branch_id,p_type,p_amount,nullif(btrim(p_items_summary),''),coalesce(p_disbursed_on,(statement_timestamp() at time zone 'Africa/Cairo')::date),actor,nullif(btrim(p_notes),'')) returning id into result;
  return result;
end $$;

create function public.void_case_disbursement(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.case_disbursements; changed public.case_disbursements;
begin
  actor:=public.current_employee_id();
  if actor is null or not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Cancellation reason is required' using errcode='23514'; end if;
  select * into previous from public.case_disbursements where id=p_id for update;
  if not found then raise exception 'Disbursement not found' using errcode='P0002'; end if;
  if previous.is_voided then raise exception 'Disbursement is already canceled' using errcode='23514'; end if;
  if not exists(select 1 from public.families where id=previous.case_id and archived_at is null) then raise exception 'Archived case files cannot be changed' using errcode='42501'; end if;
  update public.case_disbursements set is_voided=true,void_reason=btrim(p_reason),voided_at=statement_timestamp(),voided_by=actor where id=p_id returning * into changed;
  insert into private.financial_action_audit(actor_id,record_table,record_id,action,reason,before_values,after_values)
  values(actor,'case_disbursements',p_id,'voided',btrim(p_reason),
    jsonb_build_object('case_id',previous.case_id,'branch_id',previous.branch_id,'type',previous.disbursement_type,'amount',previous.amount,'disbursed_on',previous.disbursed_on),
    jsonb_build_object('case_id',changed.case_id,'branch_id',changed.branch_id,'type',changed.disbursement_type,'amount',changed.amount,'disbursed_on',changed.disbursed_on,'is_voided',changed.is_voided));
end $$;
revoke all on function public.record_case_disbursement(uuid,uuid,text,numeric,text,date,text),public.void_case_disbursement(uuid,text) from public,anon;
grant execute on function public.record_case_disbursement(uuid,uuid,text,numeric,text,date,text),public.void_case_disbursement(uuid,text) to authenticated;

-- Keep the case-save RPC signature stable and tolerate old clients that omit the new field.
create or replace function public.save_case_file(p_id uuid,p_profile jsonb,p_categories text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if not public.has_permission('casesWrite') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' then raise exception 'Invalid case file' using errcode='22023'; end if;
 if p_id is null and nullif(btrim(p_profile->>'mother_name'),'') is null then raise exception 'Mother name is required' using errcode='23514'; end if;
 if p_categories is not null and (select count(distinct category) from unnest(p_categories) category where category in ('هجر','أرملة','مطلقة'))>1 then
   raise exception 'Choose only one household marital status' using errcode='23514';
 end if;
 if p_id is not null and exists(select 1 from public.families where id=p_id and archived_at is not null) then
   raise exception 'Archived case files cannot be changed' using errcode='42501';
 end if;
 if p_id is null then
  insert into public.families(name,phone,father_name,mother_name,contact_name,contact_age,national_id,phone_2,phone_3,contact_relationship,notes,address,monthly_income,health_condition,branch_area,file_status,status_reason,father_national_id,mother_national_id,father_health_condition,mother_health_condition,father_health_status,mother_health_status,father_employment_status,mother_employment_status,father_occupation,mother_occupation,father_date_of_birth,father_gender,mother_date_of_birth,mother_gender,contact_date_of_birth,contact_gender,next_review_date)
  values(coalesce(p_profile->>'name',''),p_profile->>'phone',p_profile->>'father_name',p_profile->>'mother_name',p_profile->>'contact_name',nullif(p_profile->>'contact_age','')::smallint,p_profile->>'national_id',p_profile->>'phone_2',p_profile->>'phone_3',p_profile->>'contact_relationship',coalesce(p_profile->>'notes',''),p_profile->>'address',nullif(p_profile->>'monthly_income','')::numeric,p_profile->>'health_condition',p_profile->>'branch_area',coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),p_profile->>'status_reason',p_profile->>'father_national_id',p_profile->>'mother_national_id',p_profile->>'father_health_condition',p_profile->>'mother_health_condition',p_profile->>'father_health_status',p_profile->>'mother_health_status',p_profile->>'father_employment_status',p_profile->>'mother_employment_status',p_profile->>'father_occupation',p_profile->>'mother_occupation',nullif(p_profile->>'father_date_of_birth','')::date,nullif(p_profile->>'father_gender',''),nullif(p_profile->>'mother_date_of_birth','')::date,nullif(p_profile->>'mother_gender',''),nullif(p_profile->>'contact_date_of_birth','')::date,nullif(p_profile->>'contact_gender',''),nullif(p_profile->>'next_review_date','')::date) returning id into result;
 else
  update public.families set name=coalesce(p_profile->>'name',''),phone=p_profile->>'phone',father_name=p_profile->>'father_name',mother_name=p_profile->>'mother_name',contact_name=p_profile->>'contact_name',contact_age=nullif(p_profile->>'contact_age','')::smallint,national_id=p_profile->>'national_id',phone_2=p_profile->>'phone_2',phone_3=p_profile->>'phone_3',contact_relationship=p_profile->>'contact_relationship',notes=coalesce(p_profile->>'notes',''),address=p_profile->>'address',monthly_income=nullif(p_profile->>'monthly_income','')::numeric,health_condition=p_profile->>'health_condition',branch_area=p_profile->>'branch_area',file_status=coalesce(nullif(p_profile->>'file_status',''),'تحت المراجعة'),status_reason=p_profile->>'status_reason',father_national_id=p_profile->>'father_national_id',mother_national_id=p_profile->>'mother_national_id',father_health_condition=p_profile->>'father_health_condition',mother_health_condition=p_profile->>'mother_health_condition',father_health_status=p_profile->>'father_health_status',mother_health_status=p_profile->>'mother_health_status',father_employment_status=p_profile->>'father_employment_status',mother_employment_status=p_profile->>'mother_employment_status',father_occupation=p_profile->>'father_occupation',mother_occupation=p_profile->>'mother_occupation',father_date_of_birth=nullif(p_profile->>'father_date_of_birth','')::date,father_gender=nullif(p_profile->>'father_gender',''),mother_date_of_birth=nullif(p_profile->>'mother_date_of_birth','')::date,mother_gender=nullif(p_profile->>'mother_gender',''),contact_date_of_birth=nullif(p_profile->>'contact_date_of_birth','')::date,contact_gender=nullif(p_profile->>'contact_gender',''),next_review_date=case when p_profile ? 'next_review_date' then nullif(p_profile->>'next_review_date','')::date else next_review_date end where id=p_id returning id into result;
  if result is null then raise exception 'Case file not found' using errcode='P0002'; end if;
  if p_categories is not null then
   delete from public.case_file_categories where family_id=result and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون','أخرى');
  end if;
 end if;
 if p_categories is not null then insert into public.case_file_categories(family_id,category) select result,category from unnest(coalesce(p_categories,array[]::text[])) category; end if;
 return result;
end $$;
revoke all on function public.save_case_file(uuid,jsonb,text[]) from public,anon;
grant execute on function public.save_case_file(uuid,jsonb,text[]) to authenticated;
