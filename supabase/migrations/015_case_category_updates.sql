-- Preserve historical category values while limiting new/updated category rows to current choices.
alter table public.case_categories
  drop constraint if exists case_categories_category_check;

alter table public.case_categories
  add constraint case_categories_category_check
  check (category in (
    'هجر',
    'أرملة',
    'مطلقة',
    'عجز أو مرض',
    'يتيم الأم',
    'يتيم الأب',
    'كبار السن (٦٠ سنة فأكثر)',
    'أسرة مسجون'
  )) not valid;
