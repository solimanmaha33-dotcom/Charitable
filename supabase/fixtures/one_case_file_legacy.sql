-- Synthetic migration fixture only. Apply after reset to 016, before 017.
begin;
insert into auth.users(id,aud) values ('a1000000-0000-0000-0000-000000000001','authenticated');
insert into public.families(id,name,phone,father_name,mother_name,phone_2,notes)
values
 ('a2000000-0000-0000-0000-000000000001','اسم قديم مكرر','01000000000','أب تجريبي','أم تجريبية','01000000002','ملاحظات الأسرة القديمة'),
 ('a2000000-0000-0000-0000-000000000002','ملف قديم بلا أم',null,'أب آخر',null,null,''),
 ('a2000000-0000-0000-0000-000000000003','اسم قديم مكرر','01000000000','أب ثالث','أم ثالثة',null,'');
insert into public.cases(id,family_id,notes,created_at) values
 ('a3000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','ملاحظة الحالة الأولى','2025-01-02 10:00:00+00'),
 ('a3000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000001','ملاحظة الحالة الثانية','2025-03-04 11:00:00+00');
insert into public.case_categories(case_id,category) values
 ('a3000000-0000-0000-0000-000000000001','يتيم الأم'),
 ('a3000000-0000-0000-0000-000000000002','يتيم الأم'),
 ('a3000000-0000-0000-0000-000000000002','أرملة');
-- Seed removed values as existing historical rows. The NOT VALID constraint still
-- rejects new writes, so briefly remove it only for this synthetic migration fixture.
alter table public.case_categories drop constraint case_categories_category_check;
insert into public.case_categories(case_id,category) values
 ('a3000000-0000-0000-0000-000000000002','وفاة'),
 ('a3000000-0000-0000-0000-000000000002','أيتام');
alter table public.case_categories add constraint case_categories_category_check
 check (category in ('هجر','أرملة','مطلقة','عجز أو مرض','يتيم الأم','يتيم الأب','كبار السن (٦٠ سنة فأكثر)','أسرة مسجون')) not valid;
insert into public.case_files(id,case_id,storage_path,file_name,mime_type,size_bytes,uploaded_by) values
 ('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001','legacy-case.pdf','application/pdf',10,'a1000000-0000-0000-0000-000000000001');
insert into public.case_file_search_text(file_id,text) values ('a4000000-0000-0000-0000-000000000001','نص OCR عربي تجريبي');
insert into public.family_files(id,family_id,storage_path,file_name,mime_type,size_bytes,uploaded_by) values
 ('a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001/a5000000-0000-0000-0000-000000000001','legacy-family.png','image/png',20,'a1000000-0000-0000-0000-000000000001');
insert into public.donors(id,name) values ('a6000000-0000-0000-0000-000000000001','متبرع تجريبي');
insert into public.sponsorships(id,donor_id,family_id,monthly_amount,start_date) values ('a7000000-0000-0000-0000-000000000001','a6000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001',100,'2025-01-15');
insert into public.sponsorship_payments(id,sponsorship_id,installment_month,due_date,amount_due,received_on,amount_received)
values ('a8000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','2025-01-01','2025-01-15',100,'2025-01-15',100);
commit;
