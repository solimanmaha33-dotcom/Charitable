-- Staff cannot remove retired historical labels through direct table writes.
drop policy case_file_categories_delete on public.case_file_categories;
create policy case_file_categories_delete on public.case_file_categories for delete to authenticated using (
  (select public.has_permission('casesWrite'))
  and category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون')
);
