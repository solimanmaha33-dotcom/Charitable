-- Keep canceled installment history when a sponsorship ends, and make upcoming
-- obligations visible without waiting for the first of the next month.

create or replace function private.end_sponsorship()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.start_date,new.monthly_amount,new.donor_id,new.family_id) is distinct from (old.start_date,old.monthly_amount,old.donor_id,old.family_id) then
  raise exception 'Create a new sponsorship to change its schedule or parties' using errcode='23514';
 end if;
 if new.end_date is not null then
  if exists(select 1 from public.sponsorship_payments where sponsorship_id=new.id and due_date>new.end_date and received_on is not null) then
   raise exception 'End date precedes a received installment' using errcode='23514';
  end if;
  delete from public.sponsorship_payments
  where sponsorship_id=new.id and due_date>new.end_date and received_on is null and voided_at is null;
 end if;
 return new;
end $$;
revoke all on function private.end_sponsorship() from public,anon,authenticated;

create or replace function public.generate_sponsorship_installments(p_through date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_permission('donationsRead') or not public.has_permission('casesRead') then
  raise exception 'Access denied' using errcode='42501';
 end if;
 if p_through is null or p_through>((statement_timestamp() at time zone 'Africa/Cairo')::date+30) then
  raise exception 'Cutoff must be within the next 30 days' using errcode='23514';
 end if;
 insert into public.sponsorship_payments(sponsorship_id,installment_month,due_date,amount_due)
 select s.id,m::date,public.sponsorship_due_date(s.start_date,m::date),s.monthly_amount
 from public.sponsorships s
 cross join lateral generate_series(date_trunc('month',s.start_date),date_trunc('month',least(p_through,coalesce(s.end_date,p_through))),interval '1 month') m
 where public.sponsorship_due_date(s.start_date,m::date) between s.start_date and least(p_through,coalesce(s.end_date,p_through))
 and not exists(select 1 from public.sponsorship_payments p where p.sponsorship_id=s.id and p.installment_month=m::date)
 order by s.id,m
 on conflict(sponsorship_id,installment_month) do nothing;
end $$;
revoke all on function public.generate_sponsorship_installments(date) from public,anon;
grant execute on function public.generate_sponsorship_installments(date) to authenticated;

-- Do not include reversed gifts in private AI retrieval. The function remains
-- invoker-scoped and bounded exactly like the current donation search.
create or replace function public.assistant_search_donations(p_question text)
returns table(donation_type text,kind text,amount numeric,currency text,quantity numeric,unit text,description text,received_on date)
language sql stable security invoker set search_path='' as $$
 with terms as (
  select distinct t.term,translate(t.term,'أإآ','ااا') normalized
  from regexp_split_to_table(lower(left(coalesce(p_question,''),2000)), '[^[:alnum:]_-]+') t(term)
  where length(t.term) between 2 and 80 and t.term not in ('من','ما','هل','عن','في','على','التي','هذا','هذه','التبرعات','تبرع','الرجاء','اريد','أريد') limit 12
 ), category_words(donation_type,word) as (
  values
   ('cash','نقدي'),('cash','نقدية'),('cash','نقد'),('cash','كاش'),
   ('in_kind_food','غذائية'),('in_kind_food','غذائيه'),('in_kind_food','غذائي'),('in_kind_food','غذاء'),('in_kind_food','طعام'),('in_kind_food','مواد'),
   ('clothing','ملابس'),('clothing','هدوم'),('clothing','ثياب'),
   ('medicine','ادوية'),('medicine','ادويه'),('medicine','دواء'),('medicine','دواءات'),
   ('zakat','زكاة'),('zakat','زكاه'),('zakat','زكوات'),
   ('sadaqa','صدقة'),('sadaqa','صدقه'),('sadaqa','صدقات'),
   ('zakat_al_fitr','زكاة'),('zakat_al_fitr','زكاه'),('zakat_al_fitr','فطر'),('zakat_al_fitr','فطرة'),('zakat_al_fitr','فطره'),
   ('ramadan_food_bags','شنط'),('ramadan_food_bags','شنطة'),('ramadan_food_bags','شنطه'),('ramadan_food_bags','رمضان'),
   ('eid_clothing','كسوة'),('eid_clothing','كسوه'),('eid_clothing','عيد'),
   ('sacrificial_meat','لحوم'),('sacrificial_meat','لحم'),('sacrificial_meat','اضاحي'),('sacrificial_meat','اضحية'),('sacrificial_meat','اضحيه'),
   ('blankets','بطاطين'),('blankets','بطانية'),('blankets','بطانيه'),
   ('school_supplies','مستلزمات'),('school_supplies','دراسية'),('school_supplies','دراسيه'),('school_supplies','دراسي'),('school_supplies','مدرسية'),('school_supplies','مدرسيه'),('school_supplies','مدارس'),
   ('treatment_support','مساعدة'),('treatment_support','مساعده'),('treatment_support','علاج'),('treatment_support','علاجي'),('treatment_support','علاجية'),('treatment_support','علاجيه')
 ), ranked as (
  select d.*, (select count(*) from terms t
   where strpos(lower(d.donation_type||' '||d.kind||' '||d.description||' '||coalesce(d.unit,'')),t.term)>0
    or (d.kind='cash' and t.normalized in ('النقدية','نقدية','النقدي','نقدي','نقد','كاش'))
    or (d.kind='in_kind' and t.normalized in ('عيني','عينية','عينيه','عينيا','العيني','العينية','العينيه','العينيا'))
    or exists(select 1 from category_words a where a.donation_type=d.donation_type and t.normalized in (a.word,'ال'||a.word))
  ) score
  from public.donations d where public.has_permission('donationsRead') and d.voided_at is null
 )
 select r.donation_type,r.kind,r.amount,r.currency,r.quantity,left(r.unit,100),substring(r.description from greatest(1,coalesce((select min(strpos(lower(r.description),t.term)) from terms t where strpos(lower(r.description),t.term)>0),1)-150) for 700),r.received_on
 from ranked r where r.score>0 or not exists (select 1 from terms) order by r.score desc,r.id limit 10
$$;
revoke all on function public.assistant_search_donations(text) from public,anon;
grant execute on function public.assistant_search_donations(text) to authenticated;
