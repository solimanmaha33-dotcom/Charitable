-- Search runs under the caller's RLS permissions. The bounded excerpts are partial.
create or replace function public.assistant_search_cases(p_question text)
returns table(id uuid, notes text, families jsonb, case_categories jsonb, case_files jsonb)
language sql stable security invoker set search_path='' as $$
 with terms as (
  select distinct t.term from regexp_split_to_table(lower(left(coalesce(p_question,''),2000)), '[^[:alnum:]_-]+') t(term)
  where length(t.term) between 2 and 80 and t.term not in ('من','ما','هل','عن','في','على','التي','هذا','هذه','الاسرة','الأسرة','الحالات','حالة','الرجاء','اريد','أريد') limit 12
 ), ranked as (
  select c.id,c.notes,f.code,f.name,
   (select count(*) from terms t where strpos(lower(c.notes||' '||f.code||' '||f.name),t.term)>0
    or exists(select 1 from public.case_categories cc where cc.case_id=c.id and strpos(lower(cc.category),t.term)>0)
    or exists(select 1 from public.case_files cf left join public.case_file_search_text st on st.file_id=cf.id where cf.case_id=c.id and strpos(lower(cf.file_name||' '||coalesce(st.text,'')),t.term)>0)) score
  from public.cases c join public.families f on f.id=c.family_id
  where public.has_permission('casesRead')
 )
 select r.id,substring(r.notes from greatest(1,coalesce((select min(strpos(lower(r.notes),t.term)) from terms t where strpos(lower(r.notes),t.term)>0),1)-200) for 1000),jsonb_build_object('code',r.code),
  coalesce((select jsonb_agg(jsonb_build_object('category',cc.category)) from public.case_categories cc where cc.case_id=r.id),'[]'::jsonb),
  coalesce((select jsonb_agg(jsonb_build_object('file_name',q.file_name,'case_file_search_text',jsonb_build_object('text',q.text))) from (
   select cf.file_name,substring(st.text from greatest(1,coalesce(m.pos,1)-150) for 800) text from public.case_files cf join public.case_file_search_text st on st.file_id=cf.id
   cross join lateral (select min(strpos(lower(st.text),t.term)) pos from terms t where strpos(lower(st.text),t.term)>0) m
   where cf.case_id=r.id order by m.pos nulls last,cf.id limit 2
  ) q),'[]'::jsonb)
 from ranked r where r.score>0 order by r.score desc,r.id limit 10
$$;
create or replace function public.assistant_search_donations(p_question text)
returns table(donation_type text,kind text,amount numeric,currency text,quantity numeric,unit text,description text,received_on date)
language sql stable security invoker set search_path='' as $$
 with terms as (
  select distinct t.term from regexp_split_to_table(lower(left(coalesce(p_question,''),2000)), '[^[:alnum:]_-]+') t(term)
  where length(t.term) between 2 and 80 and t.term not in ('من','ما','هل','عن','في','على','التي','هذا','هذه','التبرعات','تبرع','الرجاء','اريد','أريد') limit 12
 ), ranked as (
  select d.*, (select count(*) from terms t where strpos(lower(d.donation_type||' '||d.kind||' '||d.description||' '||coalesce(d.unit,'')),t.term)>0) score
  from public.donations d where public.has_permission('donationsRead')
 )
 select r.donation_type,r.kind,r.amount,r.currency,r.quantity,left(r.unit,100),substring(r.description from greatest(1,coalesce((select min(strpos(lower(r.description),t.term)) from terms t where strpos(lower(r.description),t.term)>0),1)-150) for 700),r.received_on
 from ranked r where r.score>0 order by r.score desc,r.id limit 10
$$;
revoke all on function public.assistant_search_cases(text), public.assistant_search_donations(text) from public,anon;
grant execute on function public.assistant_search_cases(text), public.assistant_search_donations(text) to authenticated;
