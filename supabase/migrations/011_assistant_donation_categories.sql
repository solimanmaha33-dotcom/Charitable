-- Match the Arabic category names shown to staff, including common spellings.
-- Keep search invoker-scoped and bounded: no privileged access or dynamic SQL.
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
  from public.donations d where public.has_permission('donationsRead')
 )
 select r.donation_type,r.kind,r.amount,r.currency,r.quantity,left(r.unit,100),substring(r.description from greatest(1,coalesce((select min(strpos(lower(r.description),t.term)) from terms t where strpos(lower(r.description),t.term)>0),1)-150) for 700),r.received_on
 from ranked r where r.score>0 or not exists (select 1 from terms) order by r.score desc,r.id limit 10
$$;
revoke all on function public.assistant_search_donations(text) from public,anon;
grant execute on function public.assistant_search_donations(text) to authenticated;
